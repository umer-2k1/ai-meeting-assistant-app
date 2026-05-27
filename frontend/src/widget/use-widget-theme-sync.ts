import { useEffect } from 'react';

import { storageKeys } from '@/lib/constants/keys';
import {
  applyResolvedTheme,
  readStoredThemePreference,
  resolveThemePreference,
  syncDocumentThemeFromStorage,
  type ThemePreference
} from '@/lib/theme/document-theme';

function applyPreference(preference: ThemePreference) {
  applyResolvedTheme(resolveThemePreference(preference));
}

export function useWidgetThemeSync() {
  useEffect(() => {
    syncDocumentThemeFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKeys.theme) return;
      const preference = readStoredThemePreference();
      applyPreference(preference);
    };

    const desktopApi = globalThis.window.desktop;
    const unsubscribeTheme = desktopApi?.theme?.onChange?.((preference) => {
      applyPreference(preference);
    });

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      if (readStoredThemePreference() === 'system') {
        applyPreference('system');
      }
    };

    globalThis.addEventListener('storage', onStorage);
    media.addEventListener('change', onSystemThemeChange);

    return () => {
      globalThis.removeEventListener('storage', onStorage);
      media.removeEventListener('change', onSystemThemeChange);
      unsubscribeTheme?.();
    };
  }, []);
}
