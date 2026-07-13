import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { authErrorMessage } from '@/services/auth';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { signIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // El guard del layout raíz redirige a onboarding o tabs.
    } catch (e) {
      console.warn('Login', e);
      setError(authErrorMessage(e, t));
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.warn('Google login', e);
      setError(authErrorMessage(e, t));
      setLoading(false);
    }
  };

  return (
    <Screen scroll style={styles.container}>
      <ThemedText variant="title">{t('auth.loginTitle')}</ThemedText>

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title={t('auth.login')} onPress={submit} loading={loading} />
      <ThemedText variant="muted" style={styles.center}>
        {t('auth.or')}
      </ThemedText>
      <Button
        title={t('auth.google')}
        onPress={submitGoogle}
        variant="outline"
        disabled={loading}
      />
      <Button
        title={t('auth.noAccount')}
        onPress={() => router.push('/(auth)/signup')}
        variant="ghost"
        disabled={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
});
