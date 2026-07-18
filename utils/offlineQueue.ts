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

// --- Internal listeners for reactive UI updates ---
type CountListener = (count: number) => void;
type SyncListener = (syncing: boolean) => void;

const countListeners = new Set<CountListener>();
const syncListeners = new Set<SyncListener>();

function notifyCount() {
  const n = getPendingCount();
  countListeners.forEach(l => l(n));
}

function notifySync(syncing: boolean) {
  syncListeners.forEach(l => l(syncing));
}

// --- Public API ---

export type QueueOperation = {
  method: string;
  url: string;
  body?: Record<string, unknown> | null;
};

/** Subscribe to pending-item count changes. Returns an unsubscribe function. */
export const onQueueCountChange = (listener: CountListener): (() => void) => {
  countListeners.add(listener);
  return () => { countListeners.delete(listener); };
};

/** Subscribe to queue sync-in-progress state changes. */
export const onSyncStateChange = (listener: SyncListener): (() => void) => {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
};

/** Number of pending (not yet synced) operations. */
export const getPendingCount = (): number => {
  if (!isOfflineDbAvailable()) return 0;
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_queue WHERE status = 'pending'`
  );
  return row?.count ?? 0;
};

/**
 * Add a mutation to the outbox.
 * idempotencyKey: stable per-request key; prevents double-insertion if called
 * twice for the same logical operation (e.g. optimistic UI retries).
 */
export const enqueueOperation = (
  op: QueueOperation,
  idempotencyKey: string
): void => {
  const db = getDb();
  db.runSync(
    `INSERT OR IGNORE INTO offline_queue
       (id, idempotency_key, method, url, body, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      idempotencyKey,
      op.method.toUpperCase(),
      op.url,
      op.body != null ? JSON.stringify(op.body) : null,
      Date.now(),
      Date.now(),
    ]
  );
  notifyCount();
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
  // 4xx = business logic rejection (bad payload, not found, permission) — fail permanently.
  // 5xx + network errors = transient — keep retrying.
  const isPermanent =
    httpStatus != null && httpStatus >= 400 && httpStatus < 500;
  const newAttempts = row.attempts + 1;

  if (isPermanent) {
    // 4xx: server won't accept this payload on any retry — mark failed.
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
 * Process every pending queue item in order.
 * - Skips silently if already running or if offline.
 * - On 401: refreshes the access token and retries the item once. If the
 *   refresh is rejected the session is over: flag sessionExpired (the UI
 *   logs the user out) and pause; items stay pending for the next login.
 * - On other 4xx failure: marks item as permanently failed (no retry).
 * - On network/5xx failure: retries with exponential backoff, then a slow
 *   5-minute cadence forever.
 */
export const processQueue = async (): Promise<void> => {
  if (isProcessing || !isOfflineDbAvailable()) return;
  const { isConnected } = await NetInfo.fetch();
  if (!isConnected) return;

  isProcessing = true;
  notifySync(true);
  const db = getDb();

  try {
    const rows = db.getAllSync<QueueRow>(
      `SELECT id, idempotency_key, method, url, body, attempts, max_attempts
       FROM offline_queue
       WHERE status = 'pending' AND next_attempt_at <= ?
       ORDER BY created_at ASC`,
      [Date.now()]
    );

    for (const row of rows) {
      // Re-check connectivity before each item
      const check = await NetInfo.fetch();
      if (!check.isConnected) break;

      // Fetch the token per item — if the user logs out mid-sync we stop
      // rather than sending the remaining items with a stale token.
      const token = useAuthStore.getState().token;
      if (!token) break;

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
  } finally {
    isProcessing = false;
    notifySync(false);
    notifyCount();
  }
};
