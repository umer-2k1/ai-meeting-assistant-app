/**
 * Google sign-in entry point.
 * Desktop/Electron must always use the system browser — never navigate the app window to OAuth URLs.
 */

const BACKEND_URL = import.meta.env['VITE_BACKEND_URL'] || 'http://localhost:3001';

export function isDesktopApp(): boolean {
  return (
    Boolean(globalThis.window.desktop?.auth?.openExternal) ||
    /Electron/i.test(globalThis.navigator.userAgent)
  );
}

/**
 * Start Google OAuth. On desktop opens the system browser; on web uses same-tab navigation.
 */
export function startGoogleSignIn(): void {
  const authUrl = isDesktopApp()
    ? `${BACKEND_URL}/auth/google?source=desktop`
    : `${BACKEND_URL}/auth/google`;

  const desktop = globalThis.window.desktop;
  if (isDesktopApp() && desktop?.auth?.openExternal) {
    void desktop.auth.openExternal(authUrl);
    return;
  }

  if (isDesktopApp()) {
    console.error(
      '[auth] Desktop app detected but external browser bridge is missing. OAuth cannot run inside the app window.'
    );
    return;
  }

  window.location.assign(authUrl);
}
