import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { sendSuggestion } from '@/services/suggestions';

/**
 * Buzón de sugerencias para el desarrollador. Cualquier usuario escribe una
 * sugerencia sobre la app; se guarda en Firestore (colección `suggestions`) y
 * solo el desarrollador la lee desde la consola de Firebase. Cada sugerencia
 * se autodestruye a los 5 días vía la política TTL de Firestore.
 */
export default function SuggestionsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendSuggestion(user, text);
      setSent(true);
      setText('');
      // Breve confirmación visible antes de volver atrás.
      setTimeout(() => {
        setSent(false);
        router.back();
      }, 1200);
    } catch (e) {
      console.warn('No se pudo enviar la sugerencia', e);
      setError(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('suggestions.title') }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('suggestions.subtitle')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextField
            label={t('suggestions.label')}
            value={text}
            onChangeText={setText}
            placeholder={t('suggestions.placeholder')}
            multiline
            style={styles.textArea}
          />
          <ThemedText variant="muted" style={styles.small}>
            🕔 {t('suggestions.ttlHint')}
          </ThemedText>
          {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
          <Button
            title={sent ? t('suggestions.sent') : t('suggestions.send')}
            onPress={send}
            loading={sending}
            disabled={!text.trim()}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  textArea: { height: 140, paddingTop: 12, textAlignVertical: 'top' },
  small: { fontSize: 12 },
});
