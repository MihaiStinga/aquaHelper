import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import type { Measurement, Range, TankEvent } from '@/domain/types';
import type { Task, TaskDone } from '@/domain/tasks';

export interface ParameterSetting extends Range {
  code: string;
  visible: boolean;
  pinned: boolean;
  sort: number;
}

interface MeasurementRow {
  id: string;
  code: string;
  value: number;
  measured_at: number;
  note: string | null;
}

interface SettingRow {
  code: string;
  min: number | null;
  max: number | null;
  visible: number;
  pinned: number;
  sort: number;
}

export async function loadMeasurements(db: SQLiteDatabase): Promise<Measurement[]> {
  const rows = await db.getAllAsync<MeasurementRow>(
    'SELECT id, code, value, measured_at, note FROM measurement WHERE deleted = 0 ORDER BY measured_at',
  );
  return rows.map((r) => ({ id: r.id, code: r.code, value: r.value, measuredAt: r.measured_at, note: r.note }));
}

export async function loadSettings(db: SQLiteDatabase): Promise<ParameterSetting[]> {
  const rows = await db.getAllAsync<SettingRow>('SELECT code, min, max, visible, pinned, sort FROM parameter_setting ORDER BY sort');
  return rows.map((r) => ({ ...r, visible: r.visible === 1, pinned: r.pinned === 1 }));
}

export interface NewMeasurement {
  code: string;
  value: number;
  /** Exactly what the user typed, kept for auditing. */
  raw: string;
  measuredAt: number;
  note: string | null;
}

