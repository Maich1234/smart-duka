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
    `);
  } catch (err) {
    _available = false;
    _db = null;
    console.warn('[offlineDb] SQLite unavailable — offline queue disabled:', err);
  }
};
