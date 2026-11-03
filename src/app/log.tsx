import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, IconButton, PrimaryButton } from '@/components/ui';
import { confirmAction, useWhen } from '@/components/WhenField';
import { describeContext, waterChangeContext } from '@/domain/events';
import { periodKey } from '@/domain/tasks';
import { useStore } from '@/data/store';
import { getParameter, MEASURED_PARAMETERS } from '@/domain/parameters';
import { parseValue } from '@/domain/format';
import { useTheme } from '@/theme/theme';

/**
 * Log one test session (several parameters at the same time), or edit a
 * single measurement when opened with ?id=. Opened from a task (?taskId=),
 * saving also ticks the task.
 */
export default function LogScreen() {
  const t = useTheme();
  const store = useStore();
  const params = useLocalSearchParams<{ code?: string; id?: string; taskId?: string }>();

  const existing = useMemo(
    () => (params.id ? Object.values(store.series).flat().find((m) => m.id === params.id) : undefined),
    // Only look up on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.id],
  );
  const { field: whenField, when, error: whenError } = useWhen(existing?.measuredAt);
  const [note, setNote] = useState(existing?.note ?? '');
  const [values, setValues] = useState<Record<string, string>>(existing ? { [existing.code]: String(existing.value) } : {});
  const [saving, setSaving] = useState(false);

  const codes = existing
    ? [existing.code]
    : [...MEASURED_PARAMETERS.map((p) => p.code)].sort((a, b) => (a === params.code ? -1 : b === params.code ? 1 : 0));

  const entries = Object.entries(values).filter(([, v]) => v.trim());
  const invalid = entries.filter(([, v]) => parseValue(v) == null).map(([c]) => c);
  const error = whenError
    ?? (invalid.length ? `Not a number: ${invalid.map((c) => getParameter(c)!.name).join(', ')}` : null);
  const context = when != null ? describeContext(waterChangeContext({ id: '', code: '', value: 0, measuredAt: when, note: null }, store.events)) : null;
  const canSave = !error && entries.length > 0 && !saving;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = async () => {
    if (!canSave || when == null) return;
    setSaving(true);
    try {
      if (existing) {
        const [, raw] = entries[0];
        await store.updateMeasurement(existing.id, { value: parseValue(raw)!, raw: raw.trim(), measuredAt: when, note: note.trim() || null });
      } else {
        await store.addMeasurements(entries.map(([code, raw]) => ({ code, value: parseValue(raw)!, raw: raw.trim(), measuredAt: when, note: note.trim() || null })));
        const task = store.tasks.find((x) => x.id === params.taskId);
        if (task) await store.setTaskDone(task.id, periodKey(task, new Date()), true);
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing && (await confirmAction('Delete this measurement?'))) {
      await store.deleteMeasurement(existing.id);
      close();
    }
  };

  const input = { borderColor: t.border, color: t.text, backgroundColor: t.card };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={existing ? 'Edit Measurement' : 'Log Measurement'}
        left={<IconButton name="close" label="Close" onPress={close} />}
        right={existing ? <IconButton name="trash-can-outline" label="Delete" color={t.status.high.text} onPress={remove} /> : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.label, { color: t.textSecondary }]}>When</Text>
        {whenField}
        {context && <Text style={{ color: t.textSecondary, marginTop: 8, fontSize: 14 }}>{context}</Text>}

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>{existing ? 'Value' : 'Values (fill in what you tested)'}</Text>
        <View style={{ gap: 10 }}>
          {codes.map((code, i) => {
            const def = getParameter(code)!;
            const bad = invalid.includes(code);
            return (
              <View key={code} style={[s.paramRow, input, bad && { borderColor: t.status.high.text }]}>
                <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>{def.name}</Text>
                <TextInput
                  value={values[code] ?? ''}
                  onChangeText={(v) => setValues((prev) => ({ ...prev, [code]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={t.textMuted}
                  autoFocus={i === 0 && (!!params.code || !!existing)}
                  style={[s.valueInput, { color: t.text, borderColor: t.separator }]}
                />
                <Text style={{ width: 40, color: t.textSecondary }}>{def.unit}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[s.label, { color: t.textSecondary, marginTop: 20 }]}>Note (optional)</Text>
        <TextInput value={note} onChangeText={setNote} multiline placeholder="e.g. kit brand, before feeding" placeholderTextColor={t.textMuted} style={[s.input, input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 14 }]} />

        {error && entries.length > 0 && <Text style={{ color: t.status.high.text, marginTop: 14 }}>{error}</Text>}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton title={existing ? 'Save' : entries.length > 1 ? `Save ${entries.length} measurements` : 'Save'} disabled={!canSave} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 15, marginBottom: 8 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingRight: 8, height: 56 },
  valueInput: { width: 90, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'right', paddingHorizontal: 10, fontSize: 17 },
});
