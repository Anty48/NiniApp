import { StyleSheet, Text, TextProps } from 'react-native';

import { FONT_BOLD, FONT_REGULAR } from '@/constants/typography';
import { useTheme } from '@/contexts/ThemeContext';

type Variant = 'title' | 'subtitle' | 'body' | 'muted' | 'label';

export function ThemedText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  const { theme } = useTheme();
  const color = variant === 'muted' ? theme.textMuted : theme.text;
  return <Text {...props} style={[styles.base, styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: FONT_REGULAR },
  // Los pesos vienen del archivo de fuente (Lora-Bold), no de fontWeight.
  title: { fontSize: 28, fontFamily: FONT_BOLD },
  subtitle: { fontSize: 18, fontFamily: FONT_BOLD },
  body: { fontSize: 16 },
  muted: { fontSize: 14 },
  label: { fontSize: 14, fontFamily: FONT_BOLD },
});
