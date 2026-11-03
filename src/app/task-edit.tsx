import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, IconButton, PrimaryButton, Segmented } from '@/components/ui';
import { confirmAction } from '@/components/WhenField';
import { useStore } from '@/data/store';
import { WEEKDAYS, type Frequency, type TaskAction } from '@/domain/tasks';
import { useTheme } from '@/theme/theme';

const ACTIONS: { value: TaskAction; label: string }[] = [
  { value: null, label: 'Just a checkbox' },
  { value: 'log', label: 'Opens Log Measurement' },
  { value: 'water_change', label: 'Opens Water change' },
  { value: 'filter_clean', label: 'Logs filter cleaning' },
];

/** Add (no ?id) or edit a recurring task. */
export default function TaskEditScreen() {
  const t = useTheme();
  const store = useStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = store.tasks.find((x) => x.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'daily');
  const [weekday, setWeekday] = useState<number | null>(existing?.weekday ?? null);
  const [everyDays, setEveryDays] = useState(String(existing?.everyDays ?? 3));
  const [time, setTime] = useState(existing?.time ?? '');
  const [action, setAction] = useState<TaskAction>(existing?.action ?? null);

  const every = Number(everyDays);
  const timeOk = !time.trim() || /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
  const error = !title.trim() ? 'Give the task a name'
    : frequency === 'interval' && !(Number.isInteger(every) && every >= 1 && every <= 365) ? 'Days must be a whole number from 1 to 365'
    : !timeOk ? 'Reminder time must be HH:MM' : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const input = { borderColor: t.border, color: t.text, backgroundColor: t.card };

  const save = async () => {
    if (error) return;
    const trimmed = time.trim();
    await store.saveTask({
      id: existing?.id,
      title: title.trim(),
      frequency,
      weekday: frequency === 'weekly' ? weekday : null,
      everyDays: frequency === 'interval' ? every : null,
      time: trimmed ? trimmed.padStart(5, '0') : null,
      action,
    });
    close();
  };

  const remove = async () => {
    if (existing && (await confirmAction(`Delete “${existing.title}”?`))) {
      await store.deleteTask(existing.id);
      close();
    }
  };

  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[s.chip, { borderColor: on ? t.primary : t.border, backgroundColor: on ? t.primarySoft : t.card }]}>
      <Text style={{ color: on ? t.primary : t.text, fontWeight: on ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={existing ? 'Edit task' : 'New task'}
        left={<IconButton name="close" label="Close" onPress={close} />}
        right={existing ? <IconButton name="trash-can-outline" label="Delete" color={t.status.high.text} onPress={remove} /> : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.label, { color: t.textSecondary }]}>Task</Text>
        <TextInput value={title} onChangeText={setTitle} autoFocus={!existing} placeholder="e.g. Dose fertilizer" placeholderTextColor={t.textMuted} style={[s.input, input]} />

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>How often</Text>
        <Segmented
          value={frequency}
          onChange={setFrequency}
          options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'interval', label: 'Every N' }]}
        />
        {frequency === 'weekly' && (
          <View style={[s.chips, { marginTop: 12 }]}>
            {chip(weekday == null, 'Any day', () => setWeekday(null))}
            {[1, 2, 3, 4, 5, 6, 0].map((d) => chip(weekday === d, WEEKDAYS[d].slice(0, 3), () => setWeekday(d)))}
          </View>
        )}
        {frequency === 'interval' && (
          <View style={[s.inline, { marginTop: 12 }]}>
            <Text style={{ color: t.text, fontSize: 16 }}>Every</Text>
            <TextInput value={everyDays} onChangeText={setEveryDays} keyboardType="number-pad" style={[s.input, input, { width: 80, textAlign: 'center' }]} />
            <Text style={{ color: t.text, fontSize: 16 }}>days after it was last done</Text>
          </View>
        )}

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>Reminder time (optional)</Text>
        <TextInput value={time} onChangeText={setTime} placeholder="HH:MM, empty = daily summary only" placeholderTextColor={t.textMuted} style={[s.input, input]} />

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>When tapped</Text>
        <View style={s.chips}>{ACTIONS.map((a) => chip(action === a.value, a.label, () => setAction(a.value)))}</View>

        {error && title.trim() !== '' && <Text style={{ color: t.status.high.text, marginTop: 14 }}>{error}</Text>}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Save" disabled={!!error} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 15, marginBottom: 8 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
