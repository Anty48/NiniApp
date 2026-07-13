import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TranslateOptions } from 'i18n-js';

import { i18n, Language } from '@/i18n';
import { getItem, setItem, StorageKeys } from '@/services/storage';

interface LanguageContextValue {
  /** null = el usuario aún no ha elegido idioma (primer arranque). */
  language: Language | null;
  /** true cuando ya se ha leído la preferencia guardada. */
  isReady: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: TranslateOptions) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getItem<Language>(StorageKeys.language).then((saved) => {
      if (saved) {
        i18n.locale = saved;
        setLanguageState(saved);
      }
      setIsReady(true);
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    i18n.locale = lang;
    setLanguageState(lang);
    setItem(StorageKeys.language, lang);
  }, []);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => i18n.t(key, options),
    // language fuerza el re-render de los consumidores al cambiar de idioma
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  const value = useMemo(
    () => ({ language, isReady, setLanguage, t }),
    [language, isReady, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
  return ctx;
}
