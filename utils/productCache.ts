import { getDb, isOfflineDbAvailable } from '@/utils/offlineDb';
import { getProducts, type Product } from '@/services/products';

/** Server page size used while filling the cache. Bounded by the API's maxLimit. */
const SYNC_PAGE_SIZE = 100;
/** Hard stop, so a runaway pagination bug can't loop forever. */
const MAX_SYNC_PAGES = 50;
/** How long a cached catalogue is trusted before a background refresh. */
export const PRODUCT_CACHE_STALE_MS = 10 * 60 * 1000;

/**
 * Local catalogue for the till.
 *
 * The POS used to search server-side, ten results per page. That meant a
 * network round trip per search on Kenyan mobile data, twenty pages to browse
 * a 200-SKU shop, and — worst of all — nothing at all offline unless the exact
 * search term happened to be in the React Query cache already. "Works
 * offline" has to cover finding a product, or it doesn't cover selling.
 *
 * Every function here is best-effort: if SQLite is unavailable (web without
 * COOP/COEP, or a browser with no OPFS) the callers fall back to the network
 * path rather than breaking the till.
 */

const searchBlobFor = (product: Product) =>
  [product.name, product.category, product.description ?? '']
    .join(' ')
    .toLowerCase();

/** Replaces the cached catalogue for a shop with `products`. */
function writeProducts(shopId: string, products: Product[]): void {
  const db = getDb();
  const now = Date.now();

  db.withTransactionSync(() => {
    // Full replace rather than upsert: this is how deletions and renames stop
    // haunting the till. The catalogue is small enough that correctness beats
    // a cleverer diff.
    db.runSync('DELETE FROM product_cache WHERE shop_id = ?', [shopId]);
    for (const product of products) {
      db.runSync(
        `INSERT INTO product_cache (id, shop_id, name, search_blob, category, payload, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          product._id,
          shopId,
          product.name,
          searchBlobFor(product),
          product.category ?? null,
          JSON.stringify(product),
          now,
        ],
      );
    }
  });
}

/**
 * Pulls the shop's whole catalogue into SQLite, one page at a time.
 * Returns the number of products cached, or null if it couldn't run.
 */
export async function syncProductCache(shopId: string): Promise<number | null> {
  if (!isOfflineDbAvailable() || !shopId) return null;

  try {
    const all: Product[] = [];
    for (let page = 1; page <= MAX_SYNC_PAGES; page += 1) {
      const res = await getProducts({ page, limit: SYNC_PAGE_SIZE });
      all.push(...res.data);
      if (page >= (res.pagination?.pages ?? 1)) break;
    }
    writeProducts(shopId, all);
    return all.length;
  } catch (err) {
    // Offline, or the request failed — keep whatever is already cached.
    console.warn('[productCache] sync failed:', (err as Error).message);
    return null;
  }
}

/**
 * Searches the local catalogue. An empty query returns everything (the till's
 * default browse view), name-ordered.
 *
 * Matching is a substring scan over name + category + description, which is
 * what a cashier actually does: type three letters of a product and expect it
 * to appear. `limit` exists to keep the FlatList bounded on a very large
 * catalogue, not to paginate — there is no "next page" at the counter.
 */
export function searchCachedProducts(shopId: string, query: string, limit = 200): Product[] {
  if (!isOfflineDbAvailable()) return [];

  try {
    const db = getDb();
    const term = query.trim().toLowerCase();

    const rows = term
      ? db.getAllSync<{ payload: string }>(
        `SELECT payload FROM product_cache
           WHERE shop_id = ? AND search_blob LIKE ?
           ORDER BY name COLLATE NOCASE LIMIT ?`,
        // Escaping isn't needed for correctness here (% and _ in a product
        // name only ever widen this shop's own results) but the parameter
        // binding keeps it injection-safe regardless.
        [shopId, `%${term}%`, limit],
      )
      : db.getAllSync<{ payload: string }>(
        `SELECT payload FROM product_cache
           WHERE shop_id = ?
           ORDER BY name COLLATE NOCASE LIMIT ?`,
        [shopId, limit],
      );

    return rows.map((row) => JSON.parse(row.payload) as Product);
  } catch (err) {
    console.warn('[productCache] search failed:', (err as Error).message);
    return [];
  }
}

/** One sold line, as the till knows it before the server has seen the sale. */
export type OfflineStockDelta = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

/**
 * Applies a queued sale's stock movement to the local catalogue.
 *
 * Without this the mirror kept showing pre-sale quantities for as long as the
 * shop stayed offline, so the till would happily sell the same last unit over
 * and over. Every one of those sales then failed server-side with
 * "Insufficient stock" — a permanent 4xx — and was thrown away. The cashier
 * saw nothing wrong until the day's takings came up short.
 *
 * Best-effort and deliberately not transactional with the queue write: a
 * missed decrement is a stale number, while a missed queue row is a lost sale.
 * The real quantity is restored on the next successful `syncProductCache`.
 */
export function applyOfflineStockDelta(shopId: string, deltas: OfflineStockDelta[]): void {
  if (!isOfflineDbAvailable() || !shopId || !deltas.length) return;

  try {
    const db = getDb();
    db.withTransactionSync(() => {
      for (const delta of deltas) {
        const row = db.getFirstSync<{ payload: string }>(
          'SELECT payload FROM product_cache WHERE id = ? AND shop_id = ?',
          [delta.productId, shopId],
        );
        if (!row) continue;

        const product = JSON.parse(row.payload) as Product;
        // Untracked products (services) have no stock to move.
        if (product.trackInventory === false) continue;

        if (delta.variantId) {
          const variant = product.variants?.find((v) => v._id === delta.variantId);
          if (!variant) continue;
          variant.quantity = Math.max(0, (variant.quantity ?? 0) - delta.quantity);
        } else {
          product.quantity = Math.max(0, (product.quantity ?? 0) - delta.quantity);
        }

        db.runSync(
          'UPDATE product_cache SET payload = ? WHERE id = ? AND shop_id = ?',
          [JSON.stringify(product), delta.productId, shopId],
        );
      }
    });
  } catch (err) {
    console.warn('[productCache] stock delta failed:', (err as Error).message);
  }
}

/** Drops a shop's cached catalogue — used on sign-out. */
export function clearProductCache(shopId?: string): void {
  if (!isOfflineDbAvailable()) return;
  try {
    if (shopId) getDb().runSync('DELETE FROM product_cache WHERE shop_id = ?', [shopId]);
    else getDb().runSync('DELETE FROM product_cache');
  } catch {
    // Non-fatal.
  }
}
