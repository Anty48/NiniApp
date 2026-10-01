import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { TSTATS_INK, TSTATS_LOGO, TSTATS_URL, TSTATS_YELLOW } from '@/constants/developer';
import { FONT_BOLD, FONT_REGULAR } from '@/constants/typography';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Anuncio de T-Stats para el Perfil, con los colores de su marca (amarillo
 * transporte y tinta casi negra) para que destaque como contenido aparte.
 */
export function TStatsCard() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/tstats')}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.row}>
        <Image source={TSTATS_LOGO} style={styles.logo} />
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t('tstats.kicker')}</Text>
          <Text style={styles.title}>T-Stats</Text>
          <Text style={styles.tagline}>{t('tstats.tagline')}</Text>
        </View>
      </View>
      {!TSTATS_URL && (
        <View style={styles.status}>
          <Icon name="chef-hat" size={16} color={TSTATS_INK} />
          <Text style={styles.statusText}>{t('tstats.comingSoon')}</Text>
        </View>
      )}
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('tstats.discover')}</Text>
        <Icon name="arrow-right" size={18} color={TSTATS_YELLOW} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TSTATS_YELLOW,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: TSTATS_INK,
  },
  kicker: {
    color: TSTATS_INK,
    fontFamily: FONT_BOLD,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  title: { color: TSTATS_INK, fontFamily: FONT_BOLD, fontSize: 24 },
  tagline: { color: TSTATS_INK, fontFamily: FONT_REGULAR, fontSize: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { color: TSTATS_INK, fontFamily: FONT_REGULAR, fontSize: 13 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TSTATS_INK,
    borderRadius: 24,
    paddingVertical: 12,
  },
  ctaText: { color: TSTATS_YELLOW, fontFamily: FONT_BOLD, fontSize: 15 },
});
