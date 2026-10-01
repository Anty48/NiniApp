import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

/** Nombre de cualquier icono de Material Community Icons. */
export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  /** Por defecto, el color de texto del tema. */
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Icono vectorial de la app (sustituye a los emojis). La fuente de iconos va
 * en el bundle de JS y se precarga en `app/_layout.tsx`, así que llega también
 * por actualización OTA sin recompilar el APK.
 */
export function Icon({ name, size = 20, color, style }: IconProps) {
  const { theme } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? theme.text} style={style} />;
}
