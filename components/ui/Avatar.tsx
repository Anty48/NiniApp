import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
}

/** Foto de perfil, o círculo con la inicial si no hay foto. */
export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const { theme } = useTheme();
  const radius = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={radius} />;
  }
  return (
    <View style={[styles.fallback, radius, { backgroundColor: theme.primary }]}>
      <Text style={[styles.initial, { color: theme.onPrimary, fontSize: size * 0.42 }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700' },
});
