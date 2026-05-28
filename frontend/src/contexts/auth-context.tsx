import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

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

  // Desktop deep-link OAuth callback handler (external browser -> app)
  useEffect(() => {
    const desktop = globalThis.window.desktop;
    if (!desktop?.auth?.onCallback) return;

    return desktop.auth.onCallback((payload: { url?: string }) => {
      try {
        const url = payload?.url;
        if (!url) return;

        const parsed = new URL(url);
        const tokenParam = parsed.searchParams.get('token');
        const userParam = parsed.searchParams.get('user');

        if (!tokenParam || !userParam) return;

        const nextUser = JSON.parse(decodeURIComponent(userParam)) as User;
        setAuth(tokenParam, nextUser);
      } catch (error) {
        console.error('Failed to handle desktop auth callback:', error);
      }
    });
  }, []);

  const login = () => {
    const backendUrl = import.meta.env['VITE_BACKEND_URL'] || 'http://localhost:3001';
    const desktop = globalThis.window.desktop;
    // Desktop: open in system browser (uses existing Google session), then return via deep link
    if (desktop?.auth?.openExternal) {
      void desktop.auth.openExternal(`${backendUrl}/auth/google?source=desktop`);
      return;
    }

    // Web: navigate current tab
    window.location.href = `${backendUrl}/auth/google`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const setAuth = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        setAuth,
      }}
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
