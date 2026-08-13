import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Cuerpo del cancionero: lista de canciones del grupo. Cualquiera las lee; las
 * añaden músicos y admins. El host aporta el <Screen>.
 */
export function SongsContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { data, me, isAdmin } = useGroupData();

  if (!data) return null;

  const canEdit = !!me?.isMusician || isAdmin;
  const songs = [...(data.songs ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );

  return (
    <>
      <ThemedText variant="muted">
        {canEdit ? t('songs.subtitleMusician') : t('songs.subtitle')}
      </ThemedText>

      {canEdit && (
        <Button title={t('songs.add')} variant="outline" onPress={() => router.push('/song/new')} />
      )}

      {songs.length === 0 && <ThemedText variant="muted">{t('songs.empty')}</ThemedText>}
      {songs.map((song) => (
        <Pressable
          key={song.id}
          onPress={() => router.push({ pathname: '/song/[id]', params: { id: song.id } })}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && { opacity: 0.7 },
          ]}>
          <ThemedText variant="subtitle">{song.title}</ThemedText>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
});
