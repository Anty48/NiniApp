import { StyleSheet, View } from 'react-native';

import { Loading } from '@/components/ui/Loading';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Pantalla de arranque neutra. El guard de app/_layout.tsx redirige desde aquí
 * a /language, /(auth)/login, /(onboarding) o /(tabs) según el estado.
 */
export default function Index() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Loading />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
