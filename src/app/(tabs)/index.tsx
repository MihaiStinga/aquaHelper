import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Header, Icon, IconButton, IconCircle, PrimaryButton } from '@/components/ui';
import { openLog, ParamCard } from '@/components/ParamCard';
import { useStore } from '@/data/store';
import { useTheme } from '@/theme/theme';

export default function AquariumScreen() {
  const t = useTheme();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const pinned = store.settings.filter((s) => s.pinned).map((s) => s.code);
  const rows: string[][] = [];
  for (let i = 0; i < pinned.length; i += 2) rows.push(pinned.slice(i, i + 2));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title={store.aquariumName || 'My aquarium'}
        right={<IconButton name="pencil-outline" label="Rename aquarium" onPress={() => { setName(store.aquariumName); setEditing(true); }} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={s.section}>
          <View style={s.sectionHead}>
            <IconCircle name="flask" bg={t.primarySoft} />
            <Text style={[s.sectionTitle, { color: t.text }]}>Parameters</Text>
            <IconButton name="tune-vertical-variant" label="Choose parameters" onPress={() => router.push('/manage')} />
          </View>
          <View style={{ gap: 14 }}>
            {rows.map((r) => (
              <View key={r.join()} style={{ flexDirection: 'row', gap: 14 }}>
                {r.map((c) => <ParamCard key={c} code={c} variant="compact" />)}
                {r.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
            {!pinned.length && <Text style={{ color: t.textMuted, textAlign: 'center' }}>Pin parameters with the sliders icon</Text>}
          </View>
          <Pressable onPress={() => openLog()} style={s.logRow} hitSlop={6}>
            <Icon name="plus" color={t.primary} size={28} />
            <Text style={[s.log, { color: t.primary }]}>Log Measurement</Text>
          </Pressable>
        </Card>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={[s.backdrop, { backgroundColor: t.overlay }]}>
          <View style={[s.dialog, { backgroundColor: t.card }]}>
            <Text style={[s.dialogTitle, { color: t.primary }]}>Aquarium name</Text>
            <TextInput value={name} onChangeText={setName} autoFocus style={[s.input, { borderColor: t.border, color: t.text }]} />
            <View style={{ marginTop: 24 }}>
              <PrimaryButton title="Save" disabled={!name.trim()} onPress={async () => { await store.setAquariumName(name.trim()); setEditing(false); }} />
            </View>
            <Pressable onPress={() => setEditing(false)} style={{ alignItems: 'center', paddingTop: 20 }}>
              <Text style={{ color: t.textMuted, fontSize: 18, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  section: { padding: 20, borderRadius: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  sectionTitle: { flex: 1, fontSize: 22, fontWeight: '500' },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, marginBottom: 4 },
  log: { fontSize: 20, fontWeight: '600' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 22, padding: 26, maxWidth: 480, width: '100%', alignSelf: 'center' },
  dialogTitle: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, height: 54, paddingHorizontal: 16, fontSize: 17 },
});
