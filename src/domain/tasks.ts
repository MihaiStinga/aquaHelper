// Recurring tasks (checklists). A task is due once per period; completing it
// records the period key, so "done" never leaks into the next day/week/month.

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'interval';

/** What tapping the task opens, so doing the thing also ticks the task. */
export type TaskAction = 'log' | 'water_change' | 'filter_clean' | null;

export interface Task {
  id: string;
  title: string;
  frequency: Frequency;
  /** weekly: 0 = Sunday … 6 = Saturday; null = any day that week. */
  weekday: number | null;
  /** interval: every N days, counted from the last completion. */
  everyDays: number | null;
  /** "HH:MM" local time for a reminder, or null. */
  time: string | null;
  action: TaskAction;
  sort: number;
}

export interface TaskDone {
  id: string;
  taskId: string;
  /** Period the completion counts for (see periodKey). */
  period: string;
  doneAt: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Monday of the week containing `d`, as a day key (weeks run Monday–Sunday). */
export function weekKey(d: Date): string {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return `W${dayKey(m)}`;
}

export const monthKey = (d: Date) => `M${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function periodKey(task: Task, d: Date): string {
  switch (task.frequency) {
    case 'daily': return dayKey(d);
    case 'weekly': return task.weekday == null ? weekKey(d) : dayKey(d);
    case 'monthly': return monthKey(d);
    case 'interval': return dayKey(d);
  }
}

const DAY = 24 * 3600_000;

/** Whether the task should appear on day `d`. */
export function isDueOn(task: Task, d: Date, done: TaskDone[]): boolean {
  switch (task.frequency) {
    case 'daily':
    case 'monthly':
      return true;
    case 'weekly':
      return task.weekday == null || d.getDay() === task.weekday;
    case 'interval': {
      const last = done.filter((x) => x.taskId === task.id).reduce((m, x) => Math.max(m, x.doneAt), 0);
      if (!last) return true;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const lastDay = new Date(last);
      const lastStart = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()).getTime();
      // Still shown on the day it was done, so it reads as Done rather than vanishing.
      return start === lastStart || Math.round((start - lastStart) / DAY) >= (task.everyDays ?? 1);
    }
  }
}

export function isDone(task: Task, d: Date, done: TaskDone[]): boolean {
  if (task.frequency === 'interval') {
    const key = dayKey(d);
    return done.some((x) => x.taskId === task.id && x.period === key);
  }
  const key = periodKey(task, d);
  return done.some((x) => x.taskId === task.id && x.period === key);
}

export type Section = 'today' | 'week' | 'month';

/** Where a due task is listed: day-bound ones under Today, the rest under their period. */
export function sectionOf(task: Task): Section {
  if (task.frequency === 'monthly') return 'month';
  if (task.frequency === 'weekly' && task.weekday == null) return 'week';
  return 'today';
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeSchedule(t: Task): string {
  const at = t.time ? ` at ${t.time}` : '';
  switch (t.frequency) {
    case 'daily': return `Every day${at}`;
    case 'weekly': return t.weekday == null ? `Once a week${at}` : `Every ${WEEKDAYS[t.weekday]}${at}`;
    case 'monthly': return `Once a month${at}`;
    case 'interval': return `Every ${t.everyDays ?? 1} days${at}`;
  }
}

/** Default checklist, from Mihai's routine. */
export const DEFAULT_TASKS: Omit<Task, 'id' | 'sort'>[] = [
  { title: 'Dose fertilizer', frequency: 'daily', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Check bubble counter and drop checker colour', frequency: 'daily', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Check water level, top off if needed', frequency: 'daily', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Observe fish for signs of disease or stress', frequency: 'daily', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Water change 15–20%', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: 'water_change' },
  { title: 'Check all equipment is working', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Clean glass, hardscape and plant leaves', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Trim live plants', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Check CO₂ canister, refill as needed', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: null },
  { title: 'Test your water', frequency: 'weekly', weekday: null, everyDays: null, time: null, action: 'log' },
  { title: 'Clean out filters (rinse in aquarium water)', frequency: 'monthly', weekday: null, everyDays: null, time: null, action: 'filter_clean' },
  { title: 'Clean pipes and strainers', frequency: 'monthly', weekday: null, everyDays: null, time: null, action: null },
];

/** Default steps of the guided water change, from Mihai's list; editable in the app. */
export const DEFAULT_WATER_CHANGE_STEPS = [
  'Measure the tap water temperature before connecting the hose; let it run 5 minutes until it is stable',
  'Add dechlorinator (anticlor) for the new water',
  'Connect the hose',
  'Run the hose (planned duration: X–Y min)',
];
