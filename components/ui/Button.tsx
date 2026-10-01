import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Icon, IconName } from '@/components/ui/Icon';
import { FONT_BOLD } from '@/constants/typography';
import { useTheme } from '@/contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Icono a la izquierda del texto. */
  icon?: IconName;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  icon,
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
      ) : icon ? (
        <View style={styles.content}>
          <Icon name={icon} size={20} color={textColor} />
          <Text style={[styles.text, styles.shrink, { color: textColor }]}>{title}</Text>
        </View>
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
  text: { fontSize: 16, fontFamily: FONT_BOLD },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1, textAlign: 'center' },
});
