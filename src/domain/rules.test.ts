import { describe, expect, it } from 'vitest';
import defaults from '../rules/default-rules.json';
import { evaluateRules, mergeRules, validateRules, type Rule, type RuleContext } from './rules';
import { dayKey, isDone, isDueOn, periodKey, sectionOf, weekKey, type Task } from './tasks';
import { describeContext, waterChangeContext } from './events';
import { computeSeries } from './chemistry';
import type { Measurement, TankEvent } from './types';

const H = 3600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 26, 12);
const m = (code: string, value: number, at: number): Measurement => ({ id: `${code}@${at}`, code, value, measuredAt: at, note: null });
const wc = (at: number, percent = 30): TankEvent => ({ id: `wc@${at}`, kind: 'water_change', at, percent, note: null });

function ctx(measurements: Measurement[], events: TankEvent[] = [], ranges: Record<string, [number | null, number | null]> = {}, now = NOW): RuleContext {
  const series: Record<string, Measurement[]> = {};
  for (const x of [...measurements].sort((a, b) => a.measuredAt - b.measuredAt)) (series[x.code] ??= []).push(x);
  series.co2 = computeSeries('co2', series);
  series.nh3_free = computeSeries('nh3_free', series);
  return {
    now,
    series,
    events: [...events].sort((a, b) => a.at - b.at),
    range: (c) => ({ min: ranges[c]?.[0] ?? null, max: ranges[c]?.[1] ?? null }),
  };
}

const RULES = defaults as Rule[];
const ids = (c: RuleContext) => evaluateRules(RULES, c).map((a) => a.ruleId);

describe('default rules file', () => {
  it('is valid', () => {
    expect(validateRules(defaults)).toEqual([]);
  });
});

describe('rule engine', () => {
  it('fires the pH > 7.5 neon rule with the value in the title', () => {
    const alerts = evaluateRules(RULES, ctx([m('ph', 7.6, NOW - H)]));
    const neon = alerts.find((a) => a.ruleId === 'ph-neons');
    expect(neon?.title).toBe('pH 7.6: watch the neons');
  });

  it('ignores stale readings', () => {
    expect(ids(ctx([m('ph', 7.6, NOW - 10 * D)]))).not.toContain('ph-neons');
  });

  it('flags ammonia 2 days after a water change as an imbalance', () => {
    const alerts = evaluateRules(RULES, ctx([m('nh3', 0.25, NOW - H)], [wc(NOW - 2 * D - H, 30)]));
    const a = alerts.find((x) => x.ruleId === 'nh3-after-water-change');
    expect(a?.severity).toBe('critical');
    expect(a?.message).toContain('2.0 days after a 30% water change');
  });

  it('does not call ammonia right after a water change an imbalance', () => {
    expect(ids(ctx([m('nh3', 0.25, NOW - H)], [wc(NOW - 3 * H)]))).not.toContain('nh3-after-water-change');
  });

  it('uses severity bands without double alerts', () => {
    expect(ids(ctx([m('nh3', 0.5, NOW - H)]))).toContain('nh3-present');
    const high = ids(ctx([m('nh3', 1.5, NOW - H)]));
    expect(high).toContain('nh3-high');
    expect(high).not.toContain('nh3-present');
  });

  it('computes toxic free ammonia from pH and temperature', () => {
    const c = ctx([m('ph', 8, NOW - 2 * H), m('temp', 26, NOW - 2 * H), m('nh3', 0.5, NOW - H)]);
    expect(ids(c)).toContain('nh3-free-toxic');
  });

  it('detects trends and swings', () => {
    expect(ids(ctx([m('no3', 10, NOW - 6 * D), m('no3', 30, NOW - H)]))).toContain('no3-climbing');
    expect(ids(ctx([m('ph', 6.4, NOW - 10 * H), m('ph', 7.2, NOW - H)]))).toContain('ph-swing');
  });

  it('checks the NO3:PO4 ratio', () => {
    expect(ids(ctx([m('no3', 2, NOW - H), m('po4', 1, NOW - H)]))).toContain('no3-po4-ratio-low');
    expect(ids(ctx([m('no3', 20, NOW - H), m('po4', 0.5, NOW - H)]))).toContain('no3-po4-ratio-high');
  });

  it('combines conditions', () => {
    // KH 1 dKH at pH 6.4 → ~12 ppm CO2: no oxygen risk. KH 5 dKH at pH 6.5 → ~47 ppm.
    const c = ctx([m('temp', 28, NOW - H), m('kh', 5 * 17.848, NOW - D), m('ph', 6.5, NOW - H)]);
    expect(ids(c)).toEqual(expect.arrayContaining(['low-oxygen-risk', 'co2-dangerous']));
  });

  it('reminds about water changes and filter cleaning', () => {
    expect(ids(ctx([], [wc(NOW - 9 * D)]))).toContain('water-change-due');
    expect(ids(ctx([], [wc(NOW - 15 * D)]))).toContain('water-change-overdue');
    const filter: TankEvent = { id: 'f', kind: 'filter_clean', at: NOW - 85 * D, percent: null, note: null };
    expect(ids(ctx([], [filter]))).toContain('filter-clean-soon');
  });

  it('lists stale tests by name', () => {
    const a = evaluateRules(RULES, ctx([m('no3', 10, NOW - 8 * D), m('ph', 7, NOW - H)])).find((x) => x.ruleId === 'weekly-tests');
    expect(a?.title).toBe('Time to test: Nitrate');
  });

  it('emits one alert per parameter outside its ideal range', () => {
    const c = ctx([m('ph', 6.5, NOW - H), m('temp', 30, NOW - H)], [], { ph: [6.8, 7.2], temp: [24, 26] });
    expect(evaluateRules(RULES, c).filter((a) => a.ruleId === 'outside-ideal')).toHaveLength(2);
  });

  it('keys alerts by their evidence so a dismissal lasts until new data', () => {
    const k1 = evaluateRules(RULES, ctx([m('ph', 7.6, NOW - H)]))[0].key;
    const k2 = evaluateRules(RULES, ctx([m('ph', 7.6, NOW - H), m('ph', 7.7, NOW - 1000)]))[0].key;
    expect(k1).not.toBe(k2);
  });

  it('lets custom rules override defaults and be switched off', () => {
    const custom: Rule[] = [{ id: 'ph-neons', title: 'Custom', message: 'm', severity: 'info', when: { param: 'ph', op: '>', value: 7 } }];
    const merged = mergeRules(RULES, custom, { 'ph-low': false });
    expect(merged.find((r) => r.id === 'ph-neons')?.title).toBe('Custom');
    expect(merged.find((r) => r.id === 'ph-low')?.enabled).toBe(false);
  });

  it('reports problems in a custom rules file', () => {
    expect(validateRules({})).toHaveLength(1);
    expect(validateRules([{ id: 'x', title: 't', message: 'm', severity: 'loud', when: { param: 'nope', op: '>', value: 1 } }])).toHaveLength(2);
  });
});

