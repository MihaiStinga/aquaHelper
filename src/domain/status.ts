import type { Range, Status } from './types';

/**
 * Low / Ideal / High against the user's range. Bounds are inclusive and
 * either one may be missing (e.g. "nitrite: max 0"). Without any bound the
 * status is 'none', because the app never invents an ideal range.
 */
export function statusFor(value: number | null | undefined, range: Range | undefined): Status {
  if (value == null || !range || (range.min == null && range.max == null)) return 'none';
  if (range.min != null && value < range.min) return 'low';
  if (range.max != null && value > range.max) return 'high';
  return 'ideal';
}

export function needsAttention(status: Status): boolean {
  return status === 'low' || status === 'high';
}
