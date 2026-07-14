import { getFirebase } from '@/services/firebase';

/**
 * Fotos en Firebase Storage. Antes se guardaban como data-URI base64 dentro
 * del documento del grupo, lo que acababa reventando el límite de 1 MB por
 * documento de Firestore; ahora se sube el archivo y se guarda solo la URL.
 */

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
  const blob = await (await fetch(localUri)).blob();
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
