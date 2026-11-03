import { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { yScale } from '@/domain/chartScale';
import { dateTime, formatValue, shortDate } from '@/domain/format';
import type { Period } from '@/domain/stats';
import type { Measurement, Range } from '@/domain/types';
import { useTheme } from '@/theme/theme';

const DAY = 24 * 3600_000;
const H = 300;
// SVG text does not inherit the page font on web.
const FONT = Platform.OS === 'web' ? 'Roboto, system-ui, sans-serif' : undefined;
const PAD = { left: 52, right: 20, top: 40, bottom: 44 };

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** X window and day ticks. 7/30 days end today; "all" spans first to last reading. */
function xWindow(period: Period, series: Measurement[], now: number) {
  if (period !== 'all') {
    const days = period === '7d' ? 7 : 30;
    const from = startOfDay(now) - (days - 1) * DAY;
    const step = period === '7d' ? 1 : 5;
    const ticks: number[] = [];
    for (let d = 0; d < days; d += step) ticks.push(from + d * DAY);
    if (period === '30d') ticks.push(startOfDay(now));
    // Points sit on their exact time; the last tick is today's midnight, so
    // the window runs to the end of today.
    return { from, to: startOfDay(now) + DAY - 1, ticks };
  }
  const first = startOfDay(series[0].measuredAt);
  const last = startOfDay(series.at(-1)!.measuredAt) + DAY - 1;
  const spanDays = Math.max(1, Math.round((last - first) / DAY));
  const step = Math.max(1, Math.ceil(spanDays / 5));
  const ticks: number[] = [];
  for (let d = 0; d <= spanDays; d += step) ticks.push(first + d * DAY);
  return { from: first, to: last, ticks };
}

/**
 * Line chart of real readings only: no zero-filled days, no smoothing
 * (a spline would draw values that were never measured), y-axis fitted to
 * the data, ideal range as a tinted band. Tap a point to read it exactly.
 */
export function LineChart({ series, period, range, decimals, now, markers = [] }: {
  series: Measurement[];
  period: Period;
  range: Range;
  decimals: number;
  now: number;
  /** Times of water changes, drawn as vertical lines. */
  markers?: number[];
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const geo = useMemo(() => {
    if (!series.length || !width) return null;
    const xw = xWindow(period, series, now);
    const ys = yScale(series.map((m) => m.value), range);
    const iw = width - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const X = (at: number) => PAD.left + ((at - xw.from) / Math.max(xw.to - xw.from, 1)) * iw;
    const Y = (v: number) => PAD.top + (1 - (v - ys.min) / (ys.max - ys.min)) * ih;
    const spacing = xw.ticks.length > 1 ? X(xw.ticks[1]) - X(xw.ticks[0]) : iw;
    const labelEvery = Math.max(1, Math.ceil(52 / spacing));
    return { xw, ys, X, Y, iw, ih, labelEvery };
  }, [series, width, period, range, now]);

  // Enough decimals that no two tick labels read the same (e.g. 0.45 vs 0.5).
  let tickDecimals = 0;
  if (geo) {
    tickDecimals = geo.ys.ticks.some((v) => !Number.isInteger(v)) ? Math.max(decimals, 1) : 0;
    while (tickDecimals < 4 && new Set(geo.ys.ticks.map((v) => v.toFixed(tickDecimals))).size < geo.ys.ticks.length) tickDecimals++;
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
      {!series.length && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.textMuted, fontSize: 16 }}>No measurements in this period</Text>
        </View>
      )}
      {geo && (
        <Svg width={width} height={H}>
          {(range.min != null || range.max != null) && (() => {
            const top = geo.Y(Math.min(range.max ?? geo.ys.max, geo.ys.max));
            const bottom = geo.Y(Math.max(range.min ?? geo.ys.min, geo.ys.min));
            return bottom > top ? <Rect x={PAD.left} y={top} width={geo.iw} height={bottom - top} fill={t.chart.band} /> : null;
          })()}
          <G>
            {geo.ys.ticks.map((v) => (
              <G key={`y${v}`}>
                <Line x1={PAD.left} x2={width - PAD.right} y1={geo.Y(v)} y2={geo.Y(v)} stroke={t.chart.grid} strokeDasharray="5 5" />
                <SvgText fontFamily={FONT} x={PAD.left - 10} y={geo.Y(v) + 5} fontSize={14} fill={t.textSecondary} textAnchor="end">{v.toFixed(tickDecimals)}</SvgText>
              </G>
            ))}
            {geo.xw.ticks.map((d, i) => (
              <G key={`x${d}`}>
                <Line x1={geo.X(d)} x2={geo.X(d)} y1={PAD.top - 12} y2={H - PAD.bottom} stroke={t.chart.grid} strokeDasharray="5 5" />
                {/* Label every n-th tick so dates never overlap on narrow phones; always label the last one. */}
                {(i % geo.labelEvery === 0 || i === geo.xw.ticks.length - 1) && (i === geo.xw.ticks.length - 1 || geo.xw.ticks.length - 1 - i >= geo.labelEvery) && (
                  <SvgText fontFamily={FONT} x={geo.X(d)} y={H - PAD.bottom + 26} fontSize={13} fill={t.textSecondary} textAnchor="middle">{shortDate(d)}</SvgText>
                )}
              </G>
            ))}
          </G>
          {markers.filter((at) => at >= geo.xw.from && at <= geo.xw.to).map((at) => (
            <G key={`m${at}`}>
              <Line x1={geo.X(at)} x2={geo.X(at)} y1={PAD.top - 4} y2={H - PAD.bottom} stroke={t.primary} strokeWidth={1.5} strokeOpacity={0.6} />
              <SvgText fontFamily={FONT} x={geo.X(at)} y={PAD.top - 8} fontSize={11} fill={t.primary} textAnchor="middle">WC</SvgText>
            </G>
          ))}
          {series.length > 1 && (
            <Path
              d={series.map((m, i) => `${i ? 'L' : 'M'}${geo.X(m.measuredAt).toFixed(1)} ${geo.Y(m.value).toFixed(1)}`).join(' ')}
              stroke={t.chart.line}
              strokeWidth={3}
              fill="none"
              strokeLinejoin="round"
            />
          )}
          {series.map((m, i) => {
            const cx = geo.X(m.measuredAt);
            const cy = geo.Y(m.value);
            const isLast = i === series.length - 1;
            const isSel = selected === m.id;
            return (
              <G key={m.id}>
                <Circle cx={cx} cy={cy} r={isSel ? 8 : 6} fill={t.chart.point} />
                {(isLast && !selected) && (
                  <SvgText fontFamily={FONT} x={cx} y={cy + 26} fontSize={14} fontWeight="bold" fill={t.text} textAnchor="middle">{formatValue(m.value, decimals)}</SvgText>
                )}
                <Circle cx={cx} cy={cy} r={18} fill="transparent" onPress={() => setSelected(isSel ? null : m.id)} />
              </G>
            );
          })}
          {selected && (() => {
            const m = series.find((x) => x.id === selected);
            if (!m) return null;
            const cx = Math.min(Math.max(geo.X(m.measuredAt), PAD.left + 80), width - PAD.right - 80);
            return (
              <G>
                <Rect x={cx - 80} y={6} width={160} height={28} rx={8} fill={t.text} />
                <SvgText fontFamily={FONT} x={cx} y={25} fontSize={13} fill={t.bg} textAnchor="middle">{`${formatValue(m.value, decimals)} · ${dateTime(m.measuredAt)}`}</SvgText>
              </G>
            );
          })()}
        </Svg>
      )}
    </View>
  );
}
