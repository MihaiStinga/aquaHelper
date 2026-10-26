import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { runTask } from '@/components/taskActions';
import { Header, Icon, IconButton, SectionTitle, type IconName } from '@/components/ui';
import { useNow } from '@/components/ParamCard';
import { useStore } from '@/data/store';
import { describeSchedule, isDone, isDueOn, periodKey, sectionOf, type Section, type Task, type TaskAction } from '@/domain/tasks';
import { useTheme } from '@/theme/theme';

const SECTIONS: { key: Section; title: string }[] = [
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'This week' },
  { key: 'month', title: 'This month' },
];

const ACTION_ICON: Record<NonNullable<TaskAction>, IconName> = {
  log: 'flask-outline',
  water_change: 'water-sync',
  filter_clean: 'air-filter',
};

export default function TasksScreen() {
  const t = useTheme();
  const store = useStore();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const today = new Date(now);

  const due = store.tasks.filter((x) => isDueOn(x, today, store.taskDone));
  const notDue = store.tasks.filter((x) => !due.includes(x));

  const row = (task: Task, i: number, muted = false) => {
    const done = isDone(task, today, store.taskDone);
    const onPress = () => (editing ? router.push({ pathname: '/task-edit', params: { id: task.id } }) : runTask(store, task, done));
    return (
      <Pressable
        key={task.id}
        onPress={onPress}
        onLongPress={() => router.push({ pathname: '/task-edit', params: { id: task.id } })}
        style={({ pressed }) => [s.row, { borderTopColor: t.separator, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0, opacity: pressed ? 0.6 : 1 }]}
      >
        {editing ? (
          <Icon name="pencil-outline" color={t.primary} />
        ) : (
          <Pressable onPress={() => store.setTaskDone(task.id, periodKey(task, today), !done)} hitSlop={10} disabled={muted} accessibilityLabel={done ? 'Mark as to do' : 'Mark as done'}>
            <Icon name={done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={done ? t.status.ideal.text : muted ? t.border : t.textMuted} size={28} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: done || muted ? t.textMuted : t.text, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Text>
          <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{describeSchedule(task)}</Text>
        </View>
        {task.action && !editing && !done && <Icon name={ACTION_ICON[task.action]} color={t.primary} size={22} />}
        {!editing && !muted && (
          <View style={[s.pill, { backgroundColor: done ? t.status.ideal.bg : t.primarySoft }]}>
            <Text style={{ color: done ? t.status.ideal.text : t.primary, fontWeight: '600', fontSize: 13 }}>{done ? 'Done' : 'To Do'}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title="Tasks"
        left={<IconButton name={editing ? 'check' : 'pencil-outline'} label={editing ? 'Done editing' : 'Edit tasks'} onPress={() => setEditing(!editing)} />}
        right={<IconButton name="plus" label="Add task" onPress={() => router.push('/task-edit')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {SECTIONS.map(({ key, title }) => {
          const list = due.filter((x) => sectionOf(x) === key);
          if (!list.length) return null;
          const doneCount = list.filter((x) => isDone(x, today, store.taskDone)).length;
          return (
            <View key={key}>
              <SectionTitle right={<Text style={{ color: doneCount === list.length ? t.status.ideal.text : t.textSecondary, fontSize: 15 }}>{doneCount}/{list.length}</Text>}>{title}</SectionTitle>
              <View style={[s.list, { borderColor: t.border, backgroundColor: t.card }]}>{list.map((x, i) => row(x, i))}</View>
            </View>
          );
        })}
        {notDue.length > 0 && (
          <View>
            <SectionTitle>Not due today</SectionTitle>
            <View style={[s.list, { borderColor: t.border, backgroundColor: t.card }]}>{notDue.map((x, i) => row(x, i, true))}</View>
          </View>
        )}
        {!store.tasks.length && <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 40 }}>No tasks. Add one with +.</Text>}
        <Text style={{ color: t.textMuted, fontSize: 14, marginTop: 16 }}>
          Tap a task to do it (tests, water change and filter cleaning open their screen and tick the task when saved). Long-press to edit.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
