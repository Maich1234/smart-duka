import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

let _db: SQLiteDatabase | null = null;

export const getDb = (): SQLiteDatabase => {
  if (!_db) {
    _db = openDatabaseSync('smart-duka-offline.db');
  }
  return _db;
};

export const initOfflineDb = (): void => {
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
};
