// Manual mock for expo-sqlite's sync API, backed by a real in-memory
// better-sqlite3 database so tests exercise genuine SQL semantics (UNIQUE
// constraints, transactions, PRAGMA) instead of a hand-rolled fake.
//
// Jest gives each test file its own module registry, so the `instances` map
// below is fresh per test file. Within a file, `openDatabaseSync` returns the
// SAME instance for the same name — matching offlineDb.ts's own singleton
// caching — call `__resetAllMockDatabases()` in a beforeEach alongside
// `jest.resetModules()` to get a clean database between individual tests.
/* eslint-disable @typescript-eslint/no-var-requires */
const Database = require('better-sqlite3');

class MockSQLiteDatabase {
  private db: import('better-sqlite3').Database;

  constructor() {
    this.db = new Database(':memory:');
  }

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  runSync(sql: string, params: unknown[] = []): { changes: number; lastInsertRowId: number } {
    const info = this.db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
  }

  getAllSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  getFirstSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const row = this.db.prepare(sql).get(...params);
    return (row as T) ?? null;
  }

  withTransactionSync(callback: () => void): void {
    this.db.transaction(callback)();
  }
}

const instances = new Map<string, MockSQLiteDatabase>();

export function openDatabaseSync(name: string): MockSQLiteDatabase {
  if (!instances.has(name)) instances.set(name, new MockSQLiteDatabase());
  return instances.get(name)!;
}

export function __resetAllMockDatabases(): void {
  instances.clear();
}

export type SQLiteDatabase = MockSQLiteDatabase;
