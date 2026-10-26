import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatValue } from '@/domain/format';
import type { Range, Status } from '@/domain/types';
import { useTheme } from '@/theme/theme';

interface Segment {
  status: Exclude<Status, 'none'>;
  label: string;
  bound: string;
}

/**
 * Low / Ideal / High bar with a marker at the current value. Each zone is
 * drawn with equal width; inside the outer zones the marker is placed on a
 * scale of one ideal-span, so a value just below the minimum sits near the
 * edge of the ideal zone and far-off values sit at the end of the bar.
 */
export function RangeBar({ value, range, decimals, unit }: { value: number | null; range: Range; decimals: number; unit: string }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const { min, max } = range;
  if (min == null && max == null) {
    return <Text style={{ color: t.textMuted, fontSize: 15, paddingVertical: 8 }}>No ideal range set. Tap the pencil to set one.</Text>;
  }
  const f = (v: number) => formatValue(v, decimals);
  const segments: Segment[] = [];
  if (min != null) segments.push({ status: 'low', label: 'Low', bound: `< ${f(min)}` });
  segments.push({ status: 'ideal', label: 'Ideal', bound: min != null && max != null ? `${f(min)} - ${f(max)}` : min != null ? `≥ ${f(min)}` : `≤ ${f(max!)}` });
  if (max != null) segments.push({ status: 'high', label: 'High', bound: `> ${f(max)}` });

  const n = segments.length;
  const span = min != null && max != null ? Math.max(max - min, 1e-9) : Math.max(Math.abs((min ?? max)!) * 0.5, 1);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  let pos: number | null = null; // 0..1 along the bar
  let status: Exclude<Status, 'none'> = 'ideal';
  if (value != null) {
    const idealIndex = min != null ? 1 : 0;
    if (min != null && value < min) {
      status = 'low';
      pos = (1 - clamp((min - value) / span)) / n;
    } else if (max != null && value > max) {
      status = 'high';
      pos = (n - 1 + clamp((value - max) / span)) / n;
    } else {
      const lo = min ?? max! - span;
      const hi = max ?? min! + span;
      pos = (idealIndex + clamp((value - lo) / (hi - lo))) / n;
    }
  }
  const color = t.status[status].text;
  const x = pos != null ? pos * width : 0;

  return (
    <View>
      <View style={{ height: 28 }}>
        {pos != null && width > 0 && (
          <Text style={[s.valueLabel, { color, left: Math.min(Math.max(x - 50, 0), width - 100) }]}>
            {f(value!)}{unit ? ` ${unit}` : ''}
          </Text>
        )}
      </View>
      <View style={s.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {segments.map((seg) => <View key={seg.status} style={[s.segment, { backgroundColor: t.status[seg.status].bar }]} />)}
        {pos != null && width > 0 && (
          <View style={[s.marker, { left: x - 7 }]}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <View style={[s.stem, { backgroundColor: color }]} />
          </View>
        )}
      </View>
      <View style={s.labels}>
        {segments.map((seg, i) => (
          <View key={seg.status} style={{ flex: 1, alignItems: i === 0 && n > 1 ? 'flex-start' : i === n - 1 && n > 1 ? 'flex-end' : 'center' }}>
            <Text style={[s.label, { color: t.textSecondary }]}>{seg.label}</Text>
            <Text style={[s.bound, { color: t.textSecondary }]}>{seg.bound}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  valueLabel: { position: 'absolute', width: 100, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  bar: { flexDirection: 'row', gap: 4, height: 16, alignItems: 'center' },
  segment: { flex: 1, height: 16, borderRadius: 8 },
  marker: { position: 'absolute', top: -10, width: 14, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  stem: { width: 3, height: 18, marginTop: -2, borderRadius: 2 },
  labels: { flexDirection: 'row', marginTop: 18 },
  label: { fontSize: 17 },
  bound: { fontSize: 16, marginTop: 4 },
});
