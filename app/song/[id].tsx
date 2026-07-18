import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { confirmAsync } from '@/utils/confirm';

/** Lectura de una canción: título y letra respetando espacios e indentación. */
export default function SongDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data, me, isAdmin, deleteSong } = useGroupData();

  const song = data?.songs?.find((s) => s.id === id);

  if (!data || !song) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">404</ThemedText>
      </Screen>
    );
  }

  const canEdit = !!me?.isMusician || isAdmin;

  const onDelete = async () => {
    const ok = await confirmAsync({
      title: t('songs.deleteTitle'),
      message: t('songs.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deleteSong(song.id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: song.title }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="title">{song.title}</ThemedText>
        {/* La letra va tal cual se escribió: saltos de línea e indentación. */}
        <ThemedText style={styles.lyrics}>{song.lyrics}</ThemedText>
        {canEdit && (
          <>
            <Button
              title={t('common.edit')}
              variant="outline"
              onPress={() => router.push({ pathname: '/song/new', params: { id: song.id } })}
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
  lyrics: { lineHeight: 24 },
});
