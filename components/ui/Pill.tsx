import { Pressable, StyleSheet, Text } from 'react-native';

import { FONT_FAMILY } from '@/constants/typography';
import { useTheme } from '@/contexts/ThemeContext';

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Color de fondo cuando está seleccionada (por defecto, primario). */
  selectedColor?: string;
}

/** Botón tipo "chip" seleccionable (selector de tema, idioma, votos...). */
export function Pill({ label, selected, onPress, disabled = false, selectedColor }: PillProps) {
  const { theme } = useTheme();
  const bg = selected ? (selectedColor ?? theme.primary) : theme.surface;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: bg, borderColor: selected ? bg : theme.border },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      <Text style={[styles.text, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 14, fontWeight: '600', fontFamily: FONT_FAMILY },
});
