/**
 * Google auth error helpers.
 *
 * Two jobs, both learned the hard way:
 *
 * 1. Tell "the grant is dead" apart from "something went wrong". Google answers
 *    `invalid_grant` when a refresh token has been revoked or has expired. No
 *    amount of retrying fixes that — the user must re-consent. Treating it like
 *    any other error is why an integration could rot silently, showing a flat
 *    "Not connected" while never asking anyone to reconnect.
 *
 * 2. Summarise errors without leaking secrets. A raw GaxiosError stringifies its
 *    request body, and for a token refresh that body contains the *refresh
 *    token in plaintext*. `console.error(error)` on that path writes live
 *    credentials to the logs. Always log describeGoogleError(error) instead.
 */

interface GoogleErrorish {
  response?: { data?: { error?: string; error_description?: string } };
  status?: number;
  code?: number | string;
  message?: string;
}

/** True when Google says the refresh token is expired or revoked. */
export function isInvalidGrant(error: unknown): boolean {
  const err = error as GoogleErrorish | undefined;
  if (err?.response?.data?.error === 'invalid_grant') return true;
  return typeof err?.message === 'string' && err.message.includes('invalid_grant');
}

/**
 * A short, safe, one-line description of a Google API failure.
 * Never returns the raw error — see note 2 above.
 */
export function describeGoogleError(error: unknown): string {
  const err = error as GoogleErrorish | undefined;
  const data = err?.response?.data;

  if (data?.error) {
    return data.error_description ? `${data.error}: ${data.error_description}` : data.error;
  }
  if (err?.status ?? err?.code) {
    return `HTTP ${err.status ?? err.code}${err.message ? ` (${err.message})` : ''}`;
  }
  return err?.message ?? 'Unknown error';
}

/** User-facing copy for a dead grant. */
export const RECONNECT_REQUIRED_MESSAGE =
  'Access expired or was revoked. Reconnect to restore this integration.';
