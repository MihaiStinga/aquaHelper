import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AlertItem } from '@/components/AlertItem';
import { Card, Header, Icon, IconButton, IconCircle, OutlineButton, PrimaryButton } from '@/components/ui';
import { openLog, ParamCard, useNow } from '@/components/ParamCard';
import { logFilterClean, runTask } from '@/components/taskActions';
import { useStore } from '@/data/store';
import { daysSince, lastEventBefore } from '@/domain/events';
import { isDone, isDueOn, sectionOf } from '@/domain/tasks';
import { useTheme } from '@/theme/theme';

export default function AquariumScreen() {
  const t = useTheme();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const now = useNow();

  const ago = (at: number | undefined) => {
    if (at == null) return 'never logged';
    const d = Math.floor(daysSince(at, now));
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  };
  const lastChange = lastEventBefore(store.events, 'water_change', now);
  const lastFilter = lastEventBefore(store.events, 'filter_clean', now);
  const today = new Date(now);
  const todays = store.tasks.filter((x) => sectionOf(x) === 'today' && isDueOn(x, today, store.taskDone));
  const todayDone = todays.filter((x) => isDone(x, today, store.taskDone)).length;

  const pinned = store.settings.filter((s) => s.pinned).map((s) => s.code);
  const rows: string[][] = [];
  for (let i = 0; i < pinned.length; i += 2) rows.push(pinned.slice(i, i + 2));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title={store.aquariumName || 'My aquarium'}
        right={<IconButton name="pencil-outline" label="Rename aquarium" onPress={() => { setName(store.aquariumName); setEditing(true); }} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {store.alerts.length > 0 && (
          <Card style={s.section}>
            <View style={s.sectionHead}>
              <IconCircle name="bell-alert-outline" bg={t.status.high.bg} color={t.status.high.text} />
              <Text style={[s.sectionTitle, { color: t.text }]}>Alerts ({store.alerts.length})</Text>
              <Pressable onPress={() => router.push('/alerts')} hitSlop={8}><Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>See all</Text></Pressable>
            </View>
            <View style={{ gap: 10 }}>
              {store.alerts.slice(0, 3).map((a) => <AlertItem key={a.key} alert={a} compact onDismiss={() => store.dismissAlert(a.key)} />)}
            </View>
          </Card>
        )}
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

        <Card style={s.section}>
          <View style={s.sectionHead}>
            <IconCircle name="water-sync" bg={t.primarySoft} />
            <Text style={[s.sectionTitle, { color: t.text }]}>Maintenance</Text>
            <IconButton name="history" label="Maintenance log" onPress={() => router.push('/history')} />
          </View>
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: t.textSecondary }]}>Last water change</Text>
            <Text style={[s.statValue, { color: t.text }]}>{ago(lastChange?.at)}{lastChange?.percent != null ? ` · ${lastChange.percent}%` : ''}</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: t.textSecondary }]}>Filter cleaned</Text>
            <Pressable onPress={() => logFilterClean(store)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.statValue, { color: t.text }]}>{ago(lastFilter?.at)}</Text>
              <Icon name="plus-circle-outline" color={t.primary} size={22} />
            </Pressable>
          </View>
          <View style={{ marginTop: 16 }}>
            <PrimaryButton title="I want to do a water change" icon="water-sync" onPress={() => router.push('/water-change')} />
          </View>
        </Card>

        <Card style={s.section}>
          <View style={s.sectionHead}>
            <IconCircle name="clipboard-check-outline" bg={t.primarySoft} />
            <Text style={[s.sectionTitle, { color: t.text }]}>Today's tasks</Text>
            <Text style={{ color: todays.length && todayDone === todays.length ? t.status.ideal.text : t.textSecondary, fontSize: 17 }}>{todayDone}/{todays.length}</Text>
          </View>
          <View style={{ gap: 4 }}>
            {todays.map((task) => {
              const done = isDone(task, today, store.taskDone);
              return (
                <Pressable key={task.id} onPress={() => runTask(store, task, done)} style={s.taskRow}>
                  <Icon name={done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={done ? t.status.ideal.text : t.textMuted} />
                  <Text style={{ flex: 1, fontSize: 16, color: done ? t.textMuted : t.text, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Text>
                  <View style={[s.pill, { backgroundColor: done ? t.status.ideal.bg : t.primarySoft }]}>
                    <Text style={{ color: done ? t.status.ideal.text : t.primary, fontWeight: '600', fontSize: 13 }}>{done ? 'Done' : 'To Do'}</Text>
                  </View>
                </Pressable>
              );
            })}
            {!todays.length && <Text style={{ color: t.textMuted }}>Nothing due today.</Text>}
          </View>
          <View style={{ marginTop: 14 }}>
            <OutlineButton title="All tasks" icon="format-list-checks" onPress={() => router.navigate('/tasks')} />
          </View>
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
  stat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  statLabel: { fontSize: 16 },
  statValue: { fontSize: 16, fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 22, padding: 26, maxWidth: 480, width: '100%', alignSelf: 'center' },
  dialogTitle: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, height: 54, paddingHorizontal: 16, fontSize: 17 },
});
