/** "Nice" step (1, 2, 2.5, 5 × 10^n) for about `count` intervals over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export interface YScale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Y domain fitted to the data (not forced to 0), widened to show the ideal
 * band when it is nearby, and snapped to nice ticks. A flat series gets a
 * small band around its value so the line sits in the middle.
 */
export function yScale(values: number[], band?: { min: number | null; max: number | null }, count = 4): YScale {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (band) {
    // Include the band only when it is within one data span, so one outlier
    // range does not flatten the line.
    const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1);
    if (band.min != null && band.min >= lo - span) lo = Math.min(lo, band.min);
    if (band.max != null && band.max <= hi + span) hi = Math.max(hi, band.max);
  }
  if (hi === lo) {
    const pad = Math.abs(hi) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min, max, ticks };
}
