import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { computeSeries } from '@/domain/chemistry';
import { getParameter, PARAMETERS } from '@/domain/parameters';
import { evaluateRules, mergeRules, type Alert, type Rule, type RuleContext } from '@/domain/rules';
import { statusFor } from '@/domain/status';
import { DEFAULT_WATER_CHANGE_STEPS, type Task, type TaskDone } from '@/domain/tasks';
import type { Measurement, Range, Status, TankEvent } from '@/domain/types';
import defaultRules from '@/rules/default-rules.json';
import * as repo from './repo';

const DEFAULT_RULES = defaultRules as Rule[];

export interface NotifySettings {
  enabled: boolean;
  /** "HH:MM" local time of the daily digest. */
  time: string;
}

/**
 * App-wide data. The whole history fits comfortably in memory for one
 * aquarium (years of tests are a few thousand rows), so screens read from
 * here and every write reloads from SQLite, which stays the source of truth.
 */
interface Store {
  ready: boolean;
  /** Bumps on every reload, so effects can react to any data change. */
  version: number;
  aquariumName: string;
  volumeL: number | null;
  settings: repo.ParameterSetting[];
  /** Series per parameter code, oldest first; computed codes included. */
  series: Record<string, Measurement[]>;
  /** Water changes and maintenance, oldest first. */
  events: TankEvent[];
  tasks: Task[];
  taskDone: TaskDone[];
  waterChangeSteps: string[];
  rules: Rule[];
  customRules: Rule[];
  notify: NotifySettings;
  /** Active, not dismissed. */
  alerts: Alert[];
  ruleContext(now?: number): RuleContext;
  dismissed: Set<string>;
  latest(code: string): Measurement | undefined;
  status(code: string): Status;
  range(code: string): Range;
  addMeasurements(items: repo.NewMeasurement[]): Promise<void>;
  updateMeasurement(id: string, m: Omit<repo.NewMeasurement, 'code'>): Promise<void>;
  deleteMeasurement(id: string): Promise<void>;
  saveRange(code: string, range: Range): Promise<void>;
  saveLayout(settings: repo.ParameterSetting[]): Promise<void>;
  setAquariumName(name: string): Promise<void>;
  setVolume(litres: number | null): Promise<void>;
  addEvent(e: Omit<TankEvent, 'id'>): Promise<string>;
  updateEvent(id: string, e: Omit<TankEvent, 'id' | 'kind'>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  saveTask(t: Omit<Task, 'id' | 'sort'> & { id?: string }): Promise<void>;
  deleteTask(id: string): Promise<void>;
  setTaskDone(taskId: string, period: string, done: boolean): Promise<void>;
  setWaterChangeSteps(steps: string[]): Promise<void>;
  setRuleEnabled(id: string, enabled: boolean): Promise<void>;
  setCustomRules(rules: Rule[]): Promise<void>;
  dismissAlert(key: string): Promise<void>;
  setNotify(n: NotifySettings): Promise<void>;
  exportBackup(): Promise<repo.Backup>;
  importBackup(b: repo.Backup): Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

const json = <T,>(text: string | null, fallback: T): T => {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

interface Loaded {
  measurements: Measurement[];
  settings: repo.ParameterSetting[];
  events: TankEvent[];
  tasks: Task[];
  taskDone: TaskDone[];
  dismissed: Set<string>;
  kv: Record<string, string | null>;
}

const KV_KEYS = ['aquarium_name', 'aquarium_volume_l', 'water_change_steps', 'custom_rules', 'rules_enabled', 'notify_time', 'notify_enabled'];

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // Re-evaluate time-based rules (e.g. "no water change in 14 days") every minute.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(async () => {
    const [measurements, settings, events, tasks, taskDone, dismissed, ...kvValues] = await Promise.all([
      repo.loadMeasurements(db),
      repo.loadSettings(db),
      repo.loadEvents(db),
      repo.loadTasks(db),
      repo.loadTaskDone(db, Date.now() - 400 * 24 * 3600_000),
      repo.loadDismissals(db),
      ...KV_KEYS.map((k) => repo.getKv(db, k)),
    ]);
    setData({ measurements, settings, events, tasks, taskDone, dismissed, kv: Object.fromEntries(KV_KEYS.map((k, i) => [k, kvValues[i]])) });
    setVersion((v) => v + 1);
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Store>(() => {
    const d = data ?? { measurements: [], settings: [], events: [], tasks: [], taskDone: [], dismissed: new Set<string>(), kv: {} };
    const series: Record<string, Measurement[]> = {};
    for (const m of d.measurements) (series[m.code] ??= []).push(m);
    for (const p of PARAMETERS) if (p.kind === 'computed') series[p.code] = computeSeries(p.code, series);

    const settingFor = new Map(d.settings.map((s) => [s.code, s]));
    const range = (code: string): Range => {
      const s = settingFor.get(code);
      return { min: s?.min ?? null, max: s?.max ?? null };
    };
    const latest = (code: string) => series[code]?.at(-1);

    const customRules = json<Rule[]>(d.kv.custom_rules, []);
    const rules = mergeRules(DEFAULT_RULES, customRules, json<Record<string, boolean>>(d.kv.rules_enabled, {}));
    const ruleContext = (at = Date.now()): RuleContext => ({ now: at, series, range, events: d.events });
    const alerts = evaluateRules(rules, ruleContext(now)).filter((a) => !d.dismissed.has(a.key));

    const after = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
      const r = await fn(...a);
      await reload();
      return r;
    };
    const setKv = (key: string, v: string) => repo.setKv(db, key, v);
    const volume = d.kv.aquarium_volume_l ? Number(d.kv.aquarium_volume_l) : null;

    return {
      ready: data != null,
      version,
      aquariumName: d.kv.aquarium_name ?? '',
      volumeL: volume && Number.isFinite(volume) ? volume : null,
      settings: d.settings.filter((s) => getParameter(s.code)),
      series,
      events: d.events,
      tasks: d.tasks,
      taskDone: d.taskDone,
      waterChangeSteps: json<string[]>(d.kv.water_change_steps, DEFAULT_WATER_CHANGE_STEPS),
      rules,
      customRules,
      notify: { enabled: d.kv.notify_enabled !== '0', time: d.kv.notify_time || '14:00' },
      alerts,
      dismissed: d.dismissed,
      ruleContext,
      latest,
      range,
      status: (code) => statusFor(latest(code)?.value, range(code)),
      addMeasurements: after((items) => repo.insertMeasurements(db, items)),
      updateMeasurement: after((id, m) => repo.updateMeasurement(db, id, m)),
      deleteMeasurement: after((id) => repo.deleteMeasurement(db, id)),
      saveRange: after((code, r) => repo.saveRange(db, code, r)),
      saveLayout: after((s) => repo.saveLayout(db, s)),
      setAquariumName: after((name) => setKv('aquarium_name', name)),
      setVolume: after((l) => setKv('aquarium_volume_l', l == null ? '' : String(l))),
      addEvent: after((e) => repo.insertEvent(db, e)),
      updateEvent: after((id, e) => repo.updateEvent(db, id, e)),
      deleteEvent: after((id) => repo.deleteEvent(db, id)),
      saveTask: after((t) => repo.saveTask(db, t)),
      deleteTask: after((id) => repo.deleteTask(db, id)),
      setTaskDone: after((id, period, done) => repo.setTaskDone(db, id, period, done)),
      setWaterChangeSteps: after((steps) => setKv('water_change_steps', JSON.stringify(steps))),
      setRuleEnabled: after((id, on) => setKv('rules_enabled', JSON.stringify({ ...json<Record<string, boolean>>(d.kv.rules_enabled, {}), [id]: on }))),
      setCustomRules: after((r) => setKv('custom_rules', JSON.stringify(r))),
      dismissAlert: after((key) => repo.dismissAlert(db, key)),
      setNotify: after(async (n) => {
        await setKv('notify_enabled', n.enabled ? '1' : '0');
        await setKv('notify_time', n.time);
      }),
      exportBackup: () => repo.exportBackup(db),
      importBackup: after((b) => repo.importBackup(db, b)),
    };
  }, [db, data, version, now, reload]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
