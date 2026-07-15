import { Platform } from 'react-native';

/**
 * URL de descarga del APK de Android de NiniApp.
 *
 * 👉 CAMBIA SOLO ESTA LÍNEA cuando subas una nueva versión del APK: pega aquí
 * el enlace de descarga directa de tu Google Drive / Dropbox / etc. Tanto la
 * pantalla de bienvenida web (`app/gateway.tsx`) como el botón del Perfil
 * (`app/(tabs)/profile.tsx`) usan esta misma constante.
 *
 * Consejo: usa un enlace de descarga DIRECTA (no la vista previa del archivo).
 * - Google Drive: https://drive.google.com/uc?export=download&id=FILE_ID
 * - Dropbox: cambia el `?dl=0` final del enlace por `?dl=1`.
 */
export const APK_DOWNLOAD_URL = 'https://TODO-pega-aqui-el-enlace-de-descarga-del-apk';

/**
 * Inicia la descarga del APK. Solo tiene efecto en la web; en nativo no hace
 * nada (los botones que la llaman solo se muestran en web).
 */
export function openApkDownload(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
}
