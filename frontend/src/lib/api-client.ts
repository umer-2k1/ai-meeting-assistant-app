/**
 * API client with authentication support
 */

import { BACKEND_URL, TOKEN_KEY } from './config';

/**
 * Thrown when the backend rejects our credentials. Callers decide what to do —
 * this module must never navigate. It runs in both the main app and the
 * floating widget window, and a redirect there would drag the widget off
 * widget.html and replace the transparent overlay with an opaque app page.
 */
export class AuthError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/** Fired on 401 so the main app can route to login. The widget ignores it. */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid. Drop the dead credentials and announce it —
      // whoever owns routing decides where to go. See AuthError above.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('ai_meeting_user');
      globalThis.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      throw new AuthError();
    }

    const errorBody: unknown = await response.json().catch(() => ({ error: 'Request failed' }));
    const message =
      typeof errorBody === 'object' &&
      errorBody !== null &&
      'error' in errorBody &&
      typeof (errorBody as { error: unknown }).error === 'string'
        ? (errorBody as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
