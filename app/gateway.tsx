import { useRouter } from 'expo-router';
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

  const enterWeb = () => {
    markEnteredWeb();
    router.replace('/(auth)/login');
  };

  return (
    <Screen style={styles.container}>
      <ThemedText variant="title" style={styles.centered}>
        {t('gateway.title')}
      </ThemedText>
      <ThemedText variant="muted" style={styles.centered}>
        {t('gateway.subtitle')}
      </ThemedText>

      <View style={styles.actions}>
        <Button title={t('gateway.enterWeb')} onPress={enterWeb} />
        <Button title={t('gateway.download')} variant="outline" onPress={openApkDownload} />
      </View>

      <ThemedText variant="muted" style={[styles.note, { color: theme.textMuted }]}>
        {t('gateway.iosNote')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 16 },
  centered: { textAlign: 'center' },
  actions: { gap: 12, marginTop: 8 },
  note: { textAlign: 'center', fontSize: 13, marginTop: 4 },
});
