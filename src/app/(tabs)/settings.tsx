import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Card, Header, OutlineButton, SectionTitle } from '@/components/ui';
import { useStore } from '@/data/store';
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

export default function SettingsScreen() {
  const t = useTheme();
  const store = useStore();

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
