import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { FONT_FAMILY } from '@/constants/typography';
import { useTheme } from '@/contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.primary }
      : variant === 'outline'
        ? { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }
        : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'primary' ? theme.onPrimary : variant === 'outline' ? theme.text : theme.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        containerStyle,
        (pressed || isDisabled) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dimmed: { opacity: 0.6 },
  text: { fontSize: 16, fontWeight: '600', fontFamily: FONT_FAMILY },
});
