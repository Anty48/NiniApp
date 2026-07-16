import { Image } from 'react-native';

/** Proporción real del gif (740x600): se conserva al escalarlo. */
const RATIO = 600 / 740;

/**
 * Indicador de carga de la app: gif animado con fondo transparente en lugar
 * del ActivityIndicator del sistema. Anima en web (img nativo) y en el APK
 * (fresco animated-gif, que el template de Expo activa por defecto:
 * expo.gif.enabled=true). El ActivityIndicator pequeño de los botones
 * (components/ui/Button.tsx) se queda como está.
 */
export function Loading({ width = 130 }: { width?: number }) {
  return (
    <Image
      source={require('../../assets/images/loading.gif')}
      style={{ width, height: Math.round(width * RATIO) }}
      resizeMode="contain"
    />
  );
}
