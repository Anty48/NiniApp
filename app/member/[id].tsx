import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lastPokeAt, pokeCooldownMs } from '@/services/groupData';
import { getItem, setItem, StorageKeys } from '@/services/storage';

/** Perfil de un miembro: estado, estadísticas, frases del Frasario y "Tocar". */
export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, me, pokeMember } = useGroupData();

  const [status, setStatus] = useState<'idle' | 'sent' | 'cooldown'>('idle');

  const member = data?.members.find((m) => m.userId === id);
  const memberStatus = data?.statuses?.find((s) => s.userId === id);

  // Ver el perfil marca su estado como visto en este dispositivo.
  useEffect(() => {
    if (!data || !memberStatus) return;
    (async () => {
      const seen = (await getItem<Record<string, string>>(StorageKeys.seenStatuses)) ?? {};
      const key = `${data.group.id}:${memberStatus.userId}`;
      if (seen[key] !== memberStatus.at) {
        await setItem(StorageKeys.seenStatuses, { ...seen, [key]: memberStatus.at });
      }
    })();
  }, [data?.group.id, memberStatus?.userId, memberStatus?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !member) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">404</ThemedText>
      </Screen>
    );
  }

  const isMe = member.userId === user?.id;
  const pokesDisabled = member.allowPokes === false;
  // El cooldown depende de MI compromiso: 12 h al 100%, hasta 24 h al 0%.
  const cooldownMs = pokeCooldownMs(me?.commitmentScore ?? 100);
  const last = user ? lastPokeAt(data, user.id, member.userId) : null;
  const onCooldown =
    status === 'cooldown' || (last !== null && Date.now() - last < cooldownMs);
  const hoursLeft = last
    ? Math.max(1, Math.ceil((cooldownMs - (Date.now() - last)) / 3_600_000))
    : Math.ceil(cooldownMs / 3_600_000);

  const myPhrases = (data.phrases ?? []).filter((p) => p.memberId === member.userId);

  const poke = async () => {
    const result = await pokeMember(member.userId);
    if (result === 'ok') setStatus('sent');
    else if (result === 'cooldown') setStatus('cooldown');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: member.nickname ?? member.name }} />
      <Screen scroll style={styles.container}>
        <View style={styles.headerRow}>
          <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={84} />
          <View style={styles.flex}>
            <ThemedText variant="title">{member.nickname ?? member.name}</ThemedText>
            {member.nickname && <ThemedText variant="muted">{member.name}</ThemedText>}
            <ThemedText
              variant="muted"
              style={member.role === 'admin' ? { color: theme.primary, fontWeight: '600' } : undefined}>
              {member.role === 'admin' ? t('group.roleAdmin') : t('group.roleMember')}
              {member.isDriver ? ' · 🚗' : ''}
              {member.isMusician ? ' · 🎵' : ''}
            </ThemedText>
          </View>
        </View>

        {member.description && <ThemedText>{member.description}</ThemedText>}

        {/* Estado efímero (24 h) */}
        {memberStatus && (
          <View
            style={[
              styles.statusCard,
              { backgroundColor: theme.primary + '15', borderColor: theme.primary },
            ]}>
            <ThemedText variant="label">{t('statuses.label')}</ThemedText>
            {memberStatus.text && <ThemedText>{memberStatus.text}</ThemedText>}
            {memberStatus.photoUrl && (
              <Image source={{ uri: memberStatus.photoUrl }} style={styles.statusPhoto} />
            )}
          </View>
        )}

        {/* Estadísticas en el grupo */}
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.stat}>
            <ThemedText variant="title">{Math.round(member.commitmentScore)}%</ThemedText>
            <ThemedText variant="muted">{t('profile.myCommitment')}</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText variant="title">{member.counterContributions}</ThemedText>
            <ThemedText variant="muted">{t('profile.myContributions')}</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText variant="title">{member.personalStreakDays}</ThemedText>
            <ThemedText variant="muted">{t('member.personalStreak')}</ThemedText>
          </View>
        </View>

        {/* Tocar */}
        {!isMe &&
          (pokesDisabled ? (
            <ThemedText variant="muted">{t('poke.disabledByUser')}</ThemedText>
          ) : status === 'sent' ? (
            <ThemedText style={{ color: theme.success, fontWeight: '600' }}>
              {t('poke.sent')}
            </ThemedText>
          ) : onCooldown ? (
            <ThemedText variant="muted">{t('poke.cooldown', { hours: hoursLeft })}</ThemedText>
          ) : (
            <Button title={t('poke.button')} onPress={poke} />
          ))}

        {/* Frases suyas en el Frasario del grupo */}
        {myPhrases.length > 0 && (
          <>
            <ThemedText variant="label">📖 {t('member.phrases')}</ThemedText>
            <View style={[styles.statsCard, styles.phrasesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {myPhrases.map((phrase) => (
                <ThemedText key={phrase.id}>
                  {`"${phrase.text}" — ${member.nickname ?? member.name}`}
                </ThemedText>
              ))}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  statusCard: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 6 },
  statusPhoto: { width: '100%', height: 220, borderRadius: 12, resizeMode: 'cover' },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  phrasesCard: { flexDirection: 'column', justifyContent: 'flex-start', gap: 8 },
  stat: { alignItems: 'center' },
});
