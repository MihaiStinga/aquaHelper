import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import type { Alert, Severity } from '@/domain/rules';
import { useTheme, type Theme } from '@/theme/theme';

export const SEVERITY_ICON: Record<Severity, IconName> = {
  critical: 'alert-octagon',
  warning: 'alert',
  info: 'information',
};

export function severityColors(t: Theme, s: Severity) {
  if (s === 'critical') return t.status.high;
  if (s === 'warning') return t.status.low;
  return { text: t.primary, bg: t.primarySoft, bar: t.primarySoft };
}

/** One alert: title + message, tap to show the advice, optional dismiss. */
export function AlertItem({ alert, onDismiss, compact }: { alert: Alert; onDismiss?: () => void; compact?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const c = severityColors(t, alert.severity);
  return (
    <Pressable onPress={() => setOpen(!open)} style={[s.box, { backgroundColor: c.bg }]}>
      <View style={s.head}>
        <Icon name={SEVERITY_ICON[alert.severity]} color={c.text} size={22} />
        <Text style={[s.title, { color: t.dark ? c.text : t.text }]}>{alert.title}</Text>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss alert">
            <Icon name="close" size={20} color={t.textSecondary} />
          </Pressable>
        )}
      </View>
      {!compact && <Text style={[s.message, { color: t.textSecondary }]}>{alert.message}</Text>}
      {open && compact && <Text style={[s.message, { color: t.textSecondary }]}>{alert.message}</Text>}
      {open && alert.advice.length > 0 && (
        <View style={{ marginTop: 8, gap: 4 }}>
          {alert.advice.map((a) => (
            <Text key={a} style={{ color: t.text, fontSize: 15 }}>• {a}</Text>
          ))}
        </View>
      )}
      {!open && alert.advice.length > 0 && <Text style={{ color: c.text, fontSize: 14, marginTop: 6, fontWeight: '600' }}>What to do ›</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: { borderRadius: 14, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  message: { fontSize: 15, marginTop: 6, lineHeight: 21 },
});