describe('water change context', () => {
  it('describes how long after a change a test was taken', () => {
    const c = waterChangeContext(m('no3', 5, NOW), [wc(NOW - 3 * H, 25)]);
    expect(describeContext(c)).toBe('3 h after 25% water change');
    expect(waterChangeContext(m('no3', 5, NOW), [wc(NOW + H)])).toBeUndefined();
  });
});

describe('tasks', () => {
  const base: Task = { id: 't', title: 't', frequency: 'daily', weekday: null, everyDays: null, time: null, action: null, sort: 0 };
  const mon = new Date(2026, 9, 26); // Monday
  const sun = new Date(2026, 10, 1);

  it('uses Monday-based weeks', () => {
    expect(weekKey(mon)).toBe(weekKey(sun));
    expect(weekKey(new Date(2026, 10, 2))).not.toBe(weekKey(sun));
  });

  it('marks a weekly task done for the whole week', () => {
    const t = { ...base, frequency: 'weekly' as const };
    const done = [{ id: 'd', taskId: 't', period: periodKey(t, mon), doneAt: mon.getTime() }];
    expect(isDone(t, sun, done)).toBe(true);
    expect(isDone(t, new Date(2026, 10, 2), done)).toBe(false);
    expect(sectionOf(t)).toBe('week');
  });

  it('shows weekday tasks only on that day', () => {
    const t = { ...base, frequency: 'weekly' as const, weekday: 1 };
    expect(isDueOn(t, mon, [])).toBe(true);
    expect(isDueOn(t, sun, [])).toBe(false);
  });

  it('repeats interval tasks N days after the last completion', () => {
    const t = { ...base, frequency: 'interval' as const, everyDays: 3 };
    const done = [{ id: 'd', taskId: 't', period: dayKey(mon), doneAt: mon.getTime() + 9 * H }];
    expect(isDueOn(t, new Date(2026, 9, 27), done)).toBe(false);
    expect(isDueOn(t, new Date(2026, 9, 29), done)).toBe(true);
  });
});
