import { StyleSheet, Text, TextProps } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

type Variant = 'title' | 'subtitle' | 'body' | 'muted' | 'label';

export function ThemedText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  const { theme } = useTheme();
  const color = variant === 'muted' ? theme.textMuted : theme.text;
  return <Text {...props} style={[styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16 },
  muted: { fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600' },
});
