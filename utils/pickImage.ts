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
