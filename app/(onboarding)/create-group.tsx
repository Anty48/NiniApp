import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as groupsService from '@/services/groups';
import { Group } from '@/types/models';

/**
 * Crear grupo: el creador elige nombre y, si quiere, la contraseña de acceso
 * (vacía = se genera automáticamente). Se convierte en administrador y las
 * credenciales se muestran antes de continuar para poder compartirlas.
 */
export default function CreateGroupScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user, addGroup, canAddGroup } = useAuth();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  const create = async () => {
    if (!name.trim() || !user) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const group = await groupsService.createGroup(name.trim(), user, password);
      setCreatedGroup(group);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    if (!createdGroup) return;
    setLoading(true);
    await addGroup(createdGroup);
    router.replace('/(tabs)/calendar');
  };

  if (!canAddGroup && !createdGroup) {
    return (
      <Screen style={styles.container}>
        <ThemedText variant="title">{t('groups.maxReached')}</ThemedText>
        <Button title={t('common.continue')} onPress={() => router.back()} variant="outline" />
      </Screen>
    );
  }

  if (createdGroup) {
    return (
      <Screen style={styles.container}>
        <ThemedText variant="title">{t('onboarding.createdTitle')}</ThemedText>
        <ThemedText variant="muted">{t('onboarding.createdShare')}</ThemedText>

        <View
          style={[styles.credentials, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText variant="label">{t('onboarding.groupId')}</ThemedText>
          <ThemedText variant="title">{createdGroup.id}</ThemedText>
          <ThemedText variant="label" style={styles.spaced}>
            {t('onboarding.groupPassword')}
          </ThemedText>
          <ThemedText variant="subtitle">{createdGroup.accessPassword}</ThemedText>
        </View>

        <Button title={t('common.continue')} onPress={finish} loading={loading} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title">{t('onboarding.createGroup')}</ThemedText>

      <TextField label={t('onboarding.groupName')} value={name} onChangeText={setName} />
      <TextField
        label={t('onboarding.passwordOptional')}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title={t('onboarding.create')} onPress={create} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 14 },
  credentials: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 4 },
  spaced: { marginTop: 12 },
});
