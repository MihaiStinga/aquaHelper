import type { Measurement, TankEvent } from './types';

const HOUR = 3600_000;

export const EVENT_LABEL: Record<TankEvent['kind'], string> = {
  water_change: 'Water change',
  filter_clean: 'Filter cleaned',
};

/** Latest event of `kind` at or before `at` (events sorted oldest first). */
export function lastEventBefore(events: TankEvent[], kind: TankEvent['kind'], at: number): TankEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === kind && e.at <= at) return e;
  }
  return undefined;
}

export interface WaterChangeContext {
  change: TankEvent;
  hoursAfter: number;
}

/** Which water change a test came after, and how long after it. */
export function waterChangeContext(m: Measurement, events: TankEvent[]): WaterChangeContext | undefined {
  const change = lastEventBefore(events, 'water_change', m.measuredAt);
  return change ? { change, hoursAfter: (m.measuredAt - change.at) / HOUR } : undefined;
}

/** "3 h", "2 days" — coarse on purpose, for labels. */
export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  const d = Math.round(hours / 24);
  return `${d} days`;
}

export function describeContext(ctx: WaterChangeContext | undefined): string | null {
  if (!ctx) return null;
  const pct = ctx.change.percent != null ? `${Math.round(ctx.change.percent)}% ` : '';
  return `${formatDuration(ctx.hoursAfter)} after ${pct}water change`;
}

export function daysSince(at: number, now: number): number {
  return (now - at) / (24 * HOUR);
}
