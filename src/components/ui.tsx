import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_LABEL, useTheme } from '@/theme/theme';
import type { Status } from '@/domain/types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 26, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? t.text} />;
}

export function IconButton({ name, onPress, label, color }: { name: IconName; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={10} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}>
      <Icon name={name} color={color} />
    </Pressable>
  );
}

/** Top bar as in the screenshots: one action left, bold centred title, actions right. */
export function Header({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: t.bg, borderBottomColor: t.separator }]}>
      <View style={styles.headerSide}>{left}</View>
      <View style={styles.headerTitle}>
        {typeof title === 'string' ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.headerText, { color: t.text }]}>{title}</Text> : title}
      </View>
      <View style={[styles.headerSide, { justifyContent: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const base = [styles.card, { backgroundColor: t.card, borderColor: t.border, shadowColor: t.dark ? 'transparent' : '#000' }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>{children}</Pressable>;
}

export function StatusBadge({ status, size = 'md' }: { status: Status; size?: 'md' | 'lg' }) {
  const t = useTheme();
  const c = t.status[status];
  if (status === 'none') {
    return <View style={[styles.noneBadge, { backgroundColor: c.bg }]}><Text style={{ color: c.text }}>-</Text></View>;
  }
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: size === 'lg' ? 18 : 15 }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function IconCircle({ name, color, bg }: { name: IconName; color?: string; bg?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.iconCircle, { backgroundColor: bg ?? t.iconCircle }]}>
      <Icon name={name} size={22} color={color ?? t.primary} />
    </View>
  );
}

export function PrimaryButton({ title, icon, onPress, disabled }: { title: string; icon?: IconName; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, { backgroundColor: t.primary, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {icon && <Icon name={icon} size={24} color={t.onPrimary} />}
      <Text style={[styles.primaryText, { color: t.onPrimary }]}>{title}</Text>
    </Pressable>
  );
}

export function OutlineButton({ title, icon, onPress }: { title: string; icon?: IconName; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outline, { borderColor: t.separator, backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
      {icon && <Icon name={icon} size={24} color={t.primary} />}
      <Text style={[styles.outlineText, { color: t.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.iconCircle, borderColor: t.separator }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, active && { backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}>
            <Text style={{ fontSize: 16, color: active ? t.text : t.textSecondary, fontWeight: active ? '500' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={{ fontSize: 19, fontWeight: '600', color: t.text }}>{children}</Text>
      {right}
    </View>
  );
}

export const styles = StyleSheet.create({
  iconButton: { padding: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  headerSide: { width: 84, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerText: { fontSize: 22, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, alignSelf: 'center' },
  noneBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 14 },
  primaryText: { fontSize: 18, fontWeight: '600' },
  outline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1 },
  outlineText: { fontSize: 17, fontWeight: '500' },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 3, borderWidth: 1 },
  segment: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
});
