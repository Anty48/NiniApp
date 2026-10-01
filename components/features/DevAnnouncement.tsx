import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconText } from '@/components/ui/IconText';
import { ThemedText } from '@/components/ui/ThemedText';
import { DEV_ANNOUNCEMENT_ID, TSTATS_INK, TSTATS_LOGO, TSTATS_URL, TSTATS_YELLOW } from '@/constants/developer';
import { FONT_BOLD } from '@/constants/typography';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getItem, setItem, StorageKeys } from '@/services/storage';

/**
 * Popup de "nuevo contenido del desarrollador" (ahora: T-Stats). Sale una sola
 * vez por dispositivo y anuncio: al cerrarlo o al pulsar el botón se guarda
 * `DEV_ANNOUNCEMENT_ID` como visto y no vuelve a aparecer.
 */
export function DevAnnouncement() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    getItem<string>(StorageKeys.devAnnouncementSeen).then((seen) => {
      // Un pequeño margen para no tapar la app justo al abrirla.
      if (seen !== DEV_ANNOUNCEMENT_ID) timer = setTimeout(() => setVisible(true), 1200);
    });
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setItem(StorageKeys.devAnnouncementSeen, DEV_ANNOUNCEMENT_ID);
  };

  // Con la web publicada, el botón lleva directo a ella; si no, a /tstats.
  const discover = () => {
    dismiss();
    if (TSTATS_URL) WebBrowser.openBrowserAsync(TSTATS_URL);
    else router.push('/tstats');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.modal, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.banner}>
            <Image source={TSTATS_LOGO} style={styles.logo} />
          </View>
          <View style={styles.body}>
            <IconText
              icon="new-box"
              iconSize={18}
              color={theme.primary}
              textStyle={styles.kicker}>
              {t('tstats.popupKicker')}
            </IconText>
            <ThemedText variant="title">{t('tstats.popupTitle')}</ThemedText>
            <ThemedText variant="muted" style={styles.text}>
              {t('tstats.popupBody')}
            </ThemedText>
            <Button
              title={TSTATS_URL ? t('tstats.open') : t('tstats.discover')}
              icon={TSTATS_URL ? 'open-in-new' : 'compass-outline'}
              onPress={discover}
            />
            <Button title={t('tstats.popupLater')} variant="ghost" onPress={dismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  banner: {
    backgroundColor: TSTATS_YELLOW,
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: TSTATS_INK,
  },
  body: { padding: 20, gap: 10 },
  kicker: { fontFamily: FONT_BOLD, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  text: { lineHeight: 21, marginBottom: 6 },
});
