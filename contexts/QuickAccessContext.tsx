import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { getItem, setItem, StorageKeys } from '@/services/storage';

/**
 * Qué muestra el "acceso rápido" (pestaña central personalizable). Es una
 * preferencia local del dispositivo, común a todos tus grupos: cada quien pone
 * lo que más usa (el frasario, las canciones, las encuestas o el ranking).
 */
export type QuickAccessTarget = 'ranking' | 'phrasebook' | 'songs' | 'polls';

/** Todas las opciones elegibles, en el orden en que se ofrecen. */
export const QUICK_ACCESS_OPTIONS: QuickAccessTarget[] = [
  'ranking',
  'phrasebook',
  'songs',
  'polls',
];

/** Icono de FontAwesome de cada opción (y del estado vacío). */
export const QUICK_ACCESS_ICONS: Record<QuickAccessTarget | 'empty', string> = {
  empty: 'plus-square-o',
  ranking: 'trophy',
  phrasebook: 'book',
  songs: 'music',
  polls: 'bar-chart',
};

/** Clave i18n de la etiqueta de cada opción (reutiliza nombres ya traducidos). */
export const QUICK_ACCESS_LABEL_KEYS: Record<QuickAccessTarget, string> = {
  ranking: 'tabs.leaderboard',
  phrasebook: 'groupTab.phrasebook',
  songs: 'groupTab.songs',
  polls: 'groupTab.polls',
};

interface QuickAccessContextValue {
  /** null = todavía sin acceso rápido elegido (se muestra el "+"). */
  target: QuickAccessTarget | null;
  isReady: boolean;
  setTarget: (target: QuickAccessTarget | null) => void;
}

const QuickAccessContext = createContext<QuickAccessContextValue | null>(null);

export function QuickAccessProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<QuickAccessTarget | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getItem<QuickAccessTarget | null>(StorageKeys.quickAccess).then((saved) => {
      if (saved) setTargetState(saved);
      setIsReady(true);
    });
  }, []);

  const setTarget = (next: QuickAccessTarget | null) => {
    setTargetState(next);
    setItem(StorageKeys.quickAccess, next);
  };

  const value = useMemo(() => ({ target, isReady, setTarget }), [target, isReady]);

  return <QuickAccessContext.Provider value={value}>{children}</QuickAccessContext.Provider>;
}

export function useQuickAccess(): QuickAccessContextValue {
  const ctx = useContext(QuickAccessContext);
  if (!ctx) throw new Error('useQuickAccess debe usarse dentro de <QuickAccessProvider>');
  return ctx;
}
