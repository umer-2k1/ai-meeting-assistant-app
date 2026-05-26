import { createContext, use, useEffect, useState } from 'react';

import type { ReactNode } from 'react';

import { storageKeys } from '@/lib/constants/keys';

type Theme = 'dark' | 'light' | 'system';

type ThemeProvider = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
};

const ThemeProviderContext = createContext(initialState);

export default function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = storageKeys.theme,
  ...properties
}: Readonly<ThemeProvider>) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme | null;
    return storedTheme ?? defaultTheme;
  });

  useEffect(() => {
    const root = globalThis.document.documentElement;

    const applyTheme = (resolved: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };

    if (theme === 'system') {
      const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
      const syncSystemTheme = () => {
        applyTheme(media.matches ? 'dark' : 'light');
      };

      syncSystemTheme();
      media.addEventListener('change', syncSystemTheme);
      return () => {
        media.removeEventListener('change', syncSystemTheme);
      };
    }

    applyTheme(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    }
  };

  return (
    <ThemeProviderContext {...properties} value={value}>
      {children}
    </ThemeProviderContext>
  );
}

export const useTheme = () => {
  const context = use(ThemeProviderContext);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (context == undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
