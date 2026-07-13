import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

/**
 * Pantalla de arranque neutra. El guard de app/_layout.tsx redirige desde aquí
 * a /language, /(auth)/login, /(onboarding) o /(tabs) según el estado.
 */
export default function Index() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
