import { describe, expect, it } from 'vitest';
import { co2FromKhPh, computeSeries, freeAmmonia } from './chemistry';
import { formatValue, parseValue, round } from './format';
import { statusFor } from './status';
import { inPeriod, summarize } from './stats';
import { yScale } from './chartScale';
import type { Measurement } from './types';

const H = 3600_000;
const m = (code: string, value: number, at: number, id = `${code}${at}`): Measurement => ({ id, code, value, measuredAt: at, note: null });

describe('status', () => {
  it('classifies against inclusive bounds', () => {
    const r = { min: 24, max: 26 };
    expect(statusFor(20.5, r)).toBe('low');
    expect(statusFor(24, r)).toBe('ideal');
    expect(statusFor(26, r)).toBe('ideal');
    expect(statusFor(26.1, r)).toBe('high');
  });
  it('supports one-sided ranges and never invents one', () => {
    expect(statusFor(0.1, { min: null, max: 0 })).toBe('high');
    expect(statusFor(5, { min: null, max: null })).toBe('none');
    expect(statusFor(null, { min: 1, max: 2 })).toBe('none');
  });
});

describe('format', () => {
  it('rounds without float artefacts', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(-0.25, 1)).toBe(-0.3);
    expect(formatValue(20.45, 1)).toBe('20.5');
    expect(formatValue(null, 1)).toBe('–');
  });
  it('parses comma decimals and rejects junk', () => {
    expect(parseValue('7,4')).toBe(7.4);
    expect(parseValue(' 0.8 ')).toBe(0.8);
    expect(parseValue('7.4.1')).toBeNull();
    expect(parseValue('abc')).toBeNull();
    expect(parseValue('')).toBeNull();
  });
});

describe('chemistry', () => {
  it('computes CO2 from KH and pH', () => {
    // 4 dKH at pH 7.0 → 12 ppm
    expect(co2FromKhPh(4 * 17.848, 7)).toBeCloseTo(12, 6);
    expect(co2FromKhPh(4 * 17.848, 6.8)).toBeCloseTo(19.02, 2);
  });
  it('computes free ammonia (Emerson)', () => {
    // At pH 7 and 25 °C about 0.56% of total ammonia is NH3.
    expect(freeAmmonia(1, 7, 25)).toBeCloseTo(0.0056, 4);
    // Emerson table: 5.38% at pH 8, 25 °C.
    expect(freeAmmonia(1, 8, 25)).toBeCloseTo(0.0538, 3);
  });
  it('pairs inputs only inside their windows', () => {
    const t = 1_000 * H;
    const series = computeSeries('co2', {
      ph: [m('ph', 7, t), m('ph', 7, t + 30 * 24 * H)],
      kh: [m('kh', 4 * 17.848, t - 2 * 24 * H)],
    });
    // Second pH reading is 32 days after the KH reading: no point.
    expect(series).toHaveLength(1);
    expect(series[0].value).toBeCloseTo(12, 6);
  });
  it('does not pair with future readings', () => {
    const t = 1_000 * H;
    expect(computeSeries('nh3_free', { nh3: [m('nh3', 1, t)], ph: [m('ph', 7, t + H)], temp: [m('temp', 25, t)] })).toHaveLength(0);
  });
});

describe('stats', () => {
  const now = 100 * 24 * H;
  const series = [m('t', 20, now - 10 * 24 * H), m('t', 24, now - 2 * 24 * H), m('t', 25, now - H)];
  it('filters to the period without inventing points', () => {
    expect(inPeriod(series, '7d', now).map((x) => x.value)).toEqual([24, 25]);
    expect(inPeriod(series, 'all', now)).toHaveLength(3);
  });
  it('summarizes', () => {
    expect(summarize(inPeriod(series, 'all', now))).toEqual({ count: 3, latest: 25, previous: 24, average: 23, min: 20, max: 25 });
    expect(summarize([]).latest).toBeNull();
  });
});

describe('yScale', () => {
  it('fits the data instead of starting at zero', () => {
    const s = yScale([24.2, 25.1]);
    expect(s.min).toBeGreaterThan(20);
    expect(s.ticks.at(0)).toBe(s.min);
    expect(s.ticks.at(-1)).toBe(s.max);
  });
  it('handles a single value', () => {
    const s = yScale([20.5]);
    expect(s.min).toBeLessThan(20.5);
    expect(s.max).toBeGreaterThan(20.5);
  });
});
