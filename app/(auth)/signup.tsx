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

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { signUp, signInWithGoogle } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError(t('common.requiredFields'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(username.trim(), email.trim(), password);
    } catch (e) {
      console.warn('Signup', e);
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
      console.warn('Google signup', e);
      setError(authErrorMessage(e, t));
      setLoading(false);
    }
  };

  return (
    <Screen scroll style={styles.container}>
      <ThemedText variant="title">{t('auth.signupTitle')}</ThemedText>

      <TextField
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
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
        autoComplete="new-password"
      />

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title={t('auth.signup')} onPress={submit} loading={loading} />
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
        title={t('auth.hasAccount')}
        onPress={() => router.back()}
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
