import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

export default function NotFoundScreen() {
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen style={styles.container}>
        <ThemedText variant="title">404</ThemedText>
        <Link href="/" style={[styles.link, { color: theme.primary }]}>
          Volver al inicio
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '600', paddingVertical: 12 },
});
