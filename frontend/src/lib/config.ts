/**
 * Centralized runtime config.
 *
 * Single source of truth for the backend URL so every client agrees (previously
 * `meeting-copilot/api.ts` defaulted to :4000 while everything else used :3001).
 */

/** HTTP(S) base URL for the backend API. No trailing slash. */
export const BACKEND_URL = (
  (import.meta.env['VITE_BACKEND_URL'] as string | undefined) || 'http://localhost:3001'
).replace(/\/$/, '');

/** WebSocket base URL derived from BACKEND_URL (http->ws, https->wss). */
export const WS_BASE_URL = BACKEND_URL.replace(/^http(s?):\/\//, (_m, s) => `ws${s}://`);

/** localStorage key holding the auth JWT. */
export const TOKEN_KEY = 'ai_meeting_token';
