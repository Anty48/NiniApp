import { Platform } from 'react-native';

/**
 * URL de descarga del APK de Android de NiniApp.
 *
 * 👉 CAMBIA SOLO EL FILE_ID cuando subas una nueva versión del APK a Google
 * Drive (la parte entre /d/ y /view del enlace de compartir). Tanto la
 * pantalla de bienvenida web (`app/gateway.tsx`) como el botón del Perfil
 * (`app/(tabs)/profile.tsx`) usan esta misma constante.
 *
 * OJO: el formato clásico `drive.google.com/uc?export=download&id=...` NO
 * sirve para este APK: pesa más de 100 MB y Drive devuelve una página HTML
 * de aviso ("no se puede analizar en busca de virus") en lugar del archivo.
 * El formato `drive.usercontent.google.com/download` con `confirm=t` salta
 * ese aviso y descarga directamente (verificado: HTTP 200 + attachment).
 */
export const APK_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1IuXdbP0uMghcsyGO4-MZj85zop_ezWbv&export=download&confirm=t';

/**
 * Inicia la descarga del APK. Solo tiene efecto en la web; en nativo no hace
 * nada (los botones que la llaman solo se muestran en web).
 */
export function openApkDownload(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
}
