import type { Measurement } from './types';

/** 1 dKH = 17.848 ppm (mg/L) CaCO₃. */
export const PPM_PER_DKH = 17.848;

/**
 * Dissolved CO₂ from the KH/pH equilibrium: CO₂ = 3 × dKH × 10^(7 − pH).
 * Only valid when carbonates are the main buffer (no phosphate buffers,
 * humic acids, etc.), which is why the app labels it "calculated".
 */
export function co2FromKhPh(khPpm: number, ph: number): number {
  return 3 * (khPpm / PPM_PER_DKH) * Math.pow(10, 7 - ph);
}

/**
 * Un-ionised (toxic) ammonia from total ammonia (NH₃ + NH₄⁺), pH and
 * temperature, using the Emerson et al. (1975) pKa:
 *   pKa = 0.09018 + 2729.92 / T(K)
 *   fraction NH₃ = 1 / (10^(pKa − pH) + 1)
 */
export function freeAmmonia(totalPpm: number, ph: number, tempC: number): number {
  const pKa = 0.09018 + 2729.92 / (tempC + 273.15);
  return totalPpm / (Math.pow(10, pKa - ph) + 1);
}

/**
 * How far back a partner measurement may be to pair with a new one.
 * KH and temperature drift slowly; pH can swing during the day with CO₂
 * injection, so pH pairs only with nearby readings.
 */
export const PAIR_WINDOW_MS: Record<string, number> = {
  kh: 7 * 24 * 3600_000,
  ph: 3 * 3600_000,
  temp: 24 * 3600_000,
  nh3: 3 * 3600_000,
};

/** Latest measurement of `code` at or before `at`, within its pairing window. */
function partner(series: Measurement[], code: string, at: number): Measurement | undefined {
  const window = PAIR_WINDOW_MS[code] ?? 24 * 3600_000;
  let best: Measurement | undefined;
  for (const m of series) {
    if (m.measuredAt > at || at - m.measuredAt > window) continue;
    if (!best || m.measuredAt > best.measuredAt) best = m;
  }
  return best;
}

/**
 * Builds a derived series. One point is produced per measurement of the
 * `driver` input (the one that changes fastest), paired with the most recent
 * reading of every other input inside its window. Missing partners mean no
 * point: the app never guesses an input.
 */
function derive(
  code: string,
  driver: string,
  others: string[],
  byCode: Record<string, Measurement[]>,
  fn: (values: Record<string, number>) => number,
): Measurement[] {
  const out: Measurement[] = [];
  for (const d of byCode[driver] ?? []) {
    const values: Record<string, number> = { [driver]: d.value };
    let ok = true;
    for (const o of others) {
      const p = partner(byCode[o] ?? [], o, d.measuredAt);
      if (!p) { ok = false; break; }
      values[o] = p.value;
    }
    if (ok) out.push({ id: `${code}:${d.id}`, code, value: fn(values), measuredAt: d.measuredAt, note: null });
  }
  return out.sort((a, b) => a.measuredAt - b.measuredAt);
}

export function computeSeries(code: string, byCode: Record<string, Measurement[]>): Measurement[] {
  switch (code) {
    case 'co2':
      return derive('co2', 'ph', ['kh'], byCode, (v) => co2FromKhPh(v.kh, v.ph));
    case 'nh3_free':
      return derive('nh3_free', 'nh3', ['ph', 'temp'], byCode, (v) => freeAmmonia(v.nh3, v.ph, v.temp));
    default:
      return [];
  }
}
