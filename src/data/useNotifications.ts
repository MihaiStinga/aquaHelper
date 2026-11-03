import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useStore } from './store';
import { ensurePermission, notifyNow, NOTIFICATIONS_SUPPORTED, reschedule } from './notifications';

/** Keeps scheduled notifications in step with the data; mount once at the root. */
export function useNotifications() {
  const store = useStore();
  const known = useRef<Set<string> | null>(null);

  // Ask once on first start; the user can turn it off in Settings.
  useEffect(() => {
    if (NOTIFICATIONS_SUPPORTED && store.ready && store.notify.enabled) void ensurePermission(true);
  }, [store.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!store.ready) return;
    const run = () =>
      reschedule({
        enabled: store.notify.enabled,
        time: store.notify.time,
        rules: store.rules,
        dismissed: store.dismissed,
        context: (at) => store.ruleContext(at),
        tasks: store.tasks,
        taskDone: store.taskDone,
      }).catch(() => undefined);
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => sub.remove();
  }, [store.ready, store.version, store.notify.enabled, store.notify.time]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alerts that appear because of new data (not the ones present at start-up).
  useEffect(() => {
    if (!store.ready) return;
    const keys = new Set(store.alerts.map((a) => a.key));
    if (known.current && store.notify.enabled) {
      const fresh = store.alerts.filter((a) => !known.current!.has(a.key) && a.severity !== 'info');
      void notifyNow(fresh).catch(() => undefined);
    }
    known.current = keys;
  }, [store.ready, store.version]); // eslint-disable-line react-hooks/exhaustive-deps
}
