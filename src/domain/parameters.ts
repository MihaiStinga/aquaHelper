// Catalogue of every water parameter the app knows about.
// Measured parameters are typed in by the user; computed ones are derived
// from other measurements (see chemistry.ts) and are never stored.

export type ParameterKind = 'measured' | 'computed';

export interface ParameterDef {
  code: string;
  /** Name as shown on cards; may contain sub/superscript unicode. */
  name: string;
  unit: string;
  decimals: number;
  kind: ParameterKind;
  /** For computed parameters: which measured codes feed them. */
  inputs?: string[];
}

export const PARAMETERS: ParameterDef[] = [
  { code: 'ph', name: 'pH', unit: '', decimals: 1, kind: 'measured' },
  { code: 'temp', name: 'Temperature', unit: '°C', decimals: 1, kind: 'measured' },
  // Test kits read total ammonia (NH₃ + NH₄⁺); the toxic share is nh3_free below.
  { code: 'nh3', name: 'Ammonia (NH₃)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'no2', name: 'Nitrite (NO₂⁻)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'no3', name: 'Nitrate (NO₃⁻)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'kh', name: 'KH (Carbonate Hardness)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'gh', name: 'GH (General Hardness)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'po4', name: 'Phosphate (PO₄³⁻)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'k', name: 'Potassium (K)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'fe', name: 'Iron (Fe)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'ca', name: 'Calcium (Ca²⁺)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'si', name: 'Silicate (SiO₂)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'cl', name: 'Chlorine', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'o2', name: 'Dissolved Oxygen', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'tds', name: 'TDS (Total Dissolved Solids)', unit: 'ppm', decimals: 1, kind: 'measured' },
  { code: 'salinity', name: 'Salinity', unit: 'ppt', decimals: 1, kind: 'measured' },
  { code: 'co2', name: 'CO₂', unit: 'ppm', decimals: 1, kind: 'computed', inputs: ['kh', 'ph'] },
  // Free ammonia is usually a few hundredths of a ppm, so one decimal would show 0.0.
  { code: 'nh3_free', name: 'Free Ammonia (NH₃)', unit: 'ppm', decimals: 2, kind: 'computed', inputs: ['nh3', 'ph', 'temp'] },
];

const byCode = new Map(PARAMETERS.map((p) => [p.code, p]));

export function getParameter(code: string): ParameterDef | undefined {
  return byCode.get(code);
}

export const MEASURED_PARAMETERS = PARAMETERS.filter((p) => p.kind === 'measured');

/** Parameters shown on the Aquarium screen before the user picks their own. */
export const DEFAULT_PINNED = ['ph', 'temp', 'nh3', 'no3'];
