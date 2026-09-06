import { getDb, isOfflineDbAvailable } from './offlineDb';
import type { Sale } from '@/services/sales';

/**
 * Local-first sale storage.
 *
 * A sale is written here the instant "Sell" is tapped, before the network is
 * ever touched — see the mutationFn in PosScreen.tsx. It stays here, driving
 * "My Sales History" and stock alongside the confirmed catalogue, until
 * {@link resolveLocalSale} deletes it (the server has the real record now) or
 * {@link markLocalSaleFailed} flags it for the failed-sync surface.
 *
 * `id` is the client-generated sale id AND the offline_queue row's
 * idempotency key — one id ties the optimistic record, the queued write, and
 * (once synced) the server's own idempotency ledger together.
 */

export type LocalSaleStatus = 'pending_sync' | 'failed';

export type LocalSale = Sale & {
  /** Absent for a server-confirmed sale; present only for a row still living here. */
  localStatus: LocalSaleStatus;
  /** Server's own rejection reason, once a sync attempt has permanently failed. */
  localError?: string | null;
};

type Listener = () => void;

// Fires on every write (save/resolve/fail/discard/retry) — drives the
// reactive "My Sales History" list.
const listeners = new Set<Listener>();
// Fires only once a sale is confirmed by the server — the cue to refetch the
// authoritative mySales/products/myCommission queries. Kept separate from
// `listeners` so a local save doesn't trigger a network refetch it doesn't need.
const syncedListeners = new Set<Listener>();

export const onLocalSalesChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const onLocalSaleSynced = (listener: Listener): (() => void) => {
  syncedListeners.add(listener);
  return () => { syncedListeners.delete(listener); };
};

// Cached snapshot, same shape as offlineQueue.ts's pending/failed counts:
// useSyncExternalStore calls its getter every render, and this table can be
// read from the till's sales list, so a bare SQLite query per render would
// run one every keystroke/re-render rather than only when something changed.
let version = 0;
let cachedShopId: string | null = null;
let cachedVersion = -1;
let cached: LocalSale[] = [];

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

type LocalSaleRow = { payload: string; status: LocalSaleStatus; last_error: string | null };

function queryLocalSales(shopId: string): LocalSale[] {
  if (!isOfflineDbAvailable() || !shopId) return [];
  try {
    return getDb()
      .getAllSync<LocalSaleRow>(
        `SELECT payload, status, last_error FROM local_sales
         WHERE shop_id = ? ORDER BY created_at DESC`,
        [shopId],
      )
      .map((row) => ({
        ...(JSON.parse(row.payload) as Sale),
        localStatus: row.status,
        localError: row.last_error,
      }));
  } catch (err) {
    console.warn('[localSales] read failed:', (err as Error).message);
    return [];
  }
}

/** Sales made on this device the server hasn't confirmed yet, newest first. */
export function getLocalSalesSnapshot(shopId: string): LocalSale[] {
  if (cachedShopId !== shopId || cachedVersion !== version) {
    cached = queryLocalSales(shopId);
    cachedShopId = shopId;
    cachedVersion = version;
  }
  return cached;
}

/**
 * Writes a just-made sale locally. `sale._id` doubles as this row's id and
 * must be the same value used as the queued write's idempotency key
 * (enqueueOperation's `localSaleId` argument) — that's what lets
 * {@link resolveLocalSale} find its way back here once the queue drains it.
 */
export function saveLocalSale(shopId: string, userId: string | null, sale: Sale): boolean {
  if (!isOfflineDbAvailable()) return false;
  try {
    getDb().runSync(
      `INSERT OR REPLACE INTO local_sales (id, shop_id, user_id, payload, status, last_error, created_at)
       VALUES (?, ?, ?, ?, 'pending_sync', NULL, ?)`,
      [sale._id, shopId, userId, JSON.stringify(sale), Date.now()],
    );
    notify();
    return true;
  } catch (err) {
    console.warn('[localSales] save failed:', (err as Error).message);
    return false;
  }
}

/** The server has confirmed this sale — its local stand-in is no longer needed. */
export function resolveLocalSale(localId: string): void {
  if (!isOfflineDbAvailable()) return;
  try {
    getDb().runSync(`DELETE FROM local_sales WHERE id = ?`, [localId]);
  } catch (err) {
    console.warn('[localSales] resolve failed:', (err as Error).message);
  }
  notify();
  syncedListeners.forEach((l) => l());
}

/** The server has permanently rejected this sale — surface it, don't hide it. */
export function markLocalSaleFailed(localId: string, message: string | null): void {
  if (!isOfflineDbAvailable()) return;
  try {
    getDb().runSync(
      `UPDATE local_sales SET status = 'failed', last_error = ? WHERE id = ?`,
      [message, localId],
    );
    notify();
  } catch (err) {
    console.warn('[localSales] mark-failed failed:', (err as Error).message);
  }
}

/** A failed row is being retried under a fresh queue attempt — back to pending. */
export function retryLocalSale(localId: string): void {
  if (!isOfflineDbAvailable()) return;
  try {
    getDb().runSync(
      `UPDATE local_sales SET status = 'pending_sync', last_error = NULL WHERE id = ?`,
      [localId],
    );
    notify();
  } catch (err) {
    console.warn('[localSales] retry failed:', (err as Error).message);
  }
}

/** The queued write behind this sale was discarded for good — so is the sale. */
export function discardLocalSale(localId: string): void {
  if (!isOfflineDbAvailable()) return;
  try {
    getDb().runSync(`DELETE FROM local_sales WHERE id = ?`, [localId]);
    notify();
  } catch (err) {
    console.warn('[localSales] discard failed:', (err as Error).message);
  }
}
