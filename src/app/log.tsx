import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, IconButton, PrimaryButton } from '@/components/ui';
import { useStore } from '@/data/store';
import { getParameter, MEASURED_PARAMETERS } from '@/domain/parameters';
import { parseValue } from '@/domain/format';
import { useTheme } from '@/theme/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local date + time text → epoch ms, or null if invalid. */
function parseWhen(date: string, time: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dm || !tm) return null;
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  if (d.getMonth() !== +dm[2] - 1 || d.getDate() !== +dm[3] || +tm[1] > 23 || +tm[2] > 59) return null;
  return d.getTime();
}

function confirmDelete(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm('Delete this measurement?'));
  return new Promise((resolve) =>
    Alert.alert('Delete measurement?', undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/**
 * Log one test session (several parameters at the same time), or edit a
 * single measurement when opened with ?id=.
 */
export default function LogScreen() {
  const t = useTheme();
  const store = useStore();
  const params = useLocalSearchParams<{ code?: string; id?: string }>();

  const existing = useMemo(
    () => (params.id ? Object.values(store.series).flat().find((m) => m.id === params.id) : undefined),
    // Only look up on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.id],
  );
  const start = new Date(existing?.measuredAt ?? Date.now());
  const [date, setDate] = useState(toDateText(start));
  const [time, setTime] = useState(toTimeText(start));
  const [note, setNote] = useState(existing?.note ?? '');
  const [values, setValues] = useState<Record<string, string>>(existing ? { [existing.code]: String(existing.value) } : {});
  const [saving, setSaving] = useState(false);

  const codes = existing
    ? [existing.code]
    : [...MEASURED_PARAMETERS.map((p) => p.code)].sort((a, b) => (a === params.code ? -1 : b === params.code ? 1 : 0));

  const when = parseWhen(date, time);
  const entries = Object.entries(values).filter(([, v]) => v.trim());
  const invalid = entries.filter(([, v]) => parseValue(v) == null).map(([c]) => c);
  const future = when != null && when > Date.now() + 60_000;
  const error = when == null ? 'Enter date as YYYY-MM-DD and time as HH:MM'
    : future ? 'The time is in the future'
    : invalid.length ? `Not a number: ${invalid.map((c) => getParameter(c)!.name).join(', ')}`
    : null;
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
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing && (await confirmDelete())) {
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
        <View style={s.whenRow}>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.textMuted} style={[s.input, input, { flex: 3 }]} />
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={t.textMuted} style={[s.input, input, { flex: 2 }]} />
          <Pressable onPress={() => { const d = new Date(); setDate(toDateText(d)); setTime(toTimeText(d)); }} style={[s.now, { borderColor: t.border }]}>
            <Text style={{ color: t.primary, fontWeight: '600' }}>Now</Text>
          </Pressable>
        </View>

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
  whenRow: { flexDirection: 'row', gap: 10 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  now: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingRight: 8, height: 56 },
  valueInput: { width: 90, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'right', paddingHorizontal: 10, fontSize: 17 },
});
