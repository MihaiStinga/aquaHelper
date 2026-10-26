import { router } from 'expo-router';
import { confirmAction } from '@/components/WhenField';
import type { useStore } from '@/data/store';
import { periodKey, type Task } from '@/domain/tasks';

type Store = ReturnType<typeof useStore>;

/** Logs a filter cleaning now (after a confirm) and ticks the matching task. */
export async function logFilterClean(store: Store, task?: Task): Promise<void> {
  if (!(await confirmAction('Log filter cleaning now?', 'Log'))) return;
  await store.addEvent({ kind: 'filter_clean', at: Date.now(), percent: null, note: null });
  const t = task ?? store.tasks.find((x) => x.action === 'filter_clean');
  if (t) await store.setTaskDone(t.id, periodKey(t, new Date()), true);
}

/** Tapping a task: open what it stands for, or just tick it. */
export async function runTask(store: Store, task: Task, done: boolean): Promise<void> {
  if (done || !task.action) return store.setTaskDone(task.id, periodKey(task, new Date()), !done);
  if (task.action === 'log') router.push({ pathname: '/log', params: { taskId: task.id } });
  else if (task.action === 'water_change') router.push({ pathname: '/water-change', params: { taskId: task.id } });
  else await logFilterClean(store, task);
}
