import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertItem } from '@/components/AlertItem';
import { Header, IconButton } from '@/components/ui';
import { useStore } from '@/data/store';
import { useTheme } from '@/theme/theme';

export default function AlertsScreen() {
  const t = useTheme();
  const store = useStore();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title="Alerts"
        left={<IconButton name="arrow-left" label="Back" onPress={close} />}
        right={<IconButton name="tune-variant" label="Rules" onPress={() => router.push('/rules')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {store.alerts.map((a) => (
          <AlertItem key={a.key} alert={a} onDismiss={() => store.dismissAlert(a.key)} />
        ))}
        {!store.alerts.length && (
          <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 }}>
            No alerts. Rules are checked every time you log a test and once a minute.
          </Text>
        )}
        <Text style={{ color: t.textMuted, fontSize: 14, marginTop: 8 }}>
          Tap an alert for what to do. A dismissed alert comes back when new data makes it true again.
        </Text>
      </ScrollView>
    </View>
  );
}
