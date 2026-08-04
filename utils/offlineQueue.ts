import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { refreshAuthToken } from './tokenRefresh';
import { getDb, isOfflineDbAvailable } from './offlineDb';
import { randomUUID } from './uuid';

// --- Exponential backoff (max 32 s) ---
const MAX_BACKOFF_MS = 32_000;
const backoffMs = (attempts: number) =>
  Math.min(Math.pow(2, attempts) * 1_000, MAX_BACKOFF_MS);

/**
 * Per-request ceiling while draining the queue.
 *
 * Without this the queue could wedge permanently: a half-open socket — the
 * normal shape of a captive portal or a "connected but no internet" cell —
 * leaves the request hanging with no timeout, so `isProcessing` stays true and
 * every later flush returns immediately. One bad request silently ended
 * syncing for the rest of the app session. Longer than the interactive 12 s in
 * api.ts because nobody is watching a spinner here.
 */
const SYNC_REQUEST_TIMEOUT_MS = 20_000;

/** Failed rows older than this are dropped so the table can't grow forever. */
const FAILED_ROW_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * HTTP statuses that are retryable despite being 4xx.
 *
 * 425 matters most: the backend's idempotency middleware returns it while a
 * first attempt with the same key is still in flight (see
 * middlewares/idempotency.js), meaning "ask again shortly", not "give up".
 * Treating it as permanent destroyed exactly the sales the idempotency layer
 * existed to protect. 429 is rate limiting and 408 is a server-side timeout —
 * both resolve on their own.
 */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

// --- Internal listeners for reactive UI updates ---
type CountListener = (pending: number, failed: number) => void;
type SyncListener = (syncing: boolean) => void;

const countListeners = new Set<CountListener>();
const syncListeners = new Set<SyncListener>();

function notifyCount() {
  refreshCounts();
  countListeners.forEach(l => l(pendingSnapshot, failedSnapshot));
}

function notifySync(syncing: boolean) {
  syncListeners.forEach(l => l(syncing));
}

/**
 * Identifies the account a queued row belongs to.
 *
 * The queue is device-wide but rows are personal: a sale carries no seller in
 * its body, the server attributes it to whoever's token replays it. Without
 * this, staff A queueing sales offline and handing the till to staff B meant
 * B's token flushed A's sales — booked to B, in B's takings, and in B's
 * commission. Scoping is what keeps the outbox honest about who sold what.
 */
const currentUserId = (): string | null => useAuthStore.getState().user?._id ?? null;

// --- Public API ---

export type QueueOperation = {
  method: string;
  url: string;
  body?: Record<string, unknown> | null;
};

/**
 * Subscribe to queue count changes. Receives pending and permanently-failed
 * counts. Returns an unsubscribe function.
 */
export const onQueueCountChange = (listener: CountListener): (() => void) => {
  countListeners.add(listener);
  return () => { countListeners.delete(listener); };
};

/** Subscribe to queue sync-in-progress state changes. */
export const onSyncStateChange = (listener: SyncListener): (() => void) => {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
};

