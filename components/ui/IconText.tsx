import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { Icon, IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/ui/ThemedText';

interface IconTextProps {
  icon: IconName;
  children: React.ReactNode;
  /** Color del icono y del texto (por defecto, los del tema). */
  color?: string;
  variant?: React.ComponentProps<typeof ThemedText>['variant'];
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Texto precedido de un icono, en línea (etiquetas, insignias, cabeceras). */
export function IconText({
  icon,
  children,
  color,
  variant,
  iconSize = 16,
  style,
  textStyle,
  numberOfLines,
}: IconTextProps) {
  return (
    <View style={[styles.row, style]}>
      <Icon name={icon} size={iconSize} color={color} />
      <ThemedText
        variant={variant}
        numberOfLines={numberOfLines}
        style={[styles.shrink, color ? { color } : null, textStyle]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
