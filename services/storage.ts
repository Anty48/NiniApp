import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistencia local clave-valor (nativo y web).
 * Aquí viven las preferencias del dispositivo: idioma, tema y sesión.
 */
export const StorageKeys = {
  language: 'niniapp.language',
  themeMode: 'niniapp.themeMode',
  accentColor: 'niniapp.accentColor',
  session: 'niniapp.session',
  /** Estados de miembros ya vistos: mapa "groupId:userId" -> timestamp del estado. */
  seenStatuses: 'niniapp.seenStatuses',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export async function getItem<T>(key: StorageKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setItem(key: StorageKey, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: StorageKey): Promise<void> {
  await AsyncStorage.removeItem(key);
}
