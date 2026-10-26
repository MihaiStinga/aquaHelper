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
