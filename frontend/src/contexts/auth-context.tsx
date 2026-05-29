import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { startGoogleSignIn } from '@/lib/google-auth';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  setAuth: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'ai_meeting_token';
const USER_KEY = 'ai_meeting_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const setAuth = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  // Desktop deep-link OAuth callback handler (external browser -> app)
  useEffect(() => {
    const desktop = globalThis.window.desktop;
    if (!desktop?.auth?.onCallback) return;

    return desktop.auth.onCallback((payload: { url?: string }) => {
      try {
        const url = payload?.url;
        if (!url || !url.includes('auth/callback')) return;

        const parsed = new URL(url);
        const tokenParam = parsed.searchParams.get('token');
        const userParam = parsed.searchParams.get('user');

        if (!tokenParam || !userParam) return;

        const nextUser = JSON.parse(decodeURIComponent(userParam)) as User;
        setAuth(tokenParam, nextUser);

        // Return to app UI after system-browser sign-in (deep link does not change route)
        if (globalThis.window.location.pathname === '/login') {
          globalThis.window.location.replace('/dashboard');
        }
      } catch (error) {
        console.error('Failed to handle desktop auth callback:', error);
      }
    });
  }, [setAuth]);

  const login = useCallback(() => {
    startGoogleSignIn();
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      setAuth,
    }),
    [user, token, isLoading, login, logout, setAuth]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
