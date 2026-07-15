import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { openApkDownload } from '@/constants/download';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { markEnteredWeb } from '@/utils/webGateway';

/**
 * Puerta de entrada exclusiva de la WEB. El guard de `app/_layout.tsx` solo
 * envía aquí a los usuarios web sin sesión (en nativo nunca aparece). Ofrece
 * dos caminos: usar la app en el navegador o descargar el APK de Android.
 */
export default function GatewayScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [showIosHelp, setShowIosHelp] = useState(false);

  const enterWeb = () => {
    markEnteredWeb();
    router.replace('/(auth)/login');
  };

  return (
    <Screen scroll style={styles.container}>
      <ThemedText variant="title" style={styles.centered}>
        {t('gateway.title')}
      </ThemedText>
      <ThemedText variant="muted" style={styles.centered}>
        {t('gateway.subtitle')}
      </ThemedText>

      <View style={styles.actions}>
        <Button title={t('gateway.enterWeb')} onPress={enterWeb} />
        <Button title={t('gateway.download')} variant="outline" onPress={openApkDownload} />
        <Button
          title={t('gateway.iosButton')}
          variant="ghost"
          onPress={() => setShowIosHelp((v) => !v)}
        />
      </View>

      {showIosHelp && (
        <View style={[styles.iosCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText variant="subtitle">{t('gateway.iosTitle')}</ThemedText>
          <ThemedText variant="muted" style={styles.iosSteps}>
            {t('gateway.iosSteps')}
          </ThemedText>
        </View>
      )}

      <ThemedText variant="muted" style={[styles.note, { color: theme.textMuted }]}>
        {t('gateway.iosNote')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', flexGrow: 1, gap: 16 },
  centered: { textAlign: 'center' },
  actions: { gap: 12, marginTop: 8 },
  iosCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  iosSteps: { lineHeight: 21 },
  note: { textAlign: 'center', fontSize: 13, marginTop: 4 },
});
