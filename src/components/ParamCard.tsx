import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getParameter } from '@/domain/parameters';
import { formatValue, relativeTime } from '@/domain/format';
import { useStore } from '@/data/store';
import { useTheme } from '@/theme/theme';
import { Card, Icon, StatusBadge } from './ui';

/** Current time, refreshed every 30 s so "x minutes ago" stays right. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function openParameter(code: string) {
  router.push({ pathname: '/parameter/[code]', params: { code } });
}

export function openLog(code?: string) {
  router.push(code ? { pathname: '/log', params: { code } } : '/log');
}

/** Card used in the Parameters grid ("grid") and on the Aquarium screen ("compact"). */
export function ParamCard({ code, variant }: { code: string; variant: 'grid' | 'compact' }) {
  const t = useTheme();
  const store = useStore();
  const now = useNow();
  const def = getParameter(code);
  if (!def) return null;
  const last = store.latest(code);
  const status = store.status(code);
  const valueColor = status === 'none' ? t.text : t.status[status].text;
  const compact = variant === 'compact';
  const computed = def.kind === 'computed';

  return (
    <Card style={[s.card, compact ? s.compact : s.grid, compact && { shadowOpacity: 0, elevation: 0 }]} onPress={() => openParameter(code)}>
      <Text numberOfLines={1} style={[s.title, { color: compact ? t.text : t.textSecondary, fontSize: compact ? 16 : 17 }]}>{def.name}</Text>
      {last ? (
        <>
          <Text style={[s.value, { color: valueColor, fontSize: compact ? 30 : 40 }]}>{formatValue(last.value, def.decimals)}</Text>
          {def.unit ? <Text style={[s.unit, { color: t.textMuted }]}>{def.unit}</Text> : <View style={{ height: 4 }} />}
          <StatusBadge status={status} />
          <Text style={[s.time, { color: t.textMuted }]}>{computed ? 'calculated · ' : ''}{relativeTime(last.measuredAt, now)}</Text>
        </>
      ) : compact ? (
        <>
          <Text style={[s.dashes, { color: t.textMuted }]}>---</Text>
          <StatusBadge status="none" />
        </>
      ) : (
        <>
          <Text style={[s.dash, { color: t.textMuted }]}>—</Text>
          {computed ? (
            <Text style={[s.log, { color: t.textMuted }]}>Needs {def.inputs?.map((c) => getParameter(c)?.name.split(' ')[0]).join(' + ')}</Text>
          ) : (
            <Pressable onPress={() => openLog(code)} hitSlop={8} style={s.logRow}>
              <Icon name="plus" size={20} color={t.textMuted} />
              <Text numberOfLines={1} style={[s.log, { color: t.textMuted }]}>Log Measurement</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  grid: { minHeight: 172, paddingVertical: 22 },
  compact: { minHeight: 144, paddingVertical: 14, borderRadius: 12 },
  title: { fontWeight: '500', textAlign: 'center' },
  value: { fontWeight: '700', marginTop: 6 },
  unit: { fontSize: 15, marginBottom: 8 },
  time: { fontSize: 14, marginTop: 8 },
  dash: { fontSize: 32, marginTop: 18, marginBottom: 26 },
  dashes: { fontSize: 18, letterSpacing: 2, marginTop: 34, marginBottom: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  log: { fontSize: 15 },
});
