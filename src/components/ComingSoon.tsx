import { Text, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { Header, Icon, type IconName } from './ui';

export function ComingSoon({ title, icon, text }: { title: string; icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title={title} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <Icon name={icon} size={48} color={t.textMuted} />
        <Text style={{ color: t.textSecondary, fontSize: 17, textAlign: 'center' }}>{text}</Text>
      </View>
    </View>
  );
}
