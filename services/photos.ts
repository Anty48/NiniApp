import { Platform } from 'react-native';

import { getFirebase } from '@/services/firebase';

/**
 * Fotos en Firebase Storage. Antes se guardaban como data-URI base64 dentro
 * del documento del grupo, lo que acababa reventando el límite de 1 MB por
 * documento de Firestore; ahora se sube el archivo y se guarda solo la URL.
 */

/** Lado máximo (px) y calidad JPEG con que se recomprime en web. */
const WEB_MAX_DIMENSION = 1280;
const WEB_JPEG_QUALITY = 0.7;

/**
 * En web el picker no comprime (en nativo ya se pide con quality 0.3), así
 * que una foto de cámara puede pesar varios MB: se reescala y recomprime con
 * canvas antes de subirla. Si algo falla, se sube el blob original tal cual.
 */
async function compressForWeb(blob: Blob): Promise<Blob> {
  if (Platform.OS !== 'web' || !blob.type.startsWith('image/')) return blob;
  try {
    // 'from-image' respeta la orientación EXIF de las fotos de móvil.
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, WEB_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', WEB_JPEG_QUALITY),
    );
    // Solo se usa si de verdad ahorra espacio (una imagen ya pequeña puede crecer).
    return compressed && compressed.size < blob.size ? compressed : blob;
  } catch {
    return blob;
  }
}

/**
 * Sube una foto a Storage y devuelve su URL pública de descarga.
 * `localUri` es lo que devuelve expo-image-picker: `file://` en nativo,
 * `data:`/`blob:` en web — `fetch` sabe leer las tres.
 */
export async function uploadPhoto(localUri: string, path: string): Promise<string> {
  const { app } = getFirebase();
  // Mismo criterio que en services/firebase.ts: siempre paquetes '@firebase/*'
  // scoped, nunca los wrappers 'firebase/*' (mezclarlos duplica @firebase/app).
  const { getStorage, ref, uploadBytes, getDownloadURL } = require('@firebase/storage');
  const storage = getStorage(app);
  const blob = await compressForWeb(await (await fetch(localUri)).blob());
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/**
 * Sube la foto solo si aún es local; si ya es una URL remota (o no hay foto)
 * la devuelve tal cual. Útil al guardar formularios con foto opcional.
 */
export async function ensurePhotoUploaded(
  uri: string | undefined,
  path: string,
): Promise<string | undefined> {
  if (!uri || uri.startsWith('http')) return uri;
  return uploadPhoto(uri, path);
}