/** Counts rows in a status for a given user (legacy NULL rows included). */
const countByStatus = (status: 'pending' | 'failed', userId: string | null): number => {
  if (!isOfflineDbAvailable()) return 0;
  try {
    const row = getDb().getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_queue
       WHERE status = ? AND (user_id = ? OR user_id IS NULL)`,
      [status, userId],
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
};

// Cached counts.
//
// These back `useSyncExternalStore`, which calls its snapshot getter on every
// render — hitting SQLite there would run two synchronous queries per render
// of every dashboard using useAttention. `countsUserId` starts undefined to
// distinguish "never read" from "read while signed out", and a change of
// signed-in user invalidates the cache, since the counts are user-scoped.
let pendingSnapshot = 0;
let failedSnapshot = 0;
let countsUserId: string | null | undefined;

const refreshCounts = () => {
  const userId = currentUserId();
  pendingSnapshot = countByStatus('pending', userId);
  failedSnapshot = countByStatus('failed', userId);
  countsUserId = userId;
};

/** Recomputes only when never read or when the account changed — no DB otherwise. */
const ensureCounts = () => {
  if (countsUserId === undefined || countsUserId !== currentUserId()) refreshCounts();
};

/** Number of operations waiting to sync for the signed-in user. */
export const getPendingCount = (): number => {
  ensureCounts();
  return pendingSnapshot;
};

/**
 * Number of operations that failed permanently and need the user to decide.
 * These are invisible to the sync loop — without a surface reading this, a
 * rejected sale simply vanished with no feedback and no way to recover it.
 */
export const getFailedCount = (): number => {
  ensureCounts();
  return failedSnapshot;
};

export type FailedOperation = {
  id: string;
  method: string;
  url: string;
  attempts: number;
  createdAt: number;
};

/** Lists permanently-failed operations so the UI can describe what was lost. */
export const listFailedOperations = (): FailedOperation[] => {
  if (!isOfflineDbAvailable()) return [];
  try {
    const userId = currentUserId();
    return getDb().getAllSync<{
      id: string; method: string; url: string; attempts: number; created_at: number;
    }>(
      `SELECT id, method, url, attempts, created_at FROM offline_queue
       WHERE status = 'failed' AND (user_id = ? OR user_id IS NULL)
       ORDER BY created_at DESC`,
      [userId],
    ).map((r) => ({
      id: r.id,
      method: r.method,
      url: r.url,
      attempts: r.attempts,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
};

/**
 * Add a mutation to the outbox. Returns false when offline storage is
 * unavailable and the operation could NOT be saved.
 *
 * The return value matters: callers must not tell the user "saved offline"
 * when nothing was saved. This used to throw instead, and the raw SQLite error
 * propagated as the request rejection — so the till showed "Offline storage
 * unavailable" and dropped the sale.
 *
 * idempotencyKey: stable per-request key; the UNIQUE constraint prevents
 * double-insertion if the same logical operation is enqueued twice.
 */
export const enqueueOperation = (
  op: QueueOperation,
  idempotencyKey: string
): boolean => {
  if (!isOfflineDbAvailable()) return false;
  try {
    getDb().runSync(
      `INSERT OR IGNORE INTO offline_queue
         (id, user_id, idempotency_key, method, url, body, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        currentUserId(),
        idempotencyKey,
        op.method.toUpperCase(),
        op.url,
        op.body != null ? JSON.stringify(op.body) : null,
        Date.now(),
        Date.now(),
      ]
    );
    notifyCount();
    return true;
  } catch (err) {
    console.warn('[offlineQueue] enqueue failed:', (err as Error).message);
    return false;
  }
};

/**
 * Moves every failed row back into the pending queue for another attempt.
 * Attempt counters reset so the retry gets a full backoff budget rather than
 * immediately falling back to the slow cadence.
 */
export const retryAllFailed = (): number => {
  if (!isOfflineDbAvailable()) return 0;
  try {
    const userId = currentUserId();
    const result = getDb().runSync(
      `UPDATE offline_queue
         SET status = 'pending', attempts = 0, next_attempt_at = ?
       WHERE status = 'failed' AND (user_id = ? OR user_id IS NULL)`,
      [Date.now(), userId],
    );
    notifyCount();
    void processQueue();
    return result.changes;
  } catch {
    return 0;
  }
};

/** Permanently discards failed rows. Only ever called from an explicit action. */
export const discardAllFailed = (): number => {
  if (!isOfflineDbAvailable()) return 0;
  try {
    const userId = currentUserId();
    const result = getDb().runSync(
      `DELETE FROM offline_queue
       WHERE status = 'failed' AND (user_id = ? OR user_id IS NULL)`,
      [userId],
    );
    notifyCount();
    return result.changes;
  } catch {
    return 0;
  }
};

type QueueRow = {
  id: string;
  idempotency_key: string;
  method: string;
  url: string;
  body: string | null;
  attempts: number;
  max_attempts: number;
};

let isProcessing = false;

const sendRow = (row: QueueRow, token: string) => {
  const body = row.body ? JSON.parse(row.body) : undefined;
  return axios({
    method: row.method,
    url: `${API_BASE_URL}${row.url}`,
    data: body,
    timeout: SYNC_REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      // Forward the original idempotency key so the server can deduplicate
      // in case this request was partially received on the first attempt.
      'X-Idempotency-Key': row.idempotency_key,
      Authorization: `Bearer ${token}`,
    },
  });
};

/** Applies backoff / permanent-failure bookkeeping for a failed attempt. */
const recordFailure = (row: QueueRow, err: any) => {
  const db = getDb();
  const httpStatus: number | undefined = err?.response?.status;
  // A 4xx means the server rejected the payload itself and will reject it
  // again — except for the handful that explicitly mean "later". 5xx and
  // network errors are always transient.
  const isPermanent =
    httpStatus != null &&
    httpStatus >= 400 &&
    httpStatus < 500 &&
    !TRANSIENT_STATUSES.has(httpStatus);
  const newAttempts = row.attempts + 1;

  if (isPermanent) {
    db.runSync(
      `UPDATE offline_queue SET status = 'failed', attempts = ? WHERE id = ?`,
      [newAttempts, row.id]
    );
  } else if (newAttempts >= row.max_attempts) {
    // Exhausted fast-backoff budget but not a permanent error.
    // Switch to a slow 5-minute cadence so the item keeps retrying
    // indefinitely (e.g. server is down for hours) without hammering.
    const SLOW_RETRY_MS = 5 * 60 * 1000;
    db.runSync(
      `UPDATE offline_queue SET attempts = ?, next_attempt_at = ? WHERE id = ?`,
      [newAttempts, Date.now() + SLOW_RETRY_MS, row.id]
    );
  } else {
    db.runSync(
      `UPDATE offline_queue SET attempts = ?, next_attempt_at = ? WHERE id = ?`,
      [newAttempts, Date.now() + backoffMs(newAttempts), row.id]
    );
  }
};

