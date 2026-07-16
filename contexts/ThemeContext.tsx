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
import { getItem, removeItem, setItem, StorageKeys } from '@/services/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Normaliza un color hexadecimal escrito por el usuario a formato #RRGGBB.
 * Acepta con o sin '#' y la forma corta de 3 dígitos. Devuelve null si no
 * es un color válido.
 */
export function normalizeHexColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  const hex6 = /^[0-9a-fA-F]{6}$/.test(raw)
    ? raw
    : /^[0-9a-fA-F]{3}$/.test(raw)
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : null;
  return hex6 ? `#${hex6.toUpperCase()}` : null;
}

/** Texto negro o blanco según la luminosidad del color de fondo. */
function onColorFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 160 ? '#16161A' : '#FFFFFF';
}

interface ThemeContextValue {
  /** Preferencia del usuario (puede ser "system"). */
  mode: ThemeMode;
  /** Esquema efectivo una vez resuelto "system". */
  scheme: 'light' | 'dark';
  theme: Theme;
  /** Color de acento elegido por el usuario (#RRGGBB), o null = el de serie. */
  accent: string | null;
  /** true cuando ya se ha leído la preferencia guardada (evita pintar con
   * el tema equivocado y que "cambie" al refrescar en web). */
  isReady: boolean;
  setMode: (mode: ThemeMode) => void;
  /** Cambia el color de acento; null restablece el lila de serie. */
  setAccent: (hex: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getItem<ThemeMode>(StorageKeys.themeMode),
      getItem<string>(StorageKeys.accentColor),
    ]).then(([savedMode, savedAccent]) => {
      if (savedMode) setModeState(savedMode);
      if (savedAccent) setAccentState(normalizeHexColor(savedAccent));
      setIsReady(true);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setItem(StorageKeys.themeMode, next);
  };

  const setAccent = (hex: string | null) => {
    const normalized = hex ? normalizeHexColor(hex) : null;
    setAccentState(normalized);
    if (normalized) setItem(StorageKeys.accentColor, normalized);
    else removeItem(StorageKeys.accentColor);
  };

  const scheme = mode === 'system' ? (systemScheme ?? 'light') : mode;

  // Con acento personalizado se sustituye el primary de ambos esquemas y se
  // recalcula el color del texto que va encima (negro sobre colores claros).
  const theme = useMemo<Theme>(() => {
    const base = Colors[scheme];
    if (!accent) return base;
    return { ...base, primary: accent, onPrimary: onColorFor(accent) };
  }, [scheme, accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, scheme, theme, accent, isReady, setMode, setAccent }),
    [mode, scheme, theme, accent, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
