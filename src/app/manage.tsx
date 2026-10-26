import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Header, Icon, IconButton, PrimaryButton } from '@/components/ui';
import { useStore } from '@/data/store';
import type { ParameterSetting } from '@/data/repo';
import { getParameter } from '@/domain/parameters';
import { useTheme } from '@/theme/theme';

/** Show/hide parameters, pick which ones appear on the Aquarium screen, and reorder. */
export default function ManageScreen() {
  const t = useTheme();
  const store = useStore();
  const [items, setItems] = useState<ParameterSetting[]>(store.settings);

  const set = (code: string, patch: Partial<ParameterSetting>) => setItems((list) => list.map((s) => (s.code === code ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/parameters'));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Parameters" left={<IconButton name="arrow-left" label="Back" onPress={close} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.legend}>
          <Text style={[s.legendText, { color: t.textSecondary, flex: 1 }]}>Parameter</Text>
          <Text style={[s.legendText, { color: t.textSecondary, width: 64, textAlign: 'center' }]}>Show</Text>
          <Text style={[s.legendText, { color: t.textSecondary, width: 64, textAlign: 'center' }]}>Home</Text>
          <View style={{ width: 64 }} />
        </View>
        {items.map((it, i) => (
          <View key={it.code} style={[s.row, { borderBottomColor: t.separator }]}>
            <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>{getParameter(it.code)!.name}</Text>
            <View style={s.cell}><Switch value={it.visible} onValueChange={(v) => set(it.code, { visible: v })} /></View>
            <View style={s.cell}><Switch value={it.pinned} onValueChange={(v) => set(it.code, { pinned: v })} /></View>
            <View style={[s.cell, { flexDirection: 'row' }]}>
              <Pressable onPress={() => move(i, -1)} hitSlop={6} accessibilityLabel="Move up"><Icon name="chevron-up" color={i ? t.text : t.textMuted} /></Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={6} accessibilityLabel="Move down"><Icon name="chevron-down" color={i < items.length - 1 ? t.text : t.textMuted} /></Pressable>
            </View>
          </View>
        ))}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Save" onPress={async () => { await store.saveLayout(items); close(); }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  legendText: { fontSize: 13, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  cell: { width: 64, alignItems: 'center', justifyContent: 'center' },
});
