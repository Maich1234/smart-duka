import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

let _db: SQLiteDatabase | null = null;
let _available = true;

export const getDb = (): SQLiteDatabase => {
  if (!_available) throw new Error('Offline storage unavailable');
  if (!_db) {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      throw new Error('SQLite cannot run during SSR');
    }
    _db = openDatabaseSync('smart-duka-offline.db');
  }
  return _db;
};

/**
 * False when SQLite could not be opened on this platform (e.g. web served
 * without the COOP/COEP headers SharedArrayBuffer needs, or a browser
 * without OPFS). The queue degrades: mutations fail immediately instead of
 * queueing, and the app runs online-only rather than crashing at startup.
 */
export const isOfflineDbAvailable = (): boolean => _available;

export const initOfflineDb = (): void => {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    _available = false;
    return;
  }
  try {
    const db = getDb();
    // product_cache is a local mirror of the shop's catalogue so the till can
    // find a product by typing instead of asking the server. The POS used to
    // search server-side, ten results per page: a network round trip per
    // keystroke burst on Kenyan mobile data, twenty pages to browse a 200-SKU
    // shop, and offline a term the cashier had never searched before returned
    // nothing at all — the offline promise failed at the counter, which is
    // where it has to hold. `search_blob` is a lowercased name + category +
    // description for one LIKE scan; `payload` is the full Product JSON so the
    // cart, variant picker, and promotions behave identically online and off.
    db.execSync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        body TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        next_attempt_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_queue_ready
        ON offline_queue(status, next_attempt_at);

      CREATE TABLE IF NOT EXISTS ai_insight_cache (
        shop_id TEXT NOT NULL,
        date TEXT NOT NULL,
        summary TEXT NOT NULL,
        priority TEXT NOT NULL,
        actions TEXT NOT NULL,
        health INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        PRIMARY KEY (shop_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_insight_shop_date
        ON ai_insight_cache(shop_id, date);

      CREATE TABLE IF NOT EXISTS product_cache (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        search_blob TEXT NOT NULL,
        category TEXT,
        payload TEXT NOT NULL,
        synced_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_product_cache_shop
        ON product_cache(shop_id, name);
      CREATE INDEX IF NOT EXISTS idx_product_cache_search
        ON product_cache(shop_id, search_blob);
    `);
  } catch (err) {
    _available = false;
    _db = null;
    console.warn('[offlineDb] SQLite unavailable — offline queue disabled:', err);
  }
};
