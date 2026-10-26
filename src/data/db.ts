import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { DEFAULT_PINNED, PARAMETERS } from '@/domain/parameters';
import { DEFAULT_TASKS, DEFAULT_WATER_CHANGE_STEPS } from '@/domain/tasks';

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
  // 2: water changes / maintenance, tasks, alert dismissals.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE event (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        at INTEGER NOT NULL,
        percent REAL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX event_kind_time ON event (kind, at);

      CREATE TABLE task (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        frequency TEXT NOT NULL,
        weekday INTEGER,
        every_days INTEGER,
        time TEXT,
        action TEXT,
        sort INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE task_done (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        period TEXT NOT NULL,
        done_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX task_done_task ON task_done (task_id, period);

      CREATE TABLE alert_dismissal (
        key TEXT PRIMARY KEY NOT NULL,
        at INTEGER NOT NULL
      );
    `);
    const now = Date.now();
    for (const [i, t] of DEFAULT_TASKS.entries()) {
      await db.runAsync(
        'INSERT INTO task (id, title, frequency, weekday, every_days, time, action, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        randomUUID(), t.title, t.frequency, t.weekday, t.everyDays, t.time, t.action, i, now,
      );
    }
    await db.runAsync("INSERT OR IGNORE INTO kv (key, value) VALUES ('water_change_steps', ?)", JSON.stringify(DEFAULT_WATER_CHANGE_STEPS));
    await db.runAsync("INSERT OR IGNORE INTO kv (key, value) VALUES ('notify_time', '14:00')");
    await db.runAsync("INSERT OR IGNORE INTO kv (key, value) VALUES ('notify_enabled', '1')");
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
