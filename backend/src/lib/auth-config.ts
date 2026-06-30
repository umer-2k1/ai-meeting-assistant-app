const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  process.env.GOOGLE_CALLBACK_URL ||
  'http://localhost:3001/auth/google/callback';

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

export function getGoogleRedirectUri(): string {
  return GOOGLE_REDIRECT_URI;
}

export function getJwtSecret(): string | undefined {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      getGoogleRedirectUri()
  );
}

export type AuthConfigIssue =
  | 'database_url'
  | 'google_client_id'
  | 'google_client_secret'
  | 'google_redirect_uri'
  | 'jwt_secret';

export function getAuthConfigIssues(): AuthConfigIssue[] {
  const issues: AuthConfigIssue[] = [];

  if (!process.env.DATABASE_URL) {
    issues.push('database_url');
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    issues.push('google_client_id');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    issues.push('google_client_secret');
  }
  if (!getGoogleRedirectUri()) {
    issues.push('google_redirect_uri');
  }
  if (!getJwtSecret()) {
    issues.push('jwt_secret');
  }

  return issues;
}

export function mapAuthErrorToReason(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'unknown';

  const normalized = message.toLowerCase();

  if (normalized.includes('no email found')) {
    return 'no_email';
  }

  if (
    normalized.includes('unique constraint') ||
    normalized.includes('p2002') ||
    normalized.includes('already exists')
  ) {
    return 'account_conflict';
  }

  if (
    normalized.includes('connect') ||
    normalized.includes('database') ||
    normalized.includes('prisma') ||
    normalized.includes('econnrefused') ||
    normalized.includes("can't reach database")
  ) {
    return 'database_unavailable';
  }

  if (
    normalized.includes('redirect_uri') ||
    normalized.includes('invalid_client') ||
    normalized.includes('oauth') ||
    normalized.includes('token')
  ) {
    return 'oauth_misconfigured';
  }

  if (normalized.includes('jwt') || normalized.includes('secret')) {
    return 'token_error';
  }

  return 'auth_failed';
}

export function buildAuthErrorRedirect(reason: string): string {
  return `${getFrontendUrl()}/auth/error?reason=${encodeURIComponent(reason)}`;
}
