import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import type { Measurement, Range } from '@/domain/types';

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

// ---- Backup ---------------------------------------------------------------

export const BACKUP_FORMAT = 'aquahelper-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  tables: Record<'measurement' | 'parameter_setting' | 'kv', Record<string, unknown>[]>;
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      measurement: await db.getAllAsync('SELECT * FROM measurement'),
      parameter_setting: await db.getAllAsync('SELECT * FROM parameter_setting'),
      kv: await db.getAllAsync('SELECT * FROM kv'),
    },
  };
}

const COLUMNS = {
  measurement: ['id', 'code', 'value', 'raw', 'measured_at', 'tz_offset_min', 'note', 'created_at', 'updated_at', 'deleted'],
  parameter_setting: ['code', 'min', 'max', 'visible', 'pinned', 'sort', 'updated_at'],
  kv: ['key', 'value'],
} as const;

/** Replaces all data with the backup's contents, in one transaction. */
export async function importBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  if (backup?.format !== BACKUP_FORMAT || backup.version !== 1) throw new Error('This file is not an aquaHelper backup.');
  await db.withTransactionAsync(async () => {
    for (const table of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
      const cols = COLUMNS[table];
      await db.runAsync(`DELETE FROM ${table}`);
      for (const row of backup.tables[table] ?? []) {
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => (row[c] ?? null) as string | number | null),
        );
      }
    }
  });
}
