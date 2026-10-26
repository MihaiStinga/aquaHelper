import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_PINNED, PARAMETERS } from '@/domain/parameters';

export const DATABASE_NAME = 'aquahelper.db';

/**
 * Ordered migrations. Never edit one that has shipped; append a new one.
 * Rows carry text ids, updated_at and a soft-delete flag so they can be
 * synced to Firestore later without reshaping the data.
 */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE measurement (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL,
        value REAL NOT NULL,
        raw TEXT NOT NULL,
        measured_at INTEGER NOT NULL,
        tz_offset_min INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX measurement_code_time ON measurement (code, measured_at);

      CREATE TABLE parameter_setting (
        code TEXT PRIMARY KEY NOT NULL,
        min REAL,
        max REAL,
        visible INTEGER NOT NULL DEFAULT 1,
        pinned INTEGER NOT NULL DEFAULT 0,
        sort INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    const now = Date.now();
    for (const [i, p] of PARAMETERS.entries()) {
      await db.runAsync(
        'INSERT INTO parameter_setting (code, visible, pinned, sort, updated_at) VALUES (?, 1, ?, ?, ?)',
        p.code,
        DEFAULT_PINNED.includes(p.code) ? 1 : 0,
        i,
        now,
      );
    }
    await db.runAsync("INSERT INTO kv (key, value) VALUES ('aquarium_name', 'My aquarium')");
  },
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(() => MIGRATIONS[version](db));
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
