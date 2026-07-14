import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ensurePhotoUploaded } from '@/services/photos';
import { pickImage } from '@/utils/pickImage';

/** Edición del perfil propio: foto, nombre de usuario, apodo y descripción. */
export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { updateMyProfile } = useGroupData();

  const [username, setUsername] = useState(user?.username ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [description, setDescription] = useState(user?.description ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changePhoto = async () => {
    const photo = await pickImage(true);
    if (photo) setPhotoUrl(photo);
  };

  const save = async () => {
    if (!user) return;
    if (!username.trim()) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // La foto elegida se previsualiza con su URI local y solo se sube a
      // Storage al guardar; en el perfil se persiste la URL remota.
      const remotePhotoUrl = await ensurePhotoUploaded(
        photoUrl,
        `users/${user.id}/profile-${Date.now()}.jpg`,
      );
      await updateMyProfile({
        username: username.trim(),
        nickname: nickname.trim() || undefined,
        description: description.trim() || undefined,
        photoUrl: remotePhotoUrl,
      });
      router.back();
    } catch {
      setError(t('common.photoUploadError'));
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('profile.editProfile') }} />
      <Screen scroll style={styles.container}>
        <View style={styles.photoRow}>
          <Avatar uri={photoUrl} name={username || '?'} size={84} />
          <Button title={t('profile.changePhoto')} variant="outline" onPress={changePhoto} />
        </View>

        <TextField label={t('auth.username')} value={username} onChangeText={setUsername} />
        <TextField label={t('profile.nickname')} value={nickname} onChangeText={setNickname} />
        <TextField
          label={t('profile.description')}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        <Button title={t('common.save')} onPress={save} loading={saving} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
