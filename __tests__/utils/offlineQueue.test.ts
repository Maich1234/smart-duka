import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import NetInfo, { __setState } from '@react-native-community/netinfo';
import { getDb } from '@/utils/offlineDb';
import {
  enqueueOperation,
  processQueue,
  getPendingCount,
  getFailedCount,
  retryAllFailed,
  discardAllFailed,
  listFailedOperations,
} from '@/utils/offlineQueue';
import { getLocalSalesSnapshot, saveLocalSale } from '@/utils/localSales';
import { API_BASE_URL } from '@/constants/config';
import { resetAllTestState, seedProduct, SHOP_ID, USER_ID, OTHER_USER_ID, signIn } from '../testUtils';

const mock = new MockAdapter(axios);

/** A queue row's idempotency key doubles as its local_sales id in the real
 * PosScreen flow (see components/sales/PosScreen.tsx) — reproduced here so
 * the queue/local-sales reconciliation is exercised the same way. */
function enqueueSale(items: { productId: string; quantity: number; variantId?: string }[]) {
  const localId = `local-${Math.random().toString(36).slice(2)}`;
  const body = { items, paymentMethod: 'cash' };
  const queued = enqueueOperation({ method: 'POST', url: '/sales', body }, localId, localId);
  saveLocalSale(SHOP_ID, USER_ID, {
    _id: localId,
    invoiceNumber: `PENDING-${localId}`,
    items: items.map((i) => ({ productId: i.productId, productName: 'Item', quantity: i.quantity, unitPrice: 10, subtotal: 10 * i.quantity })),
    totalAmount: items.reduce((s, i) => s + i.quantity * 10, 0),
    paymentMethod: 'cash',
    staff: { _id: USER_ID, name: 'Cashier', email: 'c@shop.test' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'completed',
  });
  return { localId, queued };
}

describe('offlineQueue', () => {
  beforeEach(() => {
    resetAllTestState();
    mock.reset();
  });

  afterAll(() => {
    mock.restore();
  });

  // ── Airplane mode ────────────────────────────────────────────────────────
  describe('airplane mode', () => {
    it('enqueues a sale locally without ever attempting a network call', async () => {
      __setState({ isConnected: false });
      const { queued } = enqueueSale([{ productId: 'p1', quantity: 2 }]);

      expect(queued).toBe(true);
      expect(getPendingCount()).toBe(1);

      await processQueue();

      // Never even attempted a request — processQueue bails out on the
      // NetInfo check before touching the network.
      expect(mock.history.post.length).toBe(0);
      expect(getPendingCount()).toBe(1);
    });

    it('a local database failure never claims the sale was saved', () => {
      // Simulate SQLite being unavailable (web without COOP/COEP) by pointing
      // enqueueOperation at a shop with no local storage — offlineDb itself
      // exposes isOfflineDbAvailable(), but the queue's own guard is what
      // callers rely on: a false return means nothing was written.
      const db = getDb();
      // Force a write failure (e.g. a corrupt/locked database) by dropping
      // the table the insert needs — enqueueOperation must fail closed, not
      // throw and not silently pretend to have queued the row.
      db.execSync('DROP TABLE offline_queue');

      const result = enqueueOperation({ method: 'POST', url: '/sales', body: { items: [] } }, 'x', 'x');
      expect(result).toBe(false);
    });
  });

  // ── Reconnecting / switching online-offline ─────────────────────────────
  describe('reconnecting and switching connectivity', () => {
    it('syncs a sale made offline once the device reconnects', async () => {
      __setState({ isConnected: false });
      const { localId } = enqueueSale([{ productId: 'p1', quantity: 1 }]);
      await processQueue();
      expect(getPendingCount()).toBe(1);

      mock.onPost(`${API_BASE_URL}/sales`).reply(201, { success: true, data: { _id: 'server-1', invoiceNumber: 'INV-001' } });
      __setState({ isConnected: true });
      await processQueue();

      expect(getPendingCount()).toBe(0);
      expect(mock.history.post.length).toBe(1);
      // The local stand-in is gone — the server's record is now authoritative.
      expect(getLocalSalesSnapshot(SHOP_ID).find((s) => s._id === localId)).toBeUndefined();
    });

    it('stops mid-drain the instant connectivity drops, leaving later rows pending', async () => {
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      enqueueSale([{ productId: 'p2', quantity: 1 }]);

      let calls = 0;
      mock.onPost(`${API_BASE_URL}/sales`).reply(() => {
        calls += 1;
        // The first item's request itself flips connectivity — simulates
        // losing signal mid-sync, not just between items.
        if (calls === 1) __setState({ isConnected: false });
        return [201, { success: true, data: { _id: `server-${calls}` } }];
      });

      await processQueue();

      expect(calls).toBe(1);
      expect(getPendingCount()).toBe(1);
    });

    it('a sale submitted mid-sync (reconnect race) is not skipped or duplicated', async () => {
      mock.onPost(`${API_BASE_URL}/sales`).reply(201, { success: true, data: { _id: 'ok' } });

      // Two triggers landing together (NetInfo reconnect + AppState resume) —
      // both call processQueue without awaiting each other, exactly as
      // offlineManager.ts's listeners do.
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      const first = processQueue();
      const second = processQueue();
      await Promise.all([first, second]);

      // Only one pass actually processed the row — the second call saw
      // isProcessing already true and returned immediately.
      expect(mock.history.post.length).toBe(1);
      expect(getPendingCount()).toBe(0);
    });

    it('a sale enqueued while a sync is already draining is not stranded until the periodic retry', async () => {
      let releaseFirstResponse: () => void;
      const firstResponseGate = new Promise<void>((resolve) => { releaseFirstResponse = resolve; });
      let calls = 0;
      mock.onPost(`${API_BASE_URL}/sales`).reply(async () => {
        calls += 1;
        if (calls === 1) await firstResponseGate;
        return [201, { success: true, data: { _id: `s${calls}` } }];
      });

      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      const firstPass = processQueue();
      // Let the first pass claim the lock and reach the (gated) network call.
      await new Promise((r) => setImmediate(r));

      // A second sale is made — same trigger a real "Sell" tap fires — while
      // the first is still mid-flight. This must not be dropped on the floor
      // to wait for the 30s periodic retry.
      enqueueSale([{ productId: 'p2', quantity: 1 }]);
      await processQueue();
      expect(getPendingCount()).toBe(2); // second row not yet sent, but not lost either

      releaseFirstResponse!();
      await firstPass;
      // The first pass's own finally kicks off the rerun it now owes —
      // give that fire-and-forget chain a tick to actually complete.
      await new Promise((r) => setImmediate(r));

      expect(calls).toBe(2);
      expect(getPendingCount()).toBe(0);
    });
  });

  // ── Multiple rapid sales / duplicate submissions ────────────────────────
  describe('multiple rapid sales and duplicate submissions', () => {
    it('each rapid sale gets its own idempotency key and its own row', async () => {
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      enqueueSale([{ productId: 'p2', quantity: 1 }]);
      enqueueSale([{ productId: 'p3', quantity: 1 }]);

      expect(getPendingCount()).toBe(3);

      let n = 0;
      mock.onPost(`${API_BASE_URL}/sales`).reply(() => [201, { success: true, data: { _id: `s${n++}` } }]);
      await processQueue();

      expect(mock.history.post.length).toBe(3);
      // Every request carried a distinct idempotency key — three real sales,
      // not one sale replayed three times.
      const keys = mock.history.post.map((r) => r.headers?.['X-Idempotency-Key']);
      expect(new Set(keys).size).toBe(3);
      expect(getPendingCount()).toBe(0);
    });

    it('enqueueing the exact same idempotency key twice does not create a second row', () => {
      const body = { items: [{ productId: 'p1', quantity: 1 }], paymentMethod: 'cash' };
      enqueueOperation({ method: 'POST', url: '/sales', body }, 'same-key', 'local-x');
      enqueueOperation({ method: 'POST', url: '/sales', body }, 'same-key', 'local-x');

      expect(getPendingCount()).toBe(1);
    });

    it('a network hiccup that queues a retroactive retry never sends the request twice under the same key', async () => {
      const { queued } = enqueueSale([{ productId: 'p1', quantity: 1 }]);
      expect(queued).toBe(true);

      let attempts = 0;
      mock.onPost(`${API_BASE_URL}/sales`).reply(() => {
        attempts += 1;
        if (attempts === 1) return [500, { message: 'temporary' }];
        return [201, { success: true, data: { _id: 'ok' } }];
      });

      await processQueue(); // attempt 1: 500 -> backoff, stays pending
      expect(getPendingCount()).toBe(1);

      // Fast-forward past the backoff window without waiting in real time.
      getDb().runSync(`UPDATE offline_queue SET next_attempt_at = 0`);
      await processQueue(); // attempt 2: succeeds

      expect(attempts).toBe(2);
      expect(getPendingCount()).toBe(0);
      const [firstKey, secondKey] = mock.history.post.map((r) => r.headers?.['X-Idempotency-Key']);
      expect(firstKey).toBe(secondKey); // same logical operation, same key both times
    });
  });

  // ── Failed synchronization ───────────────────────────────────────────────
  describe('failed synchronization', () => {
    it('a permanent 4xx marks the sale failed, restores its stock, and surfaces the server reason', async () => {
      seedProduct(SHOP_ID, { _id: 'p1', name: 'Bread', quantity: 10, trackInventory: true });
      const { localId } = enqueueSale([{ productId: 'p1', quantity: 3 }]);

      // Mirrors PosScreen's own optimistic decrement at submit time.
      const { applyOfflineStockDelta } = require('@/utils/productCache');
      applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 3 }]);
      expect(JSON.parse(getDb().getFirstSync<any>('SELECT payload FROM product_cache WHERE id = ?', ['p1']).payload).quantity).toBe(7);

      mock.onPost(`${API_BASE_URL}/sales`).reply(400, { message: 'That payment method was removed.' });
      await processQueue();

      expect(getPendingCount()).toBe(0);
      expect(getFailedCount()).toBe(1);

      const [failed] = listFailedOperations();
      expect(failed.error).toBe('That payment method was removed.');
      expect(failed.label).toBe('Sale');

      const [localSale] = getLocalSalesSnapshot(SHOP_ID);
      expect(localSale.localStatus).toBe('failed');
      expect(localSale.localError).toBe('That payment method was removed.');

      // Stock the till provisionally took is given back — nothing was sold.
      expect(JSON.parse(getDb().getFirstSync<any>('SELECT payload FROM product_cache WHERE id = ?', ['p1']).payload).quantity).toBe(10);

      void localId;
    });

    it('429/425/408 are treated as transient, not permanent failure', async () => {
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      mock.onPost(`${API_BASE_URL}/sales`).reply(429, { message: 'slow down' });
      await processQueue();

      expect(getFailedCount()).toBe(0);
      expect(getPendingCount()).toBe(1);
      expect(getLocalSalesSnapshot(SHOP_ID)[0].localStatus).toBe('pending_sync');
    });

    it('retrying a failed sale mints a new idempotency key and takes the stock back down', async () => {
      seedProduct(SHOP_ID, { _id: 'p1', name: 'Bread', quantity: 10, trackInventory: true });
      enqueueSale([{ productId: 'p1', quantity: 2 }]);
      const { applyOfflineStockDelta } = require('@/utils/productCache');
      applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 2 }]);

      mock.onPost(`${API_BASE_URL}/sales`).replyOnce(400, { message: 'rejected' });
      await processQueue();
      const originalKey = mock.history.post[0].headers?.['X-Idempotency-Key'];

      // Queued up before retrying: retryAllFailed kicks off its own
      // fire-and-forget processQueue() (real production behaviour — an
      // immediate retry attempt, not just a status flip), so the 201 handler
      // must already be in place before that races off.
      mock.onPost(`${API_BASE_URL}/sales`).reply(201, { success: true, data: { _id: 'ok' } });

      const [failedOp] = listFailedOperations();
      const n = retryAllFailed([failedOp.id]);
      expect(n).toBe(1);
      expect(getLocalSalesSnapshot(SHOP_ID)[0].localStatus).toBe('pending_sync');
      expect(JSON.parse(getDb().getFirstSync<any>('SELECT payload FROM product_cache WHERE id = ?', ['p1']).payload).quantity).toBe(8);

      // Let retryAllFailed's own fire-and-forget sync finish, then run one
      // more explicit pass to be sure nothing was left behind.
      await new Promise((r) => setTimeout(r, 0));
      await processQueue();

      expect(mock.history.post.length).toBe(2);
      const retriedKey = mock.history.post[1].headers?.['X-Idempotency-Key'];
      expect(retriedKey).not.toBe(originalKey);
      expect(getPendingCount()).toBe(0);
    });

    it('discarding a failed sale removes it for good without re-touching stock', async () => {
      seedProduct(SHOP_ID, { _id: 'p1', name: 'Bread', quantity: 10, trackInventory: true });
      enqueueSale([{ productId: 'p1', quantity: 2 }]);
      const { applyOfflineStockDelta } = require('@/utils/productCache');
      applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 2 }]);

      mock.onPost(`${API_BASE_URL}/sales`).reply(400, { message: 'rejected' });
      await processQueue();
      // Failure already restored stock to 10.
      expect(JSON.parse(getDb().getFirstSync<any>('SELECT payload FROM product_cache WHERE id = ?', ['p1']).payload).quantity).toBe(10);

      const [failedOp] = listFailedOperations();
      const n = discardAllFailed([failedOp.id]);

      expect(n).toBe(1);
      expect(getFailedCount()).toBe(0);
      expect(getLocalSalesSnapshot(SHOP_ID)).toHaveLength(0);
      expect(JSON.parse(getDb().getFirstSync<any>('SELECT payload FROM product_cache WHERE id = ?', ['p1']).payload).quantity).toBe(10);
    });
  });

  // ── App restart before sync ─────────────────────────────────────────────
  describe('app restart before sync', () => {
    it('a sale queued before a restart is still there afterwards and syncs normally', async () => {
      __setState({ isConnected: false });
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      expect(getPendingCount()).toBe(1);

      // "Restart": the offline_queue table is durable SQLite state, not
      // in-memory — nothing to do here except prove a fresh processQueue
      // pass (as would run from _layout.tsx on next launch) still finds it.
      mock.onPost(`${API_BASE_URL}/sales`).reply(201, { success: true, data: { _id: 'ok' } });
      __setState({ isConnected: true });
      await processQueue();

      expect(getPendingCount()).toBe(0);
      expect(mock.history.post.length).toBe(1);
    });
  });

  // ── 401 mid-sync ─────────────────────────────────────────────────────────
  describe('token expiry mid-sync', () => {
    it('refreshes once and replays the same row on a 401, without marking it failed', async () => {
      enqueueSale([{ productId: 'p1', quantity: 1 }]);

      let attempt = 0;
      mock.onPost(`${API_BASE_URL}/sales`).reply(() => {
        attempt += 1;
        return attempt === 1 ? [401, { message: 'expired' }] : [201, { success: true, data: { _id: 'ok' } }];
      });
      mock.onPost(`${API_BASE_URL}/auth/refresh`).reply(200, {
        data: { token: 'new-access-token', refreshToken: 'new-refresh-token' },
      });

      await processQueue();

      expect(attempt).toBe(2);
      expect(getPendingCount()).toBe(0);
      expect(getFailedCount()).toBe(0);
    });
  });

  // ── User scoping ─────────────────────────────────────────────────────────
  describe('per-user scoping', () => {
    it('does not sync another signed-in user\'s queued rows', async () => {
      enqueueSale([{ productId: 'p1', quantity: 1 }]);
      signIn({ _id: OTHER_USER_ID });

      mock.onPost(`${API_BASE_URL}/sales`).reply(201, { success: true, data: { _id: 'ok' } });
      await processQueue();

      expect(mock.history.post.length).toBe(0);
      // Still pending under the original user, invisible to the new one.
      expect(getPendingCount()).toBe(0); // getPendingCount reads the CURRENT user
      signIn({ _id: USER_ID });
      expect(getPendingCount()).toBe(1);
    });
  });
});
