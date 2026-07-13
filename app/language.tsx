import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LANGUAGE_LABELS, Language, SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * Primer arranque: selección de idioma obligatoria (ca / es / en).
 * Se guarda localmente; al elegir, el guard lleva al login.
 */
export default function LanguageScreen() {
  const { theme } = useTheme();
  const { setLanguage } = useLanguage();

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title">Tria el teu idioma</ThemedText>
      <ThemedText variant="muted">Elige tu idioma · Choose your language</ThemedText>

      {SUPPORTED_LANGUAGES.map((lang: Language) => (
        <Pressable
          key={lang}
          onPress={() => setLanguage(lang)}
          style={({ pressed }) => [
            styles.option,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && { opacity: 0.7 },
          ]}>
          <Text style={[styles.optionText, { color: theme.text }]}>
            {LANGUAGE_LABELS[lang]}
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 14 },
  option: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: 18, fontWeight: '600' },
});
