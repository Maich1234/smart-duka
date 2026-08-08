import { getDb, isOfflineDbAvailable } from '@/utils/offlineDb';
import { getProducts, type Product, type ProductVariant } from '@/services/products';

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
  [
    product.name,
    product.category,
    product.description ?? '',
    // SKU and barcode are both "what a cashier scans or types" — some shops
    // have historically used SKU as their barcode (see findProductByBarcode),
    // and either can be typed into the search bar directly, so both need to
    // be in the blob or a valid search returns nothing.
    product.sku ?? '',
    product.barcode ?? '',
    ...(product.variants?.map((v) => v.sku).filter(Boolean) ?? []),
    ...(product.variants?.map((v) => v.barcode).filter(Boolean) ?? []),
  ]
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
        `INSERT INTO product_cache (id, shop_id, name, search_blob, category, barcode, payload, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product._id,
          shopId,
          product.name,
          searchBlobFor(product),
          product.category ?? null,
          product.barcode || null,
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
 * Ranks a product against an already-lowercased, already-trimmed query term.
 * Higher is better; 0 means "shouldn't have matched" (defensive — every row
 * reaching this already passed the SQL LIKE prefilter on the same fields).
 *
 *   6 — exact SKU/barcode match (product-level or a variant's)
 *   5 — exact product name match
 *   4 — name starts with the query
 *   3 — name contains the query
 *   2 — SKU/barcode contains the query
 *   1 — category/description contains the query (catalogue browsing fallback)
 */
function scoreProduct(product: Product, term: string): number {
  const name = (product.name ?? '').toLowerCase();
  const sku = (product.sku ?? '').trim().toLowerCase();
  const barcode = (product.barcode ?? '').trim().toLowerCase();
  const variantSkus = (product.variants ?? [])
    .map((v) => (v.sku ?? '').trim().toLowerCase())
    .filter(Boolean);
  const variantBarcodes = (product.variants ?? [])
    .map((v) => (v.barcode ?? '').trim().toLowerCase())
    .filter(Boolean);

  if (sku === term || barcode === term || variantSkus.includes(term) || variantBarcodes.includes(term)) return 6;
  if (name === term) return 5;
  if (name.startsWith(term)) return 4;
  if (name.includes(term)) return 3;
  if (
    sku.includes(term) ||
    barcode.includes(term) ||
    variantSkus.some((s) => s.includes(term)) ||
    variantBarcodes.some((b) => b.includes(term))
  ) return 2;

  const category = (product.category ?? '').toLowerCase();
  const description = (product.description ?? '').toLowerCase();
  if (category.includes(term) || description.includes(term)) return 1;

  return 0;
}

/**
 * Searches the local catalogue. An empty query returns everything (the till's
 * default browse view), name-ordered.
 *
 * SQLite does the cheap part — a single LIKE scan over the precomputed
 * `search_blob` (name + category + description + SKUs) narrows a catalogue of
 * thousands down to the handful that mention the term at all. Ranking that
 * candidate set into the priority a cashier expects (an exact SKU/barcode hit
 * before a loose name match) is intentionally done here in JS rather than in
 * SQL: it only has to run over the already-narrowed set, and it's the same
 * shape of scoring `localFilter` already uses elsewhere in the app.
 *
 * `CANDIDATE_CAP` is a safety valve against a pathological single-letter
 * query matching most of the catalogue, not a real limit — real result sets
 * for a useful search term are a small fraction of the shop's SKUs.
 * `limit` bounds what's finally handed to the FlatList.
 */
export function searchCachedProducts(shopId: string, query: string, limit = 200): Product[] {
  if (!isOfflineDbAvailable()) return [];

  try {
    const db = getDb();
    const term = query.trim().toLowerCase();

    if (!term) {
      const rows = db.getAllSync<{ payload: string }>(
        `SELECT payload FROM product_cache
           WHERE shop_id = ?
           ORDER BY name COLLATE NOCASE LIMIT ?`,
        [shopId, limit],
      );
      return rows.map((row) => JSON.parse(row.payload) as Product);
    }

    const CANDIDATE_CAP = Math.max(limit * 5, 1000);
    const rows = db.getAllSync<{ payload: string }>(
      `SELECT payload FROM product_cache
         WHERE shop_id = ? AND search_blob LIKE ?
         LIMIT ?`,
      // Escaping isn't needed for correctness here (% and _ in a product
      // name only ever widen this shop's own results) but the parameter
      // binding keeps it injection-safe regardless.
      [shopId, `%${term}%`, CANDIDATE_CAP],
    );

    return rows
      .map((row) => JSON.parse(row.payload) as Product)
      .map((product) => ({ product, score: scoreProduct(product, term) }))
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .slice(0, limit)
      .map(({ product }) => product);
  } catch (err) {
    console.warn('[productCache] search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Exact-match barcode lookup for the scanner — never fuzzy, unlike
 * `searchCachedProducts`. Two tiers:
 *
 *  1. The indexed `barcode` column, direct equality — instant even against a
 *     large catalogue, and covers the common case (a product-level barcode).
 *  2. A fallback through the same scored search used for typed input, which
 *     also catches a variant's own barcode/SKU and a product whose barcode
 *     was historically entered into its SKU field. Catalogues here are small
 *     (a shop's SKU count), so this stays effectively instant too.
 *
 * Returns `null` on no match — the caller is expected to offer "Add Product"
 * with the code prefilled rather than silently doing nothing.
 */
export function findProductByBarcode(
  shopId: string,
  code: string
): { product: Product; variant?: ProductVariant } | null {
  if (!isOfflineDbAvailable() || !shopId || !code) return null;

  try {
    const db = getDb();
    const row = db.getFirstSync<{ payload: string }>(
      'SELECT payload FROM product_cache WHERE shop_id = ? AND barcode = ? LIMIT 1',
      [shopId, code],
    );
    if (row) return { product: JSON.parse(row.payload) as Product };

    for (const product of searchCachedProducts(shopId, code, 25)) {
      if (product.sku === code || product.barcode === code) return { product };
      const variant = product.variants?.find((v) => v.sku === code || v.barcode === code);
      if (variant) return { product, variant };
    }
    return null;
  } catch (err) {
    console.warn('[productCache] barcode lookup failed:', (err as Error).message);
    return null;
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
