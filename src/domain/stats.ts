import type { Measurement } from './types';

export type Period = '7d' | '30d' | 'all';

export const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30 };

const DAY_MS = 24 * 3600_000;

/** Measurements inside the period, oldest first. */
export function inPeriod(series: Measurement[], period: Period, now: number): Measurement[] {
  const sorted = [...series].sort((a, b) => a.measuredAt - b.measuredAt);
  if (period === 'all') return sorted;
  const from = now - PERIOD_DAYS[period] * DAY_MS;
  return sorted.filter((m) => m.measuredAt >= from && m.measuredAt <= now);
}

export interface Summary {
  count: number;
  latest: number | null;
  previous: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
}

/** Summary over a series sorted oldest first. */
export function summarize(series: Measurement[]): Summary {
  const n = series.length;
  if (n === 0) return { count: 0, latest: null, previous: null, average: null, min: null, max: null };
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const m of series) {
    sum += m.value;
    if (m.value < min) min = m.value;
    if (m.value > max) max = m.value;
  }
  return {
    count: n,
    latest: series[n - 1].value,
    previous: n > 1 ? series[n - 2].value : null,
    average: sum / n,
    min,
    max,
  };
}
