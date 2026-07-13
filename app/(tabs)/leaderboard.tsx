import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { sortByCommitment, sortByContributions } from '@/services/groupData';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Clasificación del grupo: por % de compromiso o por contribuciones. */
export default function LeaderboardScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, isLoading } = useGroupData();
  const [mode, setMode] = useState<'commitment' | 'contributions'>('commitment');

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  const sorted =
    mode === 'commitment' ? sortByCommitment(data.members) : sortByContributions(data.members);

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title">{t('tabs.leaderboard')}</ThemedText>

      <View style={styles.row}>
        <Pill
          label={t('leaderboard.byCommitment')}
          selected={mode === 'commitment'}
          onPress={() => setMode('commitment')}
        />
        <Pill
          label={t('leaderboard.byContributions')}
          selected={mode === 'contributions'}
          onPress={() => setMode('contributions')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {sorted.map((member, index) => (
          <View
            key={member.userId}
            style={[
              styles.itemRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
              member.userId === user?.id && { borderColor: theme.primary },
            ]}>
            <ThemedText style={styles.rank}>{MEDALS[index] ?? `${index + 1}.`}</ThemedText>
            <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={36} />
            <ThemedText style={styles.name} numberOfLines={1}>
              {member.nickname ?? member.name}
              {member.userId === user?.id ? ` (${t('common.you')})` : ''}
            </ThemedText>
            <ThemedText variant="subtitle">
              {mode === 'commitment'
                ? `${Math.round(member.commitmentScore)}%`
                : member.counterContributions}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  list: { gap: 8, paddingBottom: 24 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  rank: { width: 34, fontSize: 16 },
  name: { flex: 1 },
});
