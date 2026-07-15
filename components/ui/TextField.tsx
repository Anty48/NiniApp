import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { FONT_FAMILY } from '@/constants/typography';
import { useTheme } from '@/contexts/ThemeContext';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, ...inputProps }: TextFieldProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
        {...inputProps}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          },
          inputProps.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', fontFamily: FONT_FAMILY },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: FONT_FAMILY,
  },
});
