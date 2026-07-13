import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lastPokeAt, POKE_COOLDOWN_MS } from '@/services/groupData';

/** Perfil de un miembro del grupo, con el botón de "Tocar". */
export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, pokeMember } = useGroupData();

  const [status, setStatus] = useState<'idle' | 'sent' | 'cooldown'>('idle');

  const member = data?.members.find((m) => m.userId === id);

  if (!data || !member) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">404</ThemedText>
      </Screen>
    );
  }

  const isMe = member.userId === user?.id;
  const pokesDisabled = member.allowPokes === false;
  const last = user ? lastPokeAt(data, user.id, member.userId) : null;
  const onCooldown =
    status === 'cooldown' || (last !== null && Date.now() - last < POKE_COOLDOWN_MS);
  const hoursLeft = last
    ? Math.max(1, Math.ceil((POKE_COOLDOWN_MS - (Date.now() - last)) / 3_600_000))
    : 24;

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
            </ThemedText>
          </View>
        </View>

        {member.description && <ThemedText>{member.description}</ThemedText>}

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
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  stat: { alignItems: 'center' },
});
