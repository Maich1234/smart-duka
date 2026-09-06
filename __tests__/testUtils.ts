import { getDb, initOfflineDb } from '@/utils/offlineDb';
import { getPendingCount, getFailedCount } from '@/utils/offlineQueue';
import { useAuthStore } from '@/store/authStore';
import { __resetNetInfo } from '@react-native-community/netinfo';

export const SHOP_ID = 'shop-1';
export const USER_ID = 'user-1';
export const OTHER_USER_ID = 'user-2';

/** Truncates every offline-first table — call in beforeEach for test isolation. */
export function resetOfflineDb(): void {
  initOfflineDb();
  const db = getDb();
  db.execSync('DELETE FROM offline_queue');
  db.execSync('DELETE FROM local_sales');
  db.execSync('DELETE FROM product_cache');

  // offlineQueue.ts caches pending/failed counts per signed-in user id and
  // only recomputes when that id changes (a deliberate perf choice — see its
  // own comment). Truncating the table out from under it, as this helper
  // just did, leaves a stale cache unless something makes the id change:
  // sign out momentarily and read once, so the next real read (once a test
  // signs back in) sees a different id and is forced to recompute against
  // the now-empty table instead of trusting the old count.
  useAuthStore.setState({ user: null } as any);
  getPendingCount();
  getFailedCount();
}

export function signIn(overrides: Partial<{ _id: string; token: string; refreshToken: string }> = {}): void {
  useAuthStore.setState({
    user: {
      _id: overrides._id ?? USER_ID,
      name: 'Cashier',
      email: 'cashier@shop.test',
      role: 'staff',
      shop: { _id: SHOP_ID, name: 'Test Shop', currency: 'KES' },
    },
    token: overrides.token ?? 'access-token',
    refreshToken: overrides.refreshToken ?? 'refresh-token',
    isLoading: false,
    sessionExpiredReason: null,
  } as any);
}

export function signOut(): void {
  useAuthStore.setState({ user: null, token: null, refreshToken: null } as any);
}

/** Resets every piece of shared mock/module state a test might have touched. */
export function resetAllTestState(): void {
  resetOfflineDb();
  __resetNetInfo();
  signIn();
}

export function seedProduct(shopId: string, product: Record<string, unknown> & { _id: string; name: string }): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO product_cache (id, shop_id, name, search_blob, category, barcode, payload, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product._id,
      shopId,
      product.name,
      String(product.name).toLowerCase(),
      null,
      null,
      JSON.stringify(product),
      Date.now(),
    ],
  );
}
