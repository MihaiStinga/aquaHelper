import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseValue } from '@/domain/format';
import type { Range } from '@/domain/types';
import { useTheme } from '@/theme/theme';
import { PrimaryButton } from './ui';

/** "Edit Range" dialog. Either bound may be left empty for a one-sided range. */
export function EditRangeDialog({ visible, title, range, onSave, onCancel }: {
  visible: boolean;
  title: string;
  range: Range;
  onSave: (r: Range) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  useEffect(() => {
    if (visible) {
      setMin(range.min != null ? String(range.min) : '');
      setMax(range.max != null ? String(range.max) : '');
    }
  }, [visible, range.min, range.max]);

  const pMin = min.trim() ? parseValue(min) : null;
  const pMax = max.trim() ? parseValue(max) : null;
  const error =
    (min.trim() && pMin == null) || (max.trim() && pMax == null) ? 'Enter numbers only'
    : pMin != null && pMax != null && pMin > pMax ? 'Min must be lower than Max'
    : null;

  const field = (label: string, value: string, set: (v: string) => void) => (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { color: t.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={t.textMuted}
        style={[s.input, { borderColor: t.border, color: t.text }]}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[s.backdrop, { backgroundColor: t.overlay }]}>
        <View style={[s.dialog, { backgroundColor: t.card }]}>
          <Text style={[s.title, { color: t.primary }]}>Edit Range</Text>
          <Text style={[s.subtitle, { color: t.textSecondary }]}>{title}</Text>
          <View style={s.row}>
            {field('Min', min, setMin)}
            {field('Max', max, setMax)}
          </View>
          {error && <Text style={{ color: t.status.high.text, marginTop: 10 }}>{error}</Text>}
          <View style={{ marginTop: 28 }}>
            <PrimaryButton title="Save" disabled={!!error} onPress={() => onSave({ min: pMin, max: pMax })} />
          </View>
          <Pressable onPress={onCancel} style={s.cancel}>
            <Text style={{ color: t.textMuted, fontSize: 18, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 22, padding: 26, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 17, marginTop: 10 },
  row: { flexDirection: 'row', gap: 18, marginTop: 26 },
  label: { fontSize: 16, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, height: 54, paddingHorizontal: 16, fontSize: 17 },
  cancel: { alignItems: 'center', paddingTop: 22 },
});
