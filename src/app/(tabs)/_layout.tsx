import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/theme';

export const unstable_settings = { initialRouteName: 'index' };

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} size={30} color={color as string} />,
});

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.text,
        tabBarStyle: { backgroundColor: t.tabBar, borderTopColor: t.separator, height: 72, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11.5, marginTop: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="parameters" options={tab('Parameters', 'flask')} />
      <Tabs.Screen name="tasks" options={tab('Tasks', 'clipboard-check-outline')} />
      <Tabs.Screen name="index" options={tab('Aquarium', 'fishbowl')} />
      <Tabs.Screen name="fauna" options={tab('Fauna', 'fish')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'cog-outline')} />
    </Tabs>
  );
}
