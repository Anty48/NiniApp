import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import ca from './locales/ca.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['ca', 'es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Nombre nativo de cada idioma para el selector (no se traduce).
export const LANGUAGE_LABELS: Record<Language, string> = {
  ca: 'Català',
  es: 'Español',
  en: 'English',
};

export const i18n = new I18n({ ca, es, en });
i18n.enableFallback = true;
i18n.defaultLocale = 'es';

/** Idioma del dispositivo si está soportado; se usa solo como sugerencia. */
export function getDeviceLanguage(): Language | null {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED_LANGUAGES.includes(code as Language) ? (code as Language) : null;
}
