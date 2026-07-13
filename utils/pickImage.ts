import * as ImagePicker from 'expo-image-picker';

/**
 * Abre la galería y devuelve la imagen como data URI (base64) para poder
 * persistirla en AsyncStorage en local.
 * TODO(backend): subir a Firebase Storage y devolver la URL remota.
 */
export async function pickImage(square = false): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.3,
    base64: true,
    allowsEditing: square,
    ...(square ? { aspect: [1, 1] as [number, number] } : {}),
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
}
