import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as groupsService from '@/services/groups';

/** Unirse a un grupo existente con su ID y contraseña de acceso. */
export default function JoinGroupScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user, addGroup, canAddGroup } = useAuth();

  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!groupId.trim() || !password || !user) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const group = await groupsService.joinGroup(groupId, password, user);
      await addGroup(group);
      router.replace('/(tabs)/calendar');
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'join-invalid'
          ? t('onboarding.joinError')
          : t('common.error'),
      );
      setLoading(false);
    }
  };

  if (!canAddGroup) {
    return (
      <Screen style={styles.container}>
        <ThemedText variant="title">{t('groups.maxReached')}</ThemedText>
        <Button title={t('common.continue')} onPress={() => router.back()} variant="outline" />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title">{t('onboarding.joinGroup')}</ThemedText>

      <TextField
        label={t('onboarding.groupId')}
        value={groupId}
        onChangeText={setGroupId}
        autoCapitalize="characters"
      />
      <TextField
        label={t('onboarding.groupPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title={t('onboarding.join')} onPress={join} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 14 },
});
