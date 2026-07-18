import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeHexColor, useTheme } from '@/contexts/ThemeContext';
import { confirmAsync } from '@/utils/confirm';

/**
 * Colores guardados del grupo: cualquier miembro guarda colores con nombre
 * (ej. "Verde UAB") para reutilizarlos fácilmente, por ejemplo al colorear
 * un evento.
 */
export default function GroupColorsScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { data, addSavedColor, removeSavedColor } = useGroupData();

  const [name, setName] = useState('');
  const [hexDraft, setHexDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (!data) return null;

  const colors = data.savedColors ?? [];
  const normalized = normalizeHexColor(hexDraft);

  const save = async () => {
    if (!name.trim() || !normalized) return;
    setSaving(true);
    await addSavedColor({
      id: `color-${Date.now()}`,
      name: name.trim(),
      color: normalized,
    });
    setSaving(false);
    setName('');
    setHexDraft('');
  };

  const remove = async (colorId: string, colorName: string) => {
    const ok = await confirmAsync({
      title: t('colors.deleteTitle'),
      message: t('colors.deleteMessage', { name: colorName }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) await removeSavedColor(colorId);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `🎨 ${t('groupTab.colors')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('colors.subtitle')}</ThemedText>

        {/* Añadir color */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextField
            label={t('colors.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('colors.namePlaceholder')}
          />
          <View style={styles.hexRow}>
            <View style={styles.flex}>
              <TextField
                label={t('colors.hexLabel')}
                value={hexDraft}
                onChangeText={setHexDraft}
                placeholder="#1A9E75"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <View
              style={[
                styles.preview,
                { borderColor: theme.border, backgroundColor: normalized ?? theme.background },
              ]}
            />
          </View>
          <Button
            title={t('colors.add')}
            onPress={save}
            loading={saving}
            disabled={!name.trim() || !normalized}
          />
        </View>

        {/* Colores guardados */}
        {colors.length === 0 && <ThemedText variant="muted">{t('colors.empty')}</ThemedText>}
        {colors.map((saved) => (
          <View
            key={saved.id}
            style={[styles.colorRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.swatch, { backgroundColor: saved.color, borderColor: theme.border }]} />
            <View style={styles.flex}>
              <ThemedText>{saved.name}</ThemedText>
              <ThemedText variant="muted">{saved.color}</ThemedText>
            </View>
            <Pressable
              onPress={() => remove(saved.id, saved.name)}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
            </Pressable>
          </View>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  hexRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  flex: { flex: 1 },
  preview: { width: 48, height: 48, borderRadius: 12, borderWidth: 1 },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
});
