import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { apiRequest } from '@/lib/api-client';
import { setTimeFormatPreference } from '@/lib/time-format';
import { useAuth } from './auth-context';

export interface UserPreferences {
  timeFormat: '12h' | '24h';
  language: string;
  summaryLength: 'brief' | 'balanced' | 'detailed';
  actionSensitivity: 'conservative' | 'balanced' | 'aggressive';
  responseStyle: 'concise' | 'explanatory' | 'structured';
  includeTimestamps: boolean;
  highlightDecisions: boolean;
  suggestFollowups: boolean;
}

const DEFAULTS: UserPreferences = {
  timeFormat: '12h',
  language: 'en',
  summaryLength: 'balanced',
  actionSensitivity: 'balanced',
  responseStyle: 'concise',
  includeTimestamps: true,
  highlightDecisions: true,
  suggestFollowups: true,
};

const CACHE_KEY = 'ai_meeting_prefs';

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  isLoaded: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function readCache(): UserPreferences {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(readCache);
  const [isLoaded, setIsLoaded] = useState(false);

  // Keep the module-level time format in sync so date formatters honor it.
  useEffect(() => {
    setTimeFormatPreference(preferences.timeFormat);
  }, [preferences.timeFormat]);

  // Load canonical preferences from the backend once authenticated.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoaded(true);
      return;
    }
    let cancelled = false;
    void apiRequest<{ preferences: UserPreferences }>('/api/user/preferences')
      .then((res) => {
        if (cancelled) return;
        const merged = { ...DEFAULTS, ...res.preferences };
        setPreferences(merged);
        localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      })
      .catch(() => {
        /* keep cache/defaults */
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      // Persist to backend (best-effort — the change stays local if offline).
      void apiRequest('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: partial }),
      }).catch(() => {
        /* stays local */
      });
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, isLoaded }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
