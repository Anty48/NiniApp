import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { i18n } from '@/i18n';

/** Versiones listadas, de la más nueva a la más antigua (claves en changelog.*). */
const VERSIONS = ['v1_1', 'v1_0'] as const;

/** Registro de cambios de la app, accesible desde el Perfil. */
export default function ChangelogScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('changelog.title') }} />
      <Screen scroll style={styles.container}>
        {VERSIONS.map((version) => {
          // i18n.t devuelve el array de viñetas tal cual está en el JSON.
          const items = i18n.t(`changelog.${version}.items`) as unknown as string[];
          return (
            <View
              key={version}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.header}>
                <ThemedText variant="subtitle">{t(`changelog.${version}.name`)}</ThemedText>
                <ThemedText variant="muted">{t(`changelog.${version}.date`)}</ThemedText>
              </View>
              {items.map((item, index) => (
                <ThemedText key={index} style={styles.item}>
                  •  {item}
                </ThemedText>
              ))}
            </View>
          );
        })}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  item: { lineHeight: 21 },
});
