import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { openApkDownload } from '@/constants/download';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDeviceLanguage, Language, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';
import { markEnteredWeb } from '@/utils/webGateway';

const LOGO = require('../assets/images/logo_app.png');

/** Funciones que se destacan en la web de recepción (emoji + claves i18n). */
const FEATURES: { emoji: string; titleKey: string; bodyKey: string }[] = [
  { emoji: '🗓️', titleKey: 'landing.featureEventsTitle', bodyKey: 'landing.featureEventsBody' },
  { emoji: '🔥', titleKey: 'landing.featureCounterTitle', bodyKey: 'landing.featureCounterBody' },
  { emoji: '🚗', titleKey: 'landing.featureCarsTitle', bodyKey: 'landing.featureCarsBody' },
  { emoji: '💬', titleKey: 'landing.featureSocialTitle', bodyKey: 'landing.featureSocialBody' },
];

/**
 * Web de recepción (solo se muestra en la WEB, a usuarios nuevos sin sesión).
 * Explica qué es NiniApp y ofrece un botón grande para acceder a la app. Tiene
 * su propio desplegable de idioma. Al acceder, se marca como cruzada y no
 * vuelve a aparecer. En nativo nunca se ve; no altera nada de la app.
 */
export default function GatewayScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();

  const [showIosHelp, setShowIosHelp] = useState(false);
  const [pickingLang, setPickingLang] = useState(false);

  // La recepción se muestra antes que la pantalla de idioma: si el usuario aún
  // no ha elegido, se fija un idioma por defecto (el del dispositivo o español)
  // para que los textos se rendericen; el desplegable permite cambiarlo.
  useEffect(() => {
    if (!language) setLanguage(getDeviceLanguage() ?? 'es');
  }, [language, setLanguage]);

  const enterApp = () => {
    if (!language) setLanguage(getDeviceLanguage() ?? 'es');
    markEnteredWeb();
    router.replace('/(auth)/login');
  };

  const currentLabel = language ? LANGUAGE_LABELS[language] : LANGUAGE_LABELS.es;

  return (
    <Screen scroll style={styles.container}>
      <View style={styles.inner}>
        {/* Barra superior: desplegable de idioma */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setPickingLang(true)}
            style={({ pressed }) => [
              styles.langButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText>🌐 {currentLabel}</ThemedText>
            <ThemedText variant="muted">▾</ThemedText>
          </Pressable>
        </View>

        {/* Héroe */}
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <ThemedText variant="title" style={styles.appName}>
            {t('common.appName')}
          </ThemedText>
          <ThemedText variant="subtitle" style={styles.tagline}>
            {t('landing.tagline')}
          </ThemedText>
          <ThemedText variant="muted" style={styles.intro}>
            {t('landing.intro')}
          </ThemedText>

          <View style={styles.ctaWrap}>
            <Button title={t('landing.enter')} onPress={enterApp} />
            <ThemedText variant="muted" style={styles.ctaNote}>
              {t('landing.enterNote')}
            </ThemedText>
          </View>
        </View>

        {/* Qué hace la app */}
        <ThemedText variant="label" style={styles.sectionLabel}>
          {t('landing.whatTitle')}
        </ThemedText>
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View
              key={f.titleKey}
              style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={styles.featureEmoji}>{f.emoji}</ThemedText>
              <ThemedText variant="subtitle">{t(f.titleKey)}</ThemedText>
              <ThemedText variant="muted" style={styles.featureBody}>
                {t(f.bodyKey)}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Instalación / descarga */}
        <ThemedText variant="label" style={styles.sectionLabel}>
          {t('landing.installTitle')}
        </ThemedText>
        <View style={[styles.installCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Button title={t('gateway.download')} variant="outline" onPress={openApkDownload} />
          <ThemedText variant="muted" style={styles.warning}>
            {t('gateway.androidWarning')}
          </ThemedText>
          <Button
            title={t('gateway.iosButton')}
            variant="ghost"
            onPress={() => setShowIosHelp((v) => !v)}
          />
          {showIosHelp && (
            <View style={styles.iosSteps}>
              <ThemedText variant="subtitle">{t('gateway.iosTitle')}</ThemedText>
              <ThemedText variant="muted" style={styles.iosStepsText}>
                {t('gateway.iosSteps')}
              </ThemedText>
            </View>
          )}
          <ThemedText variant="muted" style={styles.note}>
            {t('gateway.iosNote')}
          </ThemedText>
        </View>

        <View style={styles.footerCta}>
          <Button title={t('landing.enter')} onPress={enterApp} />
        </View>
      </View>

      {/* Desplegable de idioma */}
      <Modal
        visible={pickingLang}
        transparent
        animationType="fade"
        onRequestClose={() => setPickingLang(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickingLang(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}>
            <ThemedText variant="subtitle" style={styles.sheetTitle}>
              {t('language.title')}
            </ThemedText>
            {SUPPORTED_LANGUAGES.map((lang: Language) => {
              const selected = lang === language;
              return (
                <Pressable
                  key={lang}
                  onPress={() => {
                    setLanguage(lang);
                    setPickingLang(false);
                  }}
                  style={({ pressed }) => [
                    styles.langOption,
                    {
                      backgroundColor: selected ? theme.primary + '22' : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <ThemedText style={styles.flex}>{LANGUAGE_LABELS[lang]}</ThemedText>
                  {selected && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  // Centra y limita el ancho para que se lea bien en ordenador (responsive).
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  logo: { width: 96, height: 96, borderRadius: 22 },
  appName: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
  intro: { textAlign: 'center', lineHeight: 22, maxWidth: 560 },
  ctaWrap: { width: '100%', maxWidth: 360, gap: 6, marginTop: 8 },
  ctaNote: { textAlign: 'center', fontSize: 13 },
  sectionLabel: { marginTop: 8 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  featureEmoji: { fontSize: 28 },
  featureBody: { lineHeight: 20 },
  installCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  warning: { fontSize: 13, lineHeight: 19 },
  iosSteps: { gap: 8 },
  iosStepsText: { lineHeight: 21 },
  note: { fontSize: 13 },
  footerCta: { width: '100%', maxWidth: 360, alignSelf: 'center', marginTop: 4, marginBottom: 12 },
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  sheetTitle: { marginBottom: 4 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
});
