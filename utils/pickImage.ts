import * as ImagePicker from 'expo-image-picker';

/**
 * Abre la galería y devuelve la URI local de la imagen elegida (`file://` en
 * nativo, `data:`/`blob:` en web). Para persistirla hay que subirla a Firebase
 * Storage con `services/photos.ts` y guardar la URL remota.
 */
export async function pickImage(square = false): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.3,
    allowsEditing: square,
    ...(square ? { aspect: [1, 1] as [number, number] } : {}),
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Abre la cámara y devuelve la URI local de la foto tomada, o null si el
 * usuario cancela. `denied: true` si no concedió el permiso de cámara (el
 * llamador decide qué avisar). Solo tiene sentido en nativo; en web se usa
 * la galería (el file input del navegador ya ofrece la cámara en móvil).
 */
export async function takePhoto(): Promise<{ uri: string | null; denied: boolean }> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { uri: null, denied: true };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.3,
  });
  if (result.canceled || !result.assets[0]) return { uri: null, denied: false };
  return { uri: result.assets[0].uri, denied: false };
}
