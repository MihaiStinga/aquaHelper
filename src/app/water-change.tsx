import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Icon, IconButton, PrimaryButton, SectionTitle } from '@/components/ui';
import { useWhen } from '@/components/WhenField';
import { useStore } from '@/data/store';
import { parseValue } from '@/domain/format';
import { periodKey } from '@/domain/tasks';
import { useTheme } from '@/theme/theme';

const QUICK = [10, 15, 20, 25, 30, 50];

/**
 * "I want to do a water change": the user's step-by-step checklist (editable),
 * then the percentage and time. With ?taskId= saving also ticks that task.
 */
export default function WaterChangeScreen() {
  const t = useTheme();
  const store = useStore();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState<string[]>(store.waterChangeSteps);
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { field: whenField, when, error: whenError } = useWhen();

  const pct = parseValue(percent);
  const pctError = percent.trim() && (pct == null || pct <= 0 || pct > 100) ? 'Percent must be between 1 and 100' : null;
  const error = whenError ?? pctError ?? (pct == null ? 'Choose how much water you changed' : null);
  const litres = pct != null && store.volumeL ? (store.volumeL * pct) / 100 : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const input = { borderColor: t.border, color: t.text, backgroundColor: t.card };

  const save = async () => {
    if (error || when == null || pct == null) return;
    setSaving(true);
    try {
      await store.addEvent({ kind: 'water_change', at: when, percent: pct, note: note.trim() || null });
      const task = store.tasks.find((x) => x.id === taskId) ?? store.tasks.find((x) => x.action === 'water_change');
      if (task) await store.setTaskDone(task.id, periodKey(task, new Date(when)), true);
      close();
    } finally {
      setSaving(false);
    }
  };

  const saveSteps = async () => {
    const clean = steps.map((x) => x.trim()).filter(Boolean);
    await store.setWaterChangeSteps(clean);
    setSteps(clean);
    setChecked(new Set());
    setEditing(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Water change" left={<IconButton name="close" label="Close" onPress={close} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle right={
          <Pressable onPress={() => (editing ? saveSteps() : setEditing(true))} hitSlop={8}>
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>{editing ? 'Done' : 'Edit steps'}</Text>
          </Pressable>
        }>Checklist</SectionTitle>

        {editing ? (
          <View style={{ gap: 10 }}>
            {steps.map((step, i) => (
              <View key={i} style={s.editRow}>
                <TextInput value={step} onChangeText={(v) => setSteps(steps.map((x, j) => (j === i ? v : x)))} multiline style={[s.input, input, { flex: 1, minHeight: 52, paddingTop: 14 }]} />
                <IconButton name="trash-can-outline" label="Remove step" onPress={() => setSteps(steps.filter((_, j) => j !== i))} />
              </View>
            ))}
            <Pressable onPress={() => setSteps([...steps, ''])} style={s.addStep}>
              <Icon name="plus" color={t.primary} size={22} />
              <Text style={{ color: t.primary, fontSize: 16 }}>Add step</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[s.list, { borderColor: t.border }]}>
            {steps.map((step, i) => {
              const on = checked.has(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => setChecked((prev) => { const n = new Set(prev); if (on) n.delete(i); else n.add(i); return n; })}
                  style={[s.step, { borderTopColor: t.separator, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0 }]}
                >
                  <Icon name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={on ? t.status.ideal.text : t.textMuted} />
                  <Text style={{ flex: 1, fontSize: 16, color: on ? t.textMuted : t.text, textDecorationLine: on ? 'line-through' : 'none' }}>
                    {i + 1}. {step}
                  </Text>
                </Pressable>
              );
            })}
            {!steps.length && <Text style={{ color: t.textMuted, padding: 16 }}>No steps. Tap “Edit steps” to add yours.</Text>}
          </View>
        )}

        <SectionTitle>How much water</SectionTitle>
        <View style={s.chips}>
          {QUICK.map((q) => {
            const on = pct === q;
            return (
              <Pressable key={q} onPress={() => setPercent(String(q))} style={[s.chip, { borderColor: on ? t.primary : t.border, backgroundColor: on ? t.primarySoft : t.card }]}>
                <Text style={{ color: on ? t.primary : t.text, fontSize: 16, fontWeight: on ? '600' : '400' }}>{q}%</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[s.pctRow]}>
          <TextInput value={percent} onChangeText={setPercent} keyboardType="decimal-pad" placeholder="Other" placeholderTextColor={t.textMuted} style={[s.input, input, { width: 110, textAlign: 'right' }]} />
          <Text style={{ color: t.textSecondary, fontSize: 17 }}>%</Text>
          <Text style={{ color: t.textSecondary, fontSize: 15, flex: 1, textAlign: 'right' }}>
            {litres != null ? `≈ ${litres.toFixed(1)} L of ${store.volumeL} L` : store.volumeL ? '' : 'Set the tank volume in Settings to see litres'}
          </Text>
        </View>

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>When</Text>
        {whenField}

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>Note (optional)</Text>
        <TextInput value={note} onChangeText={setNote} multiline placeholder="e.g. vacuumed substrate, dechlorinator dose" placeholderTextColor={t.textMuted} style={[s.input, input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 14 }]} />

        {error && percent.trim() !== '' && <Text style={{ color: t.status.high.text, marginTop: 14 }}>{error}</Text>}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Save water change" icon="water-sync" disabled={!!error || saving || editing} onPress={save} />
        </View>
        <Text style={{ color: t.textMuted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
          Tests logged after this are labelled with the time since this change.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 15, marginBottom: 8 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addStep: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
});
