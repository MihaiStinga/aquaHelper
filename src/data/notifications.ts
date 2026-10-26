// Phone notifications, all local (no server): the rules are evaluated ahead
// of time for each of the next days at the digest time, and the results are
// scheduled as plain notifications. Rescheduled whenever data changes or the
// app comes to the foreground. Not available on web.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { evaluateRules, type Alert, type Rule, type RuleContext } from '@/domain/rules';
import { isDone, isDueOn, type Task, type TaskDone } from '@/domain/tasks';

export const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';
const CHANNEL = 'alerts';
const DAYS_AHEAD = 7;

let configured = false;
function configure() {
  if (configured || !NOTIFICATIONS_SUPPORTED) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  void Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Alerts and reminders', importance: Notifications.AndroidImportance.HIGH });
}

/** Asks for permission if not decided yet; true when notifications may be shown. */
export async function ensurePermission(ask: boolean): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;
  configure();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export interface ScheduleInput {
  enabled: boolean;
  time: string;
  rules: Rule[];
  dismissed: Set<string>;
  context: (at: number) => RuleContext;
  tasks: Task[];
  taskDone: TaskDone[];
}

function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0, 0, 0);
}

const PLURAL = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** What the digest at `when` would say; null when there is nothing to report. */
export function digestFor(input: ScheduleInput, when: Date): { title: string; body: string } | null {
  const alerts = evaluateRules(input.rules, input.context(when.getTime())).filter((a) => !input.dismissed.has(a.key));
  const due = input.tasks.filter((t) => isDueOn(t, when, input.taskDone) && !isDone(t, when, input.taskDone));
  if (!alerts.length && !due.length) return null;
  const parts = [alerts.length && PLURAL(alerts.length, 'alert'), due.length && PLURAL(due.length, 'task')].filter(Boolean);
  const lines = [...alerts.slice(0, 4).map((a) => `• ${a.title}`), ...(alerts.length > 4 ? [`• +${alerts.length - 4} more`] : [])];
  if (due.length) lines.push(`Tasks: ${due.slice(0, 3).map((t) => t.title).join(', ')}${due.length > 3 ? '…' : ''}`);
  return { title: `Aquarium: ${parts.join(' · ')}`, body: lines.join('\n') };
}

/** Replaces every scheduled notification with the next week's digests and task reminders. */
export async function reschedule(input: ScheduleInput): Promise<number> {
  if (!NOTIFICATIONS_SUPPORTED) return 0;
  configure();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!input.enabled || !(await ensurePermission(false))) return 0;

  const now = new Date();
  let count = 0;
  const schedule = async (date: Date, title: string, body: string) => {
    if (date.getTime() <= now.getTime() + 30_000) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
    });
    count++;
  };

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const digestAt = at(day, input.time);
    const digest = digestFor(input, digestAt);
    if (digest) await schedule(digestAt, digest.title, digest.body);
    for (const t of input.tasks) {
      if (!t.time || !isDueOn(t, day, input.taskDone) || isDone(t, day, input.taskDone)) continue;
      await schedule(at(day, t.time), t.title, 'Task reminder');
    }
  }
  return count;
}

/** Shows new warnings/critical alerts right away (after a test is logged). */
export async function notifyNow(alerts: Alert[]): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED || !alerts.length || !(await ensurePermission(false))) return;
  const top = alerts[0];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: alerts.length === 1 ? top.title : `${top.title} (+${alerts.length - 1} more)`,
      body: top.message,
    },
    trigger: null,
  });
}
