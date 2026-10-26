import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { computeSeries } from '@/domain/chemistry';
import { getParameter, PARAMETERS } from '@/domain/parameters';
import { statusFor } from '@/domain/status';
import type { Measurement, Range, Status } from '@/domain/types';
import * as repo from './repo';

/**
 * App-wide data. The whole history fits comfortably in memory for one
 * aquarium (years of tests are a few thousand rows), so screens read from
 * here and every write reloads from SQLite, which stays the source of truth.
 */
interface Store {
  ready: boolean;
  aquariumName: string;
  settings: repo.ParameterSetting[];
  /** Series per parameter code, oldest first; computed codes included. */
  series: Record<string, Measurement[]>;
  latest(code: string): Measurement | undefined;
  status(code: string): Status;
  range(code: string): Range;
  addMeasurements(items: repo.NewMeasurement[]): Promise<void>;
  updateMeasurement(id: string, m: Omit<repo.NewMeasurement, 'code'>): Promise<void>;
  deleteMeasurement(id: string): Promise<void>;
  saveRange(code: string, range: Range): Promise<void>;
  saveLayout(settings: repo.ParameterSetting[]): Promise<void>;
  setAquariumName(name: string): Promise<void>;
  exportBackup(): Promise<repo.Backup>;
  importBackup(b: repo.Backup): Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [settings, setSettings] = useState<repo.ParameterSetting[]>([]);
  const [aquariumName, setName] = useState('');

  const reload = useCallback(async () => {
    const [m, s, n] = await Promise.all([repo.loadMeasurements(db), repo.loadSettings(db), repo.getKv(db, 'aquarium_name')]);
    setMeasurements(m);
    setSettings(s);
    setName(n ?? '');
    setReady(true);
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Store>(() => {
    const series: Record<string, Measurement[]> = {};
    for (const m of measurements) (series[m.code] ??= []).push(m);
    for (const p of PARAMETERS) if (p.kind === 'computed') series[p.code] = computeSeries(p.code, series);

    const settingFor = new Map(settings.map((s) => [s.code, s]));
    const range = (code: string): Range => {
      const s = settingFor.get(code);
      return { min: s?.min ?? null, max: s?.max ?? null };
    };
    const latest = (code: string) => series[code]?.at(-1);

    const after = <A extends unknown[]>(fn: (...a: A) => Promise<void>) => async (...a: A) => {
      await fn(...a);
      await reload();
    };

    return {
      ready,
      aquariumName,
      settings: settings.filter((s) => getParameter(s.code)),
      series,
      latest,
      range,
      status: (code) => statusFor(latest(code)?.value, range(code)),
      addMeasurements: after((items) => repo.insertMeasurements(db, items)),
      updateMeasurement: after((id, m) => repo.updateMeasurement(db, id, m)),
      deleteMeasurement: after((id) => repo.deleteMeasurement(db, id)),
      saveRange: after((code, r) => repo.saveRange(db, code, r)),
      saveLayout: after((s) => repo.saveLayout(db, s)),
      setAquariumName: after((name) => repo.setKv(db, 'aquarium_name', name)),
      exportBackup: () => repo.exportBackup(db),
      importBackup: after((b) => repo.importBackup(db, b)),
    };
  }, [db, ready, measurements, settings, aquariumName, reload]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
