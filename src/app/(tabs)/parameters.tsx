import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Header, IconButton, IconCircle, PrimaryButton } from '@/components/ui';
import { ExportSheet } from '@/components/ExportSheet';
import { openLog, ParamCard } from '@/components/ParamCard';
import { useStore } from '@/data/store';
import { exportCsv, exportPdf, shareSummary } from '@/data/export';
import { getParameter } from '@/domain/parameters';
import { formatValue } from '@/domain/format';
import { needsAttention } from '@/domain/status';
import { STATUS_LABEL, useTheme } from '@/theme/theme';

export default function ParametersScreen() {
  const t = useTheme();
  const store = useStore();
  const [hideEmpty, setHideEmpty] = useState(false);
  const [exporting, setExporting] = useState(false);

  const visible = store.settings.filter((s) => s.visible).map((s) => s.code);
  const shown = hideEmpty ? visible.filter((c) => store.latest(c)) : visible;
  const attention = visible.filter((c) => needsAttention(store.status(c))).length;
  const anyRange = visible.some((c) => { const r = store.range(c); return r.min != null || r.max != null; });

  const rows: string[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));

  const summary = () =>
    [`${store.aquariumName}: water parameters`, ...visible.flatMap((c) => {
      const m = store.latest(c);
      const def = getParameter(c)!;
      if (!m) return [];
      const st = store.status(c);
      return [`${def.name}: ${formatValue(m.value, def.decimals)} ${def.unit}${st === 'none' ? '' : ` (${STATUS_LABEL[st]})`}`.trim()];
    })].join('\n');

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title="Parameters"
        left={<IconButton name="tune-vertical-variant" label="Choose parameters" onPress={() => router.push('/manage')} />}
        right={<>
          <IconButton name="share-variant-outline" label="Export" onPress={() => setExporting(true)} />
          <IconButton name="plus" label="Log measurement" onPress={() => openLog()} />
        </>}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.banner, { borderBottomColor: t.separator }]}>
          <IconCircle name="water" color={attention ? t.status.high.text : anyRange ? t.status.ideal.text : t.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: t.text }]}>Water quality</Text>
            <Text style={{ color: t.textSecondary, fontSize: 16, marginTop: 2 }}>
              {attention ? `${attention} need${attention === 1 ? 's' : ''} attention` : anyRange ? 'All in range' : 'Set ideal ranges to see status'}
            </Text>
          </View>
          <IconButton
            name={hideEmpty ? 'eye-off-outline' : 'eye-outline'}
            label={hideEmpty ? 'Show parameters without measurements' : 'Hide parameters without measurements'}
            onPress={() => setHideEmpty(!hideEmpty)}
          />
        </View>
        <View style={s.grid}>
          {rows.map((r) => (
            <View key={r.join()} style={s.row}>
              {r.map((c) => <ParamCard key={c} code={c} variant="grid" />)}
              {r.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
          {!shown.length && (
            <Card style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: t.textMuted, fontSize: 16 }}>Nothing measured yet</Text>
            </Card>
          )}
        </View>
        <View style={[s.footer, { borderTopColor: t.separator }]}>
          <PrimaryButton title="Export data" icon="share-variant-outline" onPress={() => setExporting(true)} />
          <Text style={[s.footnote, { color: t.textSecondary }]}>PDF, CSV, or share a summary</Text>
        </View>
      </ScrollView>
      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        actions={[
          { label: 'PDF report', icon: 'file-pdf-box', run: () => exportPdf(`${store.aquariumName}: water parameters`, store.series, visible, store.range) },
          { label: 'CSV (spreadsheet)', icon: 'file-delimited-outline', run: () => exportCsv(store.series, visible) },
          { label: 'Share a summary', icon: 'message-text-outline', run: () => shareSummary(summary()) },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  bannerTitle: { fontSize: 22, fontWeight: '500' },
  grid: { padding: 16, gap: 16 },
  row: { flexDirection: 'row', gap: 16 },
  footer: { marginHorizontal: 16, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  footnote: { textAlign: 'center', marginTop: 14, fontSize: 16 },
});