export async function insertMeasurements(db: SQLiteDatabase, items: NewMeasurement[]): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const m of items) {
      await db.runAsync(
        `INSERT INTO measurement (id, code, value, raw, measured_at, tz_offset_min, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), m.code, m.value, m.raw, m.measuredAt, -new Date(m.measuredAt).getTimezoneOffset(), m.note, now, now,
      );
    }
  });
}

export async function updateMeasurement(db: SQLiteDatabase, id: string, m: Omit<NewMeasurement, 'code'>): Promise<void> {
  await db.runAsync(
    'UPDATE measurement SET value = ?, raw = ?, measured_at = ?, tz_offset_min = ?, note = ?, updated_at = ? WHERE id = ?',
    m.value, m.raw, m.measuredAt, -new Date(m.measuredAt).getTimezoneOffset(), m.note, Date.now(), id,
  );
}

export async function deleteMeasurement(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE measurement SET deleted = 1, updated_at = ? WHERE id = ?', Date.now(), id);
}

export async function saveRange(db: SQLiteDatabase, code: string, range: Range): Promise<void> {
  await db.runAsync('UPDATE parameter_setting SET min = ?, max = ?, updated_at = ? WHERE code = ?', range.min, range.max, Date.now(), code);
}

export async function saveLayout(db: SQLiteDatabase, settings: ParameterSetting[]): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const [i, s] of settings.entries()) {
      await db.runAsync(
        'UPDATE parameter_setting SET visible = ?, pinned = ?, sort = ?, updated_at = ? WHERE code = ?',
        s.visible ? 1 : 0, s.pinned ? 1 : 0, i, now, s.code,
      );
    }
  });
}

export async function getKv(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setKv(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// ---- Events (water changes, filter cleaning) -------------------------------

export async function loadEvents(db: SQLiteDatabase): Promise<TankEvent[]> {
  const rows = await db.getAllAsync<{ id: string; kind: TankEvent['kind']; at: number; percent: number | null; note: string | null }>(
    'SELECT id, kind, at, percent, note FROM event WHERE deleted = 0 ORDER BY at',
  );
  return rows;
}

export async function insertEvent(db: SQLiteDatabase, e: Omit<TankEvent, 'id'>): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO event (id, kind, at, percent, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, e.kind, e.at, e.percent, e.note, now, now,
  );
  return id;
}

export async function updateEvent(db: SQLiteDatabase, id: string, e: Omit<TankEvent, 'id' | 'kind'>): Promise<void> {
  await db.runAsync('UPDATE event SET at = ?, percent = ?, note = ?, updated_at = ? WHERE id = ?', e.at, e.percent, e.note, Date.now(), id);
}

export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE event SET deleted = 1, updated_at = ? WHERE id = ?', Date.now(), id);
}

// ---- Tasks -------------------------------------------------------------------

interface TaskRow {
  id: string; title: string; frequency: Task['frequency']; weekday: number | null; every_days: number | null;
  time: string | null; action: Task['action']; sort: number;
}

export async function loadTasks(db: SQLiteDatabase): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>('SELECT id, title, frequency, weekday, every_days, time, action, sort FROM task WHERE deleted = 0 ORDER BY sort');
  return rows.map(({ every_days, ...r }) => ({ ...r, everyDays: every_days }));
}

export async function saveTask(db: SQLiteDatabase, t: Omit<Task, 'id' | 'sort'> & { id?: string; sort?: number }): Promise<void> {
  const now = Date.now();
  if (t.id) {
    await db.runAsync(
      'UPDATE task SET title = ?, frequency = ?, weekday = ?, every_days = ?, time = ?, action = ?, updated_at = ? WHERE id = ?',
      t.title, t.frequency, t.weekday, t.everyDays, t.time, t.action, now, t.id,
    );
    return;
  }
  const max = await db.getFirstAsync<{ s: number | null }>('SELECT MAX(sort) AS s FROM task');
  await db.runAsync(
    'INSERT INTO task (id, title, frequency, weekday, every_days, time, action, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    randomUUID(), t.title, t.frequency, t.weekday, t.everyDays, t.time, t.action, (max?.s ?? -1) + 1, now,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE task SET deleted = 1, updated_at = ? WHERE id = ?', Date.now(), id);
}

export async function loadTaskDone(db: SQLiteDatabase, since: number): Promise<TaskDone[]> {
  const rows = await db.getAllAsync<{ id: string; task_id: string; period: string; done_at: number }>(
    'SELECT id, task_id, period, done_at FROM task_done WHERE deleted = 0 AND done_at >= ?', since,
  );
  return rows.map((r) => ({ id: r.id, taskId: r.task_id, period: r.period, doneAt: r.done_at }));
}

/** Marks a task done for `period`, or undoes it. */
export async function setTaskDone(db: SQLiteDatabase, taskId: string, period: string, done: boolean, at = Date.now()): Promise<void> {
  const now = Date.now();
  if (done) {
    const existing = await db.getFirstAsync('SELECT id FROM task_done WHERE task_id = ? AND period = ? AND deleted = 0', taskId, period);
    if (existing) return;
    await db.runAsync('INSERT INTO task_done (id, task_id, period, done_at, updated_at) VALUES (?, ?, ?, ?, ?)', randomUUID(), taskId, period, at, now);
  } else {
    await db.runAsync('UPDATE task_done SET deleted = 1, updated_at = ? WHERE task_id = ? AND period = ? AND deleted = 0', now, taskId, period);
  }
}

// ---- Alerts --------------------------------------------------------------------

export async function loadDismissals(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ key: string }>('SELECT key FROM alert_dismissal');
  return new Set(rows.map((r) => r.key));
}

export async function dismissAlert(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO alert_dismissal (key, at) VALUES (?, ?)', key, Date.now());
}

// ---- Backup ---------------------------------------------------------------

export const BACKUP_FORMAT = 'aquahelper-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  tables: Partial<Record<keyof typeof COLUMNS, Record<string, unknown>[]>>;
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(
      await Promise.all((Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map(async (t) => [t, await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`)])),
    ),
  };
}

const COLUMNS = {
  measurement: ['id', 'code', 'value', 'raw', 'measured_at', 'tz_offset_min', 'note', 'created_at', 'updated_at', 'deleted'],
  parameter_setting: ['code', 'min', 'max', 'visible', 'pinned', 'sort', 'updated_at'],
  kv: ['key', 'value'],
  event: ['id', 'kind', 'at', 'percent', 'note', 'created_at', 'updated_at', 'deleted'],
  task: ['id', 'title', 'frequency', 'weekday', 'every_days', 'time', 'action', 'sort', 'updated_at', 'deleted'],
  task_done: ['id', 'task_id', 'period', 'done_at', 'updated_at', 'deleted'],
  alert_dismissal: ['key', 'at'],
} as const;

/** Replaces all data with the backup's contents, in one transaction. */
export async function importBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  if (backup?.format !== BACKUP_FORMAT || backup.version !== 1) throw new Error('This file is not an aquaHelper backup.');
  await db.withTransactionAsync(async () => {
    for (const table of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
      const cols = COLUMNS[table];
      // Tables missing from an older backup are left as they are.
      const rows = backup.tables[table];
      if (!rows) continue;
      await db.runAsync(`DELETE FROM ${table}`);
      for (const row of rows) {
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => (row[c] ?? null) as string | number | null),
        );
      }
    }
  });
}
