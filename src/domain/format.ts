/** Rounds half away from zero at `decimals`, avoiding binary float artefacts (1.005 → 1.01). */
export function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  const shifted = Number((Math.abs(value) * f).toPrecision(15));
  return (Math.sign(value) * Math.round(shifted)) / f;
}

export function formatValue(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return round(value, decimals).toFixed(decimals);
}

/**
 * Parses user input. Accepts a comma as decimal separator (Romanian keyboards)
 * and rejects anything that isn't a plain finite number.
 */
export function parseValue(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function relativeTime(at: number, now: number): string {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return 'a few seconds ago';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'a minute ago' : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'an hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'a day ago' : `${d} days ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return mo === 1 ? 'a month ago' : `${mo} months ago`;
  const y = Math.round(d / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(at: number): string {
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function dateTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${shortDate(at)} ${d.getFullYear()}, ${hh}:${mm}`;
}
