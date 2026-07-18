import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { FONT_REGULAR } from '@/constants/typography';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Crear / editar canción (solo músicos y admins). Se entra con ?id= para editar. */
export default function SongFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, me, isAdmin, saveSong } = useGroupData();

  const editing = data?.songs?.find((s) => s.id === id);
  const canEdit = !!me?.isMusician || isAdmin;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [lyrics, setLyrics] = useState(editing?.lyrics ?? '');
  const [saving, setSaving] = useState(false);

  if (!data || !canEdit) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('songs.add') }} />
        <Screen style={styles.center}>
          <ThemedText style={styles.bigEmoji}>🎵</ThemedText>
          <ThemedText variant="muted">{t('songs.onlyMusicians')}</ThemedText>
        </Screen>
      </>
    );
  }

  const save = async () => {
    if (!title.trim() || !lyrics.trim() || !user) return;
    setSaving(true);
    await saveSong({
      id: editing?.id ?? `song-${Date.now()}`,
      title: title.trim(),
      // La letra se guarda tal cual (sin trim por línea): los espacios y la
      // indentación forman parte del formato.
      lyrics: lyrics.replace(/\s+$/, ''),
      createdBy: editing?.createdBy ?? user.id,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: editing ? t('songs.editTitle') : t('songs.add') }}
      />
      <Screen scroll style={styles.container}>
        <TextField label={t('songs.formTitle')} value={title} onChangeText={setTitle} />
        <ThemedText variant="label">{t('songs.formLyrics')}</ThemedText>
        <ThemedText variant="muted">{t('songs.lyricsHint')}</ThemedText>
        <TextInput
          value={lyrics}
          onChangeText={setLyrics}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('songs.lyricsPlaceholder')}
          placeholderTextColor={theme.textMuted}
          style={[
            styles.lyricsInput,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
              fontFamily: FONT_REGULAR,
            },
          ]}
        />
        <Button
          title={t('common.save')}
          onPress={save}
          loading={saving}
          disabled={!title.trim() || !lyrics.trim()}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigEmoji: { fontSize: 48 },
  lyricsInput: {
    minHeight: 260,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
});
