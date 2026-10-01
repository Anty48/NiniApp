import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { TSTATS_INK, TSTATS_LOGO, TSTATS_URL, TSTATS_YELLOW } from '@/constants/developer';
import { FONT_BOLD, FONT_REGULAR } from '@/constants/typography';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Qué hace T-Stats (icono + claves i18n en tstats.*). */
const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'map-marker-path', key: 'Track' },
  { icon: 'chart-bar', key: 'Visualize' },
  { icon: 'trophy-outline', key: 'Game' },
  { icon: 'devices', key: 'Platforms' },
];

/**
 * Presentación de T-Stats, la nueva app del desarrollador. Se llega desde el
 * Perfil o desde el popup de novedades. Mientras su web no exista
 * (`TSTATS_URL` null), en lugar del botón se avisa de que "se está cocinando".
 */
export default function TStatsScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'T-Stats' }} />
      <Screen scroll style={styles.container}>
        {/* Héroe con los colores de la marca */}
        <View style={styles.hero}>
          <Image source={TSTATS_LOGO} style={styles.logo} />
          <Text style={styles.kicker}>{t('tstats.kicker')}</Text>
          <Text style={styles.title}>T-Stats</Text>
          <Text style={styles.tagline}>{t('tstats.tagline')}</Text>
          <Text style={styles.description}>{t('tstats.description')}</Text>
        </View>

        {FEATURES.map((f) => (
          <View
            key={f.key}
            style={[styles.feature, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.featureIcon}>
              <Icon name={f.icon} size={24} color={TSTATS_INK} />
            </View>
            <View style={styles.flex}>
              <ThemedText variant="subtitle">{t(`tstats.feat${f.key}Title`)}</ThemedText>
              <ThemedText variant="muted">{t(`tstats.feat${f.key}Body`)}</ThemedText>
            </View>
          </View>
        ))}

        {TSTATS_URL ? (
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(TSTATS_URL!)}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
            <Text style={styles.ctaText}>{t('tstats.open')}</Text>
            <Icon name="open-in-new" size={18} color={TSTATS_YELLOW} />
          </Pressable>
        ) : (
          <View style={[styles.soon, { borderColor: theme.border }]}>
            <Icon name="chef-hat" size={28} color={theme.text} />
            <View style={styles.flex}>
              <ThemedText variant="subtitle">{t('tstats.comingSoon')}</ThemedText>
              <ThemedText variant="muted">{t('tstats.comingSoonHint')}</ThemedText>
            </View>
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40, gap: 12 },
  flex: { flex: 1 },
  hero: {
    backgroundColor: TSTATS_YELLOW,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 104,
    height: 104,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: TSTATS_INK,
    marginBottom: 8,
  },
  kicker: {
    color: TSTATS_INK,
    fontFamily: FONT_BOLD,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  title: { color: TSTATS_INK, fontFamily: FONT_BOLD, fontSize: 34 },
  tagline: { color: TSTATS_INK, fontFamily: FONT_BOLD, fontSize: 17, textAlign: 'center' },
  description: {
    color: TSTATS_INK,
    fontFamily: FONT_REGULAR,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: TSTATS_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TSTATS_INK,
    borderRadius: 26,
    paddingVertical: 15,
  },
  ctaText: { color: TSTATS_YELLOW, fontFamily: FONT_BOLD, fontSize: 16 },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
  },
});
