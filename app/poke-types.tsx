import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { confirmAsync } from '@/utils/confirm';

const MAX_POKES = 10;

/**
 * Tipos de "toque" del grupo: cualquier miembro define palabras propias
 * ("saludado", "abrazado"...) y cuántas notificaciones se mandan de golpe
 * (1-10). Aparecen al desplegar el botón "Tocar" en el perfil de un miembro.
 * El toque estándar ("te ha tocado", 1 aviso) siempre está disponible.
 */
export default function PokeTypesScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { data, savePokeType, removePokeType } = useGroupData();

  const [participle, setParticiple] = useState('');
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!data) return null;

  const types = data.pokeTypes ?? [];
  const clean = participle.trim();

  const save = async () => {
    if (!clean) return;
    setSaving(true);
    await savePokeType({ id: `poke-${Date.now()}`, participle: clean, count });
    setSaving(false);
    setParticiple('');
    setCount(1);
  };

  const remove = async (id: string, label: string) => {
    const ok = await confirmAsync({
      title: t('pokeTypes.deleteTitle'),
      message: t('pokeTypes.deleteMessage', { name: label }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) await removePokeType(id);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `👉 ${t('groupTab.pokeTypes')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('pokeTypes.subtitle')}</ThemedText>

        {/* Vista previa del texto de la notificación */}
        {clean !== '' && (
          <ThemedText variant="muted" style={{ color: theme.primary }}>
            {t('pokeTypes.preview', { participle: clean })}
          </ThemedText>
        )}

        {/* Añadir tipo */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextField
            label={t('pokeTypes.participleLabel')}
            value={participle}
            onChangeText={setParticiple}
            placeholder={t('pokeTypes.participlePlaceholder')}
            autoCapitalize="none"
          />
          <ThemedText variant="label">{t('pokeTypes.countLabel')}</ThemedText>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setCount((c) => Math.max(1, c - 1))}
              style={[styles.stepBtn, { borderColor: theme.border }]}>
              <ThemedText variant="title">−</ThemedText>
            </Pressable>
            <ThemedText variant="title" style={styles.stepValue}>
              {count}
            </ThemedText>
            <Pressable
              onPress={() => setCount((c) => Math.min(MAX_POKES, c + 1))}
              style={[styles.stepBtn, { borderColor: theme.border }]}>
              <ThemedText variant="title">+</ThemedText>
            </Pressable>
          </View>
          <ThemedText variant="muted">{t('pokeTypes.countHint', { count: MAX_POKES })}</ThemedText>
          <Button title={t('pokeTypes.add')} onPress={save} loading={saving} disabled={!clean} />
        </View>

        {/* Tipos guardados */}
        {types.length === 0 && <ThemedText variant="muted">{t('pokeTypes.empty')}</ThemedText>}
        {types.map((type) => (
          <View
            key={type.id}
            style={[styles.typeRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.flex}>
              <ThemedText>👉 {type.participle}</ThemedText>
              <ThemedText variant="muted">
                {t('pokeTypes.countBadge', { count: type.count })}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => remove(type.id, type.participle)}
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
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 40, textAlign: 'center' },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
});
