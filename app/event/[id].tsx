import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { hasEnded, hasStarted, isVoteLocked, voteLockTime } from '@/services/groupData';
import { EventVoteValue } from '@/types/models';
import { confirmAsync } from '@/utils/confirm';
import { formatDateTime, formatEventRange } from '@/utils/date';

/** Detalle de evento: información, votación, coches y validación de asistencia. */
export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, vote, setAttendance, toggleCarSeat, deleteEvent } = useGroupData();

  const event = data?.events.find((e) => e.id === id);

  if (!data || !event) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">404</ThemedText>
      </Screen>
    );
  }

  const isCreator = event.createdBy === user?.id;
  // Solo los eventos "normales" tienen votación (informal y día especial, no).
  const hasVoting = !event.kind || event.kind === 'standard';
  const started = hasStarted(event);
  const ended = hasEnded(event);
  const locked = isVoteLocked(event);
  const myVote = data.votes.find((v) => v.eventId === event.id && v.userId === user?.id);
  const eventVotes = data.votes.filter((v) => v.eventId === event.id);
  const yesVotes = eventVotes.filter((v) => v.value === 'yes');

  const memberName = (userId: string) => {
    const m = data.members.find((x) => x.userId === userId);
    return m ? (m.nickname ?? m.name) : '—';
  };

  const castVote = async (value: EventVoteValue) => {
    if (started || myVote?.value === value) return;
    if (locked && myVote) {
      const ok = await confirmAsync({
        title: t('events.lateChangeTitle'),
        message: t('events.lateChangeMessage'),
        confirmLabel: t('common.continue'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    await vote(event.id, value);
  };

  const onDelete = async () => {
    const ok = await confirmAsync({
      title: t('events.deleteTitle'),
      message: t('events.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deleteEvent(event.id);
    router.back();
  };

  const openMap = () => {
    if (!event.mapsAddress) return;
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapsAddress)}`,
    );
  };

  const voteOptions: { value: EventVoteValue; label: string; color: string }[] = [
    { value: 'yes', label: t('events.voteYes'), color: theme.success },
    { value: 'no', label: t('events.voteNo'), color: theme.danger },
    { value: 'deciding', label: t('events.voteDeciding'), color: theme.textMuted },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: event.title }} />
      <Screen scroll style={styles.container}>
        <View style={styles.titleRow}>
          {event.color && <View style={[styles.colorDot, { backgroundColor: event.color }]} />}
          <ThemedText variant="title" style={styles.flex}>
            {event.title}
          </ThemedText>
          {event.isSpecial && (
            <ThemedText style={{ color: theme.primary }}>{t('events.specialBadge')}</ThemedText>
          )}
          {event.kind === 'informal' && (
            <ThemedText style={{ color: theme.primary }}>{t('events.informalBadge')}</ThemedText>
          )}
          {event.kind === 'specialDay' && (
            <ThemedText style={{ color: theme.primary }}>{t('events.specialDayBadge')}</ThemedText>
          )}
        </View>

        <ThemedText variant="muted">{formatEventRange(event, language)}</ThemedText>

        {event.description && <ThemedText>{event.description}</ThemedText>}

        {event.mapsAddress && (
          <Button title={t('events.openMap')} onPress={openMap} variant="outline" />
        )}

        {/* Votación (solo eventos normales) */}
        {!hasVoting && (
          <ThemedText variant="muted">{t('events.noVotingHint')}</ThemedText>
        )}
        {hasVoting && (
          <>
        <ThemedText variant="label">{t('events.attendance')}</ThemedText>
        <ThemedText variant="muted">
          {locked
            ? t('events.votingClosed')
            : t('events.votingClosesAt', {
                time: formatDateTime(voteLockTime(event).toISOString(), language),
              })}
        </ThemedText>
        {!started && (
          <View style={styles.row}>
            {voteOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={myVote?.value === option.value}
                selectedColor={option.color}
                onPress={() => castVote(option.value)}
              />
            ))}
          </View>
        )}

        {/* Votos de todos los miembros */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {data.members.map((member) => {
            const memberVote = eventVotes.find((v) => v.userId === member.userId);
            const color =
              memberVote?.value === 'yes'
                ? theme.success
                : memberVote?.value === 'no'
                  ? theme.danger
                  : theme.textMuted;
            return (
              <View key={member.userId} style={styles.voteRow}>
                <ThemedText>
                  {member.nickname ?? member.name}
                  {member.userId === user?.id ? ` (${t('common.you')})` : ''}
                </ThemedText>
                <ThemedText style={{ color, fontWeight: '600' }}>
                  {memberVote
                    ? t(
                        `events.vote${
                          memberVote.value === 'yes'
                            ? 'Yes'
                            : memberVote.value === 'no'
                              ? 'No'
                              : 'Deciding'
                        }`,
                      )
                    : '—'}
                </ThemedText>
              </View>
            );
          })}
        </View>
          </>
        )}

        {/* Coches */}
        {event.cars && event.cars.length > 0 && (
          <>
            <ThemedText variant="label">{t('events.carsSection')}</ThemedText>
            {hasVoting && myVote?.value !== 'yes' && (
              <ThemedText variant="muted">{t('events.seatHint')}</ThemedText>
            )}
            {event.cars.map((car) => {
              const owner = car.driverId ? data.members.find((m) => m.userId === car.driverId) : null;
              const title = owner
                ? (owner.carDetails?.name ?? owner.nickname ?? owner.name)
                : (car.name ?? t('events.carsSection'));
              const subtitle = owner?.carDetails
                ? [
                    owner.carDetails.name ? (owner.nickname ?? owner.name) : null,
                    owner.carDetails.model,
                    owner.carDetails.color,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null;
              return (
              <View
                key={car.id}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText variant="subtitle">
                  {title}
                  {owner ? ' 🚗' : ''}
                </ThemedText>
                {subtitle && <ThemedText variant="muted">{subtitle}</ThemedText>}
                {Array.from({ length: car.seats }).map((_, seatIndex) => {
                  const occupant = car.occupants[seatIndex];
                  const isMe = occupant === user?.id;
                  // En quedadas informales no hay votación: cualquiera coge plaza.
                  const canTake =
                    !occupant && !ended && (!hasVoting || myVote?.value === 'yes');
                  return (
                    <Pressable
                      key={seatIndex}
                      disabled={!isMe && !canTake}
                      onPress={() => toggleCarSeat(event.id, car.id)}
                      style={({ pressed }) => [
                        styles.seatRow,
                        { borderColor: theme.border },
                        pressed && { opacity: 0.6 },
                      ]}>
                      <ThemedText style={isMe ? { color: theme.primary, fontWeight: '600' } : undefined}>
                        {occupant
                          ? `${memberName(occupant)}${isMe ? ` (${t('common.you')})` : ''}`
                          : t('events.freeSeat')}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              );
            })}
          </>
        )}

        {/* Validación de asistencia (creador, tras el evento) */}
        {hasVoting && isCreator && ended && yesVotes.length > 0 && (
          <>
            <ThemedText variant="label">{t('events.validateTitle')}</ThemedText>
            <ThemedText variant="muted">{t('events.validateHint')}</ThemedText>
            {yesVotes.map((yesVote) => (
              <View key={yesVote.userId} style={styles.validateRow}>
                <ThemedText style={styles.flex}>{memberName(yesVote.userId)}</ThemedText>
                <Pill
                  label={t('events.attended')}
                  selected={yesVote.attendanceConfirmed === true}
                  selectedColor={theme.success}
                  onPress={() => setAttendance(event.id, yesVote.userId, true)}
                />
                <Pill
                  label={t('events.noShow')}
                  selected={yesVote.attendanceConfirmed === false}
                  selectedColor={theme.danger}
                  onPress={() => setAttendance(event.id, yesVote.userId, false)}
                />
              </View>
            ))}
          </>
        )}

        {/* Acciones del creador */}
        {isCreator && (
          <>
            <Button
              title={t('common.edit')}
              variant="outline"
              onPress={() => router.push({ pathname: '/event/new', params: { id: event.id } })}
            />
            <Button title={t('common.delete')} variant="ghost" onPress={onDelete} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  voteRow: { flexDirection: 'row', justifyContent: 'space-between' },
  seatRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  validateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
