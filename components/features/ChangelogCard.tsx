import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { i18n } from '@/i18n';

/** Versiones listadas, de la más nueva a la más antigua (claves en changelog.*). */
export const CHANGELOG_VERSIONS = ['v1_5', 'v1_4', 'v1_3', 'v1_2', 'v1_1_1', 'v1_1', 'v1_0'] as const;

/** Tarjeta de una versión del registro de cambios (pantalla /changelog y Perfil). */
export function ChangelogCard({ version }: { version: (typeof CHANGELOG_VERSIONS)[number] }) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  // i18n.t devuelve el array de viñetas tal cual está en el JSON.
  const items = i18n.t(`changelog.${version}.items`) as unknown as string[];
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  item: { lineHeight: 21 },
});
