import { createContext, use, useEffect, useState } from 'react';

import type { ReactNode } from 'react';

import { storageKeys } from '@/lib/constants/keys';
import {
  applyResolvedTheme,
  resolveThemePreference,
  type ThemePreference
} from '@/lib/theme/document-theme';

type Theme = ThemePreference;

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
    const applyTheme = () => {
      applyResolvedTheme(resolveThemePreference(theme));
    };

    if (theme === 'system') {
      const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
      applyTheme();
      media.addEventListener('change', applyTheme);
      return () => {
        media.removeEventListener('change', applyTheme);
      };
    }

    applyTheme();
  }, [theme]);

  const value = {
    theme,
    setTheme: (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme);
      setTheme(nextTheme);
      void globalThis.window.desktop?.theme?.broadcast(nextTheme);
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
