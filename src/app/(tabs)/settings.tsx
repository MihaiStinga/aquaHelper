import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Card, Header, Icon, OutlineButton, SectionTitle, type IconName } from '@/components/ui';
import { useStore } from '@/data/store';
import { ensurePermission, NOTIFICATIONS_SUPPORTED } from '@/data/notifications';
import { parseValue } from '@/domain/format';
import { exportBackupFile, exportCsv, pickBackupFile } from '@/data/export';
import { PARAMETERS } from '@/domain/parameters';
import { useTheme } from '@/theme/theme';

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function SettingsScreen() {
  const t = useTheme();
  const store = useStore();
  const [volume, setVolume] = useState(store.volumeL != null ? String(store.volumeL) : '');
  const [time, setTime] = useState(store.notify.time);
  useEffect(() => setTime(store.notify.time), [store.notify.time]);
  const input = [s.input, { borderColor: t.border, color: t.text, backgroundColor: t.card }];

  const saveVolume = () => {
    const v = parseValue(volume);
    if (!volume.trim()) void store.setVolume(null);
    else if (v != null && v > 0) void store.setVolume(v);
    else setVolume(store.volumeL != null ? String(store.volumeL) : '');
  };
  const saveTime = () => {
    if (TIME_RE.test(time.trim())) void store.setNotify({ ...store.notify, time: time.trim().padStart(5, '0') });
    else setTime(store.notify.time);
  };
  const toggleNotify = async (on: boolean) => {
    if (on && NOTIFICATIONS_SUPPORTED && !(await ensurePermission(true))) {
      alert('Notifications are blocked for aquaHelper. Allow them in Android Settings → Apps → aquaHelper → Notifications.');
      return;
    }
    await store.setNotify({ ...store.notify, enabled: on });
  };
  const link = (icon: IconName, title: string, sub: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} color={t.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{title}</Text>
        <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="chevron-right" color={t.textMuted} />
    </Pressable>
  );

  const restore = async () => {
    try {
      const backup = await pickBackupFile();
      if (!backup) return;
      const ok = await confirm('Restore backup?', `This replaces all data on this device with the backup from ${backup.exportedAt?.slice(0, 10) ?? 'unknown date'}.`);
      if (ok) await store.importBackup(backup);
    } catch (e) {
      alert(`Restore failed: ${(e as Error).message}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <SectionTitle>Aquarium</SectionTitle>
        <Card style={{ padding: 16, gap: 4 }}>
          <View style={s.row}>
            <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>Water volume</Text>
            <TextInput value={volume} onChangeText={setVolume} onBlur={saveVolume} onSubmitEditing={saveVolume} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={t.textMuted} style={[input, { width: 100, textAlign: 'right' }]} />
            <Text style={{ color: t.textSecondary, width: 20 }}>L</Text>
          </View>
          {link('history', 'Maintenance log', `${store.events.length} ${store.events.length === 1 ? 'entry' : 'entries'}: water changes, filter cleanings`, () => router.push('/history'))}
        </Card>

        <SectionTitle>Alerts</SectionTitle>
        <Card style={{ padding: 16, gap: 4 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16 }}>Notifications</Text>
              <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>
                {NOTIFICATIONS_SUPPORTED ? 'Daily summary of alerts and tasks, plus task reminders' : 'Available in the Android app'}
              </Text>
            </View>
            <Switch value={NOTIFICATIONS_SUPPORTED && store.notify.enabled} onValueChange={toggleNotify} disabled={!NOTIFICATIONS_SUPPORTED} trackColor={{ true: t.primary }} />
          </View>
          <View style={s.row}>
            <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>Daily summary at</Text>
            <TextInput value={time} onChangeText={setTime} onBlur={saveTime} onSubmitEditing={saveTime} placeholder="HH:MM" placeholderTextColor={t.textMuted} style={[input, { width: 100, textAlign: 'center' }]} />
          </View>
          {link('tune-variant', 'Rules', `${store.rules.filter((r) => r.enabled !== false).length} of ${store.rules.length} on${store.customRules.length ? ` · ${store.customRules.length} yours` : ''}`, () => router.push('/rules'))}
          {link('bell-outline', 'Active alerts', `${store.alerts.length} now`, () => router.push('/alerts'))}
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: t.textSecondary, fontSize: 15 }}>
            Data lives on this device. Keep a backup until cloud sync is added.
          </Text>
          <OutlineButton title="Back up (JSON)" icon="content-save-outline" onPress={async () => exportBackupFile(await store.exportBackup())} />
          <OutlineButton title="Restore from backup" icon="backup-restore" onPress={restore} />
          <OutlineButton title="Export all as CSV" icon="file-delimited-outline" onPress={() => exportCsv(store.series, PARAMETERS.map((p) => p.code))} />
        </Card>
        <SectionTitle>About</SectionTitle>
        <Card style={{ padding: 16 }}>
          <Text style={{ color: t.text, fontSize: 16 }}>aquaHelper {Constants.expoConfig?.version}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 6 }}>
            CO₂ is calculated from KH and pH (3 × dKH × 10^(7 − pH)). Free ammonia uses the Emerson (1975) equilibrium with pH and temperature.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  input: { minWidth: 0, borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 16 },
});
