import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MonthCalendar } from '@/components/MonthCalendar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { GroupEvent } from '@/types/models';
import { dayKey, eventsOnDay, formatEventRange } from '@/utils/date';

type ViewMode = 'list' | 'month';

/** Núcleo A: calendario de eventos del grupo. */
export default function CalendarScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, isLoading } = useGroupData();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => dayKey());

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  const now = Date.now();
  const upcoming = data.events
    .filter((e) => new Date(e.endsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = data.events
    .filter((e) => new Date(e.endsAt).getTime() < now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const dayEvents = eventsOnDay(data.events, selectedDay);

  const renderEvent = (event: GroupEvent) => {
    const myVote = data.votes.find((v) => v.eventId === event.id && v.userId === user?.id);
    const yesCount = data.votes.filter((v) => v.eventId === event.id && v.value === 'yes').length;
    const voteColor =
      myVote?.value === 'yes'
        ? theme.success
        : myVote?.value === 'no'
          ? theme.danger
          : theme.textMuted;

    return (
      <Pressable
        key={event.id}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: event.color ?? theme.surface, borderColor: theme.border },
          pressed && { opacity: 0.7 },
        ]}>
        <View style={styles.cardHeader}>
          <ThemedText variant="subtitle" style={styles.cardTitle} numberOfLines={1}>
            {event.title}
          </ThemedText>
          {event.isSpecial && (
            <ThemedText style={{ color: theme.primary }}>{t('events.specialBadge')}</ThemedText>
          )}
        </View>
        <ThemedText variant="muted">{formatEventRange(event, language)}</ThemedText>
        <View style={styles.cardFooter}>
          <ThemedText variant="muted">{t('events.yesCount', { count: yesCount })}</ThemedText>
          {myVote && (
            <ThemedText style={{ color: voteColor, fontWeight: '600' }}>
              {t(
                `events.vote${
                  myVote.value === 'yes' ? 'Yes' : myVote.value === 'no' ? 'No' : 'Deciding'
                }`,
              )}
            </ThemedText>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <ThemedText variant="title">{t('tabs.calendar')}</ThemedText>
        <Button title={t('events.create')} onPress={() => router.push('/event/new')} />
      </View>

      <View style={styles.viewToggle}>
        <Pill label={t('events.viewList')} selected={viewMode === 'list'} onPress={() => setViewMode('list')} />
        <Pill label={t('events.viewMonth')} selected={viewMode === 'month'} onPress={() => setViewMode('month')} />
      </View>

      {viewMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {upcoming.length === 0 && past.length === 0 && (
            <ThemedText variant="muted">{t('events.none')}</ThemedText>
          )}

          {upcoming.length > 0 && (
            <>
              <ThemedText variant="label">{t('events.upcoming')}</ThemedText>
              {upcoming.map(renderEvent)}
            </>
          )}

          {past.length > 0 && (
            <>
              <ThemedText variant="label" style={styles.pastHeader}>
                {t('events.past')}
              </ThemedText>
              {past.map(renderEvent)}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <MonthCalendar
            month={month}
            onChangeMonth={setMonth}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            events={data.events}
            language={language}
          />
          <ThemedText variant="label" style={styles.pastHeader}>
            {selectedDay}
          </ThemedText>
          {dayEvents.length === 0 ? (
            <ThemedText variant="muted">{t('events.agendaEmpty')}</ThemedText>
          ) : (
            dayEvents.map(renderEvent)
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewToggle: { flexDirection: 'row', gap: 8 },
  list: { gap: 10, paddingBottom: 24 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flexShrink: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  pastHeader: { marginTop: 12 },
});
