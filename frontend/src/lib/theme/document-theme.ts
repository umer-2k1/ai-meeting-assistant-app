import { storageKeys } from '@/lib/constants/keys';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export function readStoredThemePreference(): ThemePreference {
  const stored = localStorage.getItem(storageKeys.theme) as ThemePreference | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = globalThis.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

export function syncDocumentThemeFromStorage() {
  const preference = readStoredThemePreference();
  applyResolvedTheme(resolveThemePreference(preference));
  return preference;
}
