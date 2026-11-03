export interface Measurement {
  id: string;
  code: string;
  value: number;
  /** Epoch milliseconds (UTC). */
  measuredAt: number;
  note: string | null;
}

export interface Range {
  min: number | null;
  max: number | null;
}

export type Status = 'low' | 'ideal' | 'high' | 'none';

export type EventKind = 'water_change' | 'filter_clean';

/** Something done to the tank, as opposed to something measured. */
export interface TankEvent {
  id: string;
  kind: EventKind;
  /** Epoch milliseconds (UTC). */
  at: number;
  /** Share of the water replaced, 0–100 (water changes only). */
  percent: number | null;
  note: string | null;
}
