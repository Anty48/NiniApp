import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { Colors, Theme } from '@/constants/Colors';
import { getItem, setItem, StorageKeys } from '@/services/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Preferencia del usuario (puede ser "system"). */
  mode: ThemeMode;
  /** Esquema efectivo una vez resuelto "system". */
  scheme: 'light' | 'dark';
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getItem<ThemeMode>(StorageKeys.themeMode).then((saved) => {
      if (saved) setModeState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setItem(StorageKeys.themeMode, next);
  };

  const scheme = mode === 'system' ? (systemScheme ?? 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, scheme, theme: Colors[scheme], setMode }),
    [mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