/**
 * Claims rows written before the queue was user-scoped.
 *
 * At upgrade time whoever is signed in is, in practice, the person whose
 * unsynced work is sitting there — they were using the app when it updated.
 * Stamping the rows once means they sync normally instead of being stranded,
 * and from then on the scoping rules apply to them like anything else.
 */
let legacyRowsAdopted = false;
const adoptLegacyRows = (db: ReturnType<typeof getDb>, userId: string) => {
  // Once per app session is enough: nothing writes NULL user_id any more, so
  // after the first pass there is nothing left to claim.
  if (legacyRowsAdopted) return;
  db.runSync(`UPDATE offline_queue SET user_id = ? WHERE user_id IS NULL`, [userId]);
  legacyRowsAdopted = true;
};

/** Drops failed rows old enough that the user is never going to act on them. */
const purgeStaleFailures = (db: ReturnType<typeof getDb>) => {
  db.runSync(
    `DELETE FROM offline_queue WHERE status = 'failed' AND created_at < ?`,
    [Date.now() - FAILED_ROW_TTL_MS],
  );
};

/**
 * Process every pending queue item in order, for the signed-in user only.
 * - Skips silently if already running, offline, or signed out.
 * - On 401: refreshes the access token and retries the item once. If the
 *   refresh is rejected the session is over: flag sessionExpired (the UI
 *   logs the user out) and pause; items stay pending for the next login.
 * - On 408/425/429, 5xx, or network failure: retries with exponential
 *   backoff, then a slow 5-minute cadence forever.
 * - On any other 4xx: marks the item permanently failed, where the failed-row
 *   surface can offer the user a retry or a discard.
 */
export const processQueue = async (): Promise<void> => {
  if (isProcessing || !isOfflineDbAvailable()) return;

  // Nothing can be attributed correctly without a signed-in user, and the
  // token below would be missing anyway.
  const userId = currentUserId();
  if (!userId) return;

  const { isConnected } = await NetInfo.fetch();
  if (isConnected === false) return;

  isProcessing = true;
  notifySync(true);
  const db = getDb();

  try {
    adoptLegacyRows(db, userId);
    purgeStaleFailures(db);

    const rows = db.getAllSync<QueueRow>(
      `SELECT id, idempotency_key, method, url, body, attempts, max_attempts
       FROM offline_queue
       WHERE status = 'pending' AND user_id = ? AND next_attempt_at <= ?
       ORDER BY created_at ASC`,
      [userId, Date.now()]
    );

    for (const row of rows) {
      // Re-check connectivity before each item
      const check = await NetInfo.fetch();
      if (check.isConnected === false) break;

      // Re-read auth per item — if the user logs out or switches accounts
      // mid-sync we stop rather than replaying this user's rows under
      // someone else's token.
      const { token, user } = useAuthStore.getState();
      if (!token || user?._id !== userId) break;

      try {
        await sendRow(row, token);
        // Success — remove from queue
        db.runSync(`DELETE FROM offline_queue WHERE id = ?`, [row.id]);
      } catch (err: any) {
        if (err?.response?.status !== 401) {
          recordFailure(row, err);
          continue;
        }

        // Access token expired mid-sync: refresh and retry this item once.
        // (Without this branch a 401 would fall into the permanent-4xx
        // bucket and wrongly mark queued sales as failed.)
        let freshToken: string | null = null;
        try {
          freshToken = await refreshAuthToken();
        } catch {
          break; // refresh endpoint unreachable — try again next run
        }
        if (!freshToken) {
          // Server rejected the refresh — refreshAuthToken() already set
          // sessionExpiredReason. Let the UI log the user out; the queue
          // resumes after their next sign-in.
          break;
        }
        try {
          await sendRow(row, freshToken);
          db.runSync(`DELETE FROM offline_queue WHERE id = ?`, [row.id]);
        } catch (retryErr: any) {
          if (retryErr?.response?.status === 401) break; // still unauthorized — pause
          recordFailure(row, retryErr);
        }
      }
    }
  } catch (err) {
    console.warn('[offlineQueue] processing aborted:', (err as Error).message);
  } finally {
    isProcessing = false;
    notifySync(false);
    notifyCount();
  }
};
