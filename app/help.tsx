import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Claves i18n de cada sección de ayuda (título + cuerpo en help.*). */
const SECTIONS = [
  'events',
  'birthdays',
  'commitment',
  'counter',
  'copipoints',
  'drivers',
  'cars',
  'poke',
  'phrasebook',
  'songs',
  'statuses',
  'polls',
  'colors',
  'groups',
  'suggestions',
  'ios',
] as const;

/**
 * Ayuda: explica qué hace cada parte de la app en un solo sitio, accesible
 * desde el Perfil. Así las pantallas quedan limpias de botones de info que
 * solo se leen una vez.
 */
export default function HelpScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('help.title') }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('help.intro')}</ThemedText>
        {SECTIONS.map((key) => (
          <View
            key={key}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText variant="subtitle">{t(`help.${key}Title`)}</ThemedText>
            <ThemedText variant="muted" style={styles.body}>
              {t(`help.${key}Body`)}
            </ThemedText>
          </View>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  body: { lineHeight: 21 },
});
