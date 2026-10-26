import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local date + time text → epoch ms, or null if invalid. */
export function parseWhen(date: string, time: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dm || !tm) return null;
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  if (d.getMonth() !== +dm[2] - 1 || d.getDate() !== +dm[3] || +tm[1] > 23 || +tm[2] > 59) return null;
  return d.getTime();
}

/** Date + time inputs (default now) with validation; returns the field and the parsed time. */
export function useWhen(initial?: number) {
  const t = useTheme();
  const start = new Date(initial ?? Date.now());
  const [date, setDate] = useState(toDateText(start));
  const [time, setTime] = useState(toTimeText(start));
  const when = parseWhen(date, time);
  const error = when == null ? 'Enter date as YYYY-MM-DD and time as HH:MM' : when > Date.now() + 60_000 ? 'The time is in the future' : null;
  const input = [s.input, { borderColor: t.border, color: t.text, backgroundColor: t.card }];

  const field = (
    <View style={s.row}>
      <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.textMuted} style={[input, { flex: 3 }]} />
      <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={t.textMuted} style={[input, { flex: 2 }]} />
      <Pressable onPress={() => { const d = new Date(); setDate(toDateText(d)); setTime(toTimeText(d)); }} style={[s.now, { borderColor: t.border }]}>
        <Text style={{ color: t.primary, fontWeight: '600' }}>Now</Text>
      </Pressable>
    </View>
  );
  return { field, when, error };
}

export function confirmAction(title: string, confirmLabel = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title));
  return new Promise((resolve) =>
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  now: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
});
