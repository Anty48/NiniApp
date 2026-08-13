import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  COPIPOINTS_START,
  sortByCommitment,
  sortByContributions,
  sortByCopipoints,
} from '@/services/groupData';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Cuerpo del Ranking del grupo (por compromiso, contribuciones o copipuntos).
 * Se usa como una de las opciones del acceso rápido (pestaña central). Cada
 * fila abre el perfil del miembro. El host aporta el <Screen scroll>.
 */
export function LeaderboardContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data } = useGroupData();
  const [mode, setMode] = useState<'commitment' | 'contributions' | 'copipoints'>('commitment');

  if (!data) return null;

  const sorted =
    mode === 'commitment'
      ? sortByCommitment(data.members)
      : mode === 'contributions'
        ? sortByContributions(data.members)
        : sortByCopipoints(data.members);

  return (
    <>
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
        <Pill
          label={t('leaderboard.byCopipoints')}
          selected={mode === 'copipoints'}
          onPress={() => setMode('copipoints')}
        />
      </View>

      {sorted.map((member, index) => (
        <Pressable
          key={member.userId}
          onPress={() => router.push({ pathname: '/member/[id]', params: { id: member.userId } })}
          style={({ pressed }) => [
            styles.itemRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
            member.userId === user?.id && { borderColor: theme.primary },
            pressed && styles.pressed,
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
              : mode === 'contributions'
                ? member.counterContributions
                : (member.copipoints ?? COPIPOINTS_START)}
          </ThemedText>
          <ThemedText variant="muted">›</ThemedText>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
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
  pressed: { opacity: 0.7 },
});
