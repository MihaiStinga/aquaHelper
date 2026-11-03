import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SEVERITY_ICON, severityColors } from '@/components/AlertItem';
import { Card, Header, Icon, IconButton, OutlineButton, SectionTitle } from '@/components/ui';
import { confirmAction } from '@/components/WhenField';
import { pickJsonFile, saveText } from '@/data/export';
import { useStore } from '@/data/store';
import { validateRules, type Rule } from '@/domain/rules';
import { useTheme } from '@/theme/theme';

const GROUPS: { tag: string; title: string }[] = [
  { tag: 'custom', title: 'Your rules' },
  { tag: 'nitrogen', title: 'Ammonia, nitrite, nitrate' },
  { tag: 'ph', title: 'pH' },
  { tag: 'co2', title: 'CO₂ and KH' },
  { tag: 'hardness', title: 'Hardness' },
  { tag: 'temperature', title: 'Temperature' },
  { tag: 'oxygen', title: 'Oxygen' },
  { tag: 'plants', title: 'Plants and algae' },
  { tag: 'maintenance', title: 'Maintenance' },
];

const groupOf = (r: Rule) => GROUPS.find((g) => r.tags?.includes(g.tag))?.title ?? 'Other';

/** All rules with on/off switches, plus import/export of the user's own rules as JSON. */
export default function RulesScreen() {
  const t = useTheme();
  const store = useStore();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const grouped = new Map<string, Rule[]>();
  for (const g of [...GROUPS.map((x) => x.title), 'Other']) grouped.set(g, []);
  for (const r of store.rules) grouped.get(groupOf(r))!.push(r);

  const importRules = async () => {
    try {
      const data = await pickJsonFile();
      if (data == null) return;
      const list = Array.isArray(data) ? data : (data as { rules?: unknown }).rules;
      const problems = validateRules(list);
      if (problems.length) {
        alert(`The file was not imported:\n\n${problems.slice(0, 8).join('\n')}${problems.length > 8 ? `\n…and ${problems.length - 8} more` : ''}`);
        return;
      }
      const incoming = list as Rule[];
      const ids = new Set(incoming.map((r) => r.id));
      await store.setCustomRules([...store.customRules.filter((r) => !ids.has(r.id)), ...incoming.map(({ tags, ...r }) => ({ ...r, tags: tags?.filter((x) => x !== 'custom') }))]);
      alert(`Imported ${incoming.length} rule${incoming.length === 1 ? '' : 's'}.`);
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  const exportRules = () =>
    saveText('aquahelper-rules.json', 'application/json', JSON.stringify(store.rules.map(({ tags, ...r }) => ({ ...r, tags: tags?.filter((x) => x !== 'custom') })), null, 2));

  const clearCustom = async () => {
    if (await confirmAction(`Remove your ${store.customRules.length} imported rules?`, 'Remove')) await store.setCustomRules([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Rules" left={<IconButton name="arrow-left" label="Back" onPress={close} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: t.textSecondary, fontSize: 15 }}>
            Rules are checked against your latest tests, water changes and maintenance. Add your own by importing a JSON file
            (same format as the export; a rule with an existing id replaces it). The format is described in docs/rules.md in the repository.
          </Text>
          <OutlineButton title="Import rules (JSON)" icon="file-import-outline" onPress={importRules} />
          <OutlineButton title="Export all rules" icon="file-export-outline" onPress={exportRules} />
          {store.customRules.length > 0 && <OutlineButton title="Remove imported rules" icon="trash-can-outline" onPress={clearCustom} />}
        </Card>

        {[...grouped].filter(([, list]) => list.length).map(([title, list]) => (
          <View key={title}>
            <SectionTitle>{title}</SectionTitle>
            <View style={[s.list, { borderColor: t.border }]}>
              {list.map((r, i) => {
                const c = severityColors(t, r.severity);
                return (
                  <Pressable key={r.id} onPress={() => store.setRuleEnabled(r.id, r.enabled === false)} style={[s.row, { borderTopColor: t.separator, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0 }]}>
                    <Icon name={SEVERITY_ICON[r.severity]} color={c.text} size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: r.enabled === false ? t.textMuted : t.text, fontSize: 16 }}>{r.title.replace(/\{\w+\}/g, '…')}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>{r.id}</Text>
                    </View>
                    <Switch value={r.enabled !== false} onValueChange={(on) => store.setRuleEnabled(r.id, on)} trackColor={{ true: t.primary }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
