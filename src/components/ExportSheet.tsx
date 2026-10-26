import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { Icon, type IconName } from './ui';

export interface ExportAction {
  label: string;
  icon: IconName;
  run: () => Promise<void>;
}

/** Bottom sheet listing export choices (PDF, CSV, share a summary). */
export function ExportSheet({ visible, actions, onClose }: { visible: boolean; actions: ExportAction[]; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[s.backdrop, { backgroundColor: t.overlay }]} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: t.card }]}>
          <Text style={[s.title, { color: t.text }]}>Export data</Text>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [s.row, { borderTopColor: t.separator, opacity: pressed ? 0.6 : 1 }]}
              onPress={async () => {
                onClose();
                try {
                  await a.run();
                } catch (e) {
                  alert(`Export failed: ${(e as Error).message}`);
                }
              }}
            >
              <Icon name={a.icon} color={t.primary} />
              <Text style={[s.label, { color: t.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 17 },
});
