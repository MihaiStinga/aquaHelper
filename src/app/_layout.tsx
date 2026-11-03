import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DATABASE_NAME, migrate } from '@/data/db';
import { StoreProvider, useStore } from '@/data/store';
import { useNotifications } from '@/data/useNotifications';
import { useTheme } from '@/theme/theme';

function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.primary} />
    </View>
  );
}

function Navigator() {
  const t = useTheme();
  const { ready } = useStore();
  useNotifications();
  if (!ready) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="parameter/[code]" />
      <Stack.Screen name="log" options={{ presentation: 'modal' }} />
      <Stack.Screen name="manage" />
      <Stack.Screen name="water-change" options={{ presentation: 'modal' }} />
      <Stack.Screen name="task-edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="rules" />
      <Stack.Screen name="history" />
    </Stack>
  );
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} useSuspense>
          <StoreProvider>
            <Navigator />
          </StoreProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
