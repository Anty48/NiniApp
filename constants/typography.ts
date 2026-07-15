import { Platform } from 'react-native';

/**
 * Fuente de toda la app: Times New Roman. Android no la trae de fábrica, así
 * que ahí se usa la serif del sistema (Noto Serif, visualmente equivalente);
 * en web e iOS es Times New Roman de verdad.
 */
export const FONT_FAMILY = Platform.select({
  android: 'serif',
  ios: 'Times New Roman',
  default: "'Times New Roman', Times, serif",
});
