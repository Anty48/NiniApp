import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Pantalla bloqueante tras el login: la app no tiene sentido sin grupo,
 * así que se obliga a crear uno o unirse a uno existente.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const options = [
    {
      title: t('onboarding.createGroup'),
      hint: t('onboarding.createGroupHint'),
      route: '/(onboarding)/create-group' as const,
    },
    {
      title: t('onboarding.joinGroup'),
      hint: t('onboarding.joinGroupHint'),
      route: '/(onboarding)/join-group' as const,
    },
  ];

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title">{t('onboarding.title')}</ThemedText>
      <ThemedText variant="muted">{t('onboarding.subtitle')}</ThemedText>

      {options.map((option) => (
        <Pressable
          key={option.route}
          onPress={() => router.push(option.route)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && { opacity: 0.7 },
          ]}>
          <ThemedText variant="subtitle">{option.title}</ThemedText>
          <ThemedText variant="muted">{option.hint}</ThemedText>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 6,
  },
});
