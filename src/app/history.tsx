import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Header, Icon, IconButton } from '@/components/ui';
import { confirmAction } from '@/components/WhenField';
import { useStore } from '@/data/store';
import { EVENT_LABEL } from '@/domain/events';
import { dateTime } from '@/domain/format';
import { useTheme } from '@/theme/theme';

/** Water changes and filter cleanings, newest first; tap to delete a wrong entry. */
export default function HistoryScreen() {
  const t = useTheme();
  const store = useStore();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const events = [...store.events].reverse();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Maintenance log" left={<IconButton name="arrow-left" label="Back" onPress={close} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[s.list, { borderColor: t.border }]}>
          {events.map((e, i) => (
            <Pressable
              key={e.id}
              onPress={async () => { if (await confirmAction(`Delete this ${EVENT_LABEL[e.kind].toLowerCase()} (${dateTime(e.at)})?`)) await store.deleteEvent(e.id); }}
              style={[s.row, { borderTopColor: t.separator, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0 }]}
            >
              <Icon name={e.kind === 'water_change' ? 'water-sync' : 'air-filter'} color={t.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16 }}>{EVENT_LABEL[e.kind]}{e.percent != null ? ` · ${e.percent}%` : ''}</Text>
                <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>{dateTime(e.at)}{e.note ? ` · ${e.note}` : ''}</Text>
              </View>
              <Icon name="trash-can-outline" color={t.textMuted} size={20} />
            </Pressable>
          ))}
          {!events.length && <Text style={{ color: t.textMuted, padding: 16 }}>Nothing logged yet.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
