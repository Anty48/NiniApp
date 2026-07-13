import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Configuración del contador del grupo (solo admin). Cada grupo tiene como
 * máximo UN contador activo; editarlo no borra el acumulado ni la racha.
 */
export default function CounterSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { data, isAdmin, saveCounter } = useGroupData();

  const existing = data?.counter ?? null;
  const [name, setName] = useState(existing?.name ?? '');
  const [initialValue, setInitialValue] = useState(String(existing?.initialValue ?? 0));
  const [anyoneCan, setAnyoneCan] = useState(existing?.anyoneCanIncrement ?? true);
  const [multiplePerDay, setMultiplePerDay] = useState(existing?.multiplePerDay ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data || !isAdmin) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="muted">{t('counter.emptyMemberHint')}</ThemedText>
      </Screen>
    );
  }

  const save = async () => {
    if (!name.trim()) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setSaving(true);
    const initial = parseInt(initialValue, 10) || 0;
    await saveCounter({
      groupId: data.group.id,
      name: name.trim(),
      // Al crear, el total arranca en el valor inicial; al editar se conserva.
      totalValue: existing ? existing.totalValue : initial,
      initialValue: initial,
      anyoneCanIncrement: anyoneCan,
      multiplePerDay,
      streakDays: existing?.streakDays ?? 0,
      lastContributionDate: existing?.lastContributionDate,
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: existing ? t('counter.configure') : t('counter.create'),
        }}
      />
      <Screen scroll style={styles.container}>
        <TextField label={t('counter.name')} value={name} onChangeText={setName} />
        {!existing && (
          <TextField
            label={t('counter.initialValue')}
            value={initialValue}
            onChangeText={setInitialValue}
            keyboardType="numeric"
          />
        )}

        <View style={styles.switchRow}>
          <ThemedText>{t('counter.anyoneCan')}</ThemedText>
          <Switch value={anyoneCan} onValueChange={setAnyoneCan} />
        </View>
        <View style={styles.switchRow}>
          <ThemedText>{t('counter.multiplePerDay')}</ThemedText>
          <Switch value={multiplePerDay} onValueChange={setMultiplePerDay} />
        </View>

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        <Button title={t('common.save')} onPress={save} loading={saving} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
