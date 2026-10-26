import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card, Header, IconButton, IconCircle, OutlineButton, Segmented, SectionTitle, StatusBadge, type IconName } from '@/components/ui';
import { EditRangeDialog } from '@/components/EditRangeDialog';
import { ExportSheet } from '@/components/ExportSheet';
import { LineChart } from '@/components/LineChart';
import { RangeBar } from '@/components/RangeBar';
import { openLog, useNow } from '@/components/ParamCard';
import { useStore } from '@/data/store';
import { exportCsv, exportPdf, shareSummary } from '@/data/export';
import { getParameter } from '@/domain/parameters';
import { dateTime, formatValue, relativeTime } from '@/domain/format';
import { inPeriod, summarize, type Period } from '@/domain/stats';
import { statusFor } from '@/domain/status';
import { STATUS_LABEL, useTheme } from '@/theme/theme';

export default function ParameterScreen() {
  const t = useTheme();
  const store = useStore();
  const now = useNow();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [period, setPeriod] = useState<Period>('7d');
  const [editingRange, setEditingRange] = useState(false);
  const [exporting, setExporting] = useState(false);

  const def = getParameter(code);
  if (!def) return null;
  const computed = def.kind === 'computed';
  const all = store.series[code] ?? [];
  const last = all.at(-1);
  const range = store.range(code);
  const status = store.status(code);
  const shown = inPeriod(all, period, now);
  const sum = summarize(shown);
  const f = (v: number | null) => formatValue(v, def.decimals);
  const unitLabel = def.unit ? ` (${def.unit})` : '';
  const c = t.status[status];

  const tiles: { icon: IconName; value: string; label: string }[] = [
    { icon: 'flask-outline', value: String(sum.count), label: 'Measurements' },
    { icon: 'clock-outline', value: f(sum.latest), label: 'Latest' },
    { icon: 'history', value: f(sum.previous), label: 'Previous' },
    { icon: 'pulse', value: f(sum.average), label: 'Average' },
    { icon: 'arrow-down', value: f(sum.min), label: 'Min' },
    { icon: 'arrow-up', value: f(sum.max), label: 'Max' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title={def.name.split(' (')[0]}
        left={<IconButton name="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/parameters'))} />}
        right={<>
          <IconButton name="share-variant-outline" label="Export" onPress={() => setExporting(true)} />
          {!computed && <IconButton name="plus" label="Log measurement" onPress={() => openLog(code)} />}
        </>}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={[s.hero, { backgroundColor: status === 'none' ? t.iconCircle : c.bg, borderColor: status === 'none' ? t.border : c.bar }]}>
          <Text style={[s.heroValue, { color: status === 'none' ? t.text : c.text }]}>{last ? f(last.value) : '–'}</Text>
          {!!def.unit && <Text style={[s.heroUnit, { color: t.textSecondary }]}>{def.unit}</Text>}
          {status !== 'none' && <Text style={[s.heroStatus, { color: c.text }]}>{STATUS_LABEL[status]}</Text>}
          <Text style={{ color: t.textSecondary, fontSize: 16, marginTop: 4 }}>
            {last ? `${computed ? 'calculated · ' : ''}${relativeTime(last.measuredAt, now)}` : 'No measurements yet'}
          </Text>
        </View>

        <Card style={s.rangeCard}>
          <View style={[s.rangeHead, { borderBottomColor: t.separator }]}>
            <Text style={{ fontSize: 19, fontWeight: '500', color: t.text }}>Range</Text>
            <IconButton name="pencil-outline" label="Edit range" onPress={() => setEditingRange(true)} />
          </View>
          <RangeBar value={last?.value ?? null} range={range} decimals={def.decimals} unit={def.unit} />
        </Card>

        {computed && (
          <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 14 }}>
            {code === 'co2'
              ? 'Calculated for every pH reading, using the latest KH from the 7 days before it.'
              : 'Calculated for every ammonia reading, using pH from the 3 hours and temperature from the 24 hours before it.'}
          </Text>
        )}

        <View style={{ marginTop: 22 }}>
          <Segmented value={period} onChange={setPeriod} options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All time' }]} />
        </View>

        <SectionTitle>Measurements{unitLabel}</SectionTitle>
        <Card style={{ paddingVertical: 8, paddingRight: 4, shadowOpacity: 0, elevation: 0 }}>
          <LineChart series={shown} period={period} range={range} decimals={def.decimals} now={now} />
        </Card>

        <SectionTitle>Summary</SectionTitle>
        <View style={[s.grid, { borderColor: t.border }]}>
          {tiles.map((tile, i) => (
            <View key={tile.label} style={[s.tile, { borderColor: t.border, borderRightWidth: i % 3 === 2 ? 0 : 1, borderBottomWidth: i < 3 ? 1 : 0 }]}>
              <IconCircle name={tile.icon} />
              <Text style={[s.tileValue, { color: t.text }]}>{tile.value}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 15 }}>{tile.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 24 }}>
          <OutlineButton title="Export data" icon="download" onPress={() => setExporting(true)} />
        </View>

        <SectionTitle right={!computed && (
          <Pressable onPress={() => openLog(code)} hitSlop={8}>
            <Text style={{ color: t.primary, fontSize: 17, fontWeight: '500' }}>+ Add</Text>
          </Pressable>
        )}>History</SectionTitle>
        <Card style={{ shadowOpacity: 0, elevation: 0 }}>
          {[...all].reverse().map((m, i) => {
            const st = statusFor(m.value, range);
            return (
              <Pressable
                key={m.id}
                disabled={computed}
                onPress={() => router.push({ pathname: '/log', params: { id: m.id } })}
                style={({ pressed }) => [s.historyRow, { borderTopColor: t.separator, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0, opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, color: t.text, fontWeight: '500' }}>{f(m.value)} {def.unit}</Text>
                  <Text style={{ fontSize: 14, color: t.textSecondary, marginTop: 2 }}>{dateTime(m.measuredAt)}</Text>
                  {!!m.note && <Text style={{ fontSize: 14, color: t.textMuted, marginTop: 2 }}>{m.note}</Text>}
                </View>
                <StatusBadge status={st} />
              </Pressable>
            );
          })}
          {!all.length && <Text style={{ color: t.textMuted, padding: 18, textAlign: 'center' }}>No measurements yet</Text>}
        </Card>
      </ScrollView>

      <EditRangeDialog
        visible={editingRange}
        title={`${def.name.split(' (')[0]}${unitLabel}`}
        range={range}
        onCancel={() => setEditingRange(false)}
        onSave={async (r) => { await store.saveRange(code, r); setEditingRange(false); }}
      />
      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        actions={[
          { label: 'PDF report', icon: 'file-pdf-box', run: () => exportPdf(`${store.aquariumName}: ${def.name}`, store.series, [code], store.range) },
          { label: 'CSV (spreadsheet)', icon: 'file-delimited-outline', run: () => exportCsv(store.series, [code], code) },
          {
            label: 'Share a summary',
            icon: 'message-text-outline',
            run: () => shareSummary(`${def.name}: latest ${f(sum.latest)} ${def.unit}, average ${f(sum.average)}, min ${f(sum.min)}, max ${f(sum.max)} (${sum.count} measurements, ${period === 'all' ? 'all time' : period === '7d' ? 'last 7 days' : 'last 30 days'})`),
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignSelf: 'center', minWidth: 220, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 40, borderRadius: 18, borderWidth: 1.5 },
  heroValue: { fontSize: 64, fontWeight: '700' },
  heroUnit: { fontSize: 20, marginTop: 2 },
  heroStatus: { fontSize: 20, fontWeight: '600', marginTop: 10 },
  rangeCard: { marginTop: 24, paddingHorizontal: 20, paddingBottom: 20, shadowOpacity: 0, elevation: 0 },
  rangeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tile: { width: '33.333%', alignItems: 'center', paddingVertical: 18, gap: 4 },
  tileValue: { fontSize: 24, fontWeight: '600', marginTop: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
