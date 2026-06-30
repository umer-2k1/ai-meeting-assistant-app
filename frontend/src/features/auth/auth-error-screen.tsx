import { useMemo } from 'react';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AUTH_ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  oauth_misconfigured: {
    title: 'Google sign-in is not configured',
    description:
      'The server is missing Google OAuth credentials or the redirect URI is invalid. Check backend .env and Google Cloud Console settings.'
  },
  database_unavailable: {
    title: 'Database unavailable',
    description:
      'We could not connect to the database during sign-in. Make sure PostgreSQL is running and DATABASE_URL is set, then try again.'
  },
  no_email: {
    title: 'No email on Google account',
    description:
      'Your Google account did not provide an email address. Use a Google account with email access enabled.'
  },
  account_conflict: {
    title: 'Account already linked',
    description:
      'This Google account is already linked to another user. Try a different Google account or contact support.'
  },
  token_error: {
    title: 'Session could not be created',
    description:
      'Sign-in succeeded but the app could not create a session token. Check JWT_SECRET on the backend.'
  },
  auth_failed: {
    title: 'Authentication failed',
    description: 'Google sign-in was cancelled or denied. Please try again.'
  }
};

export default function AuthErrorScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { title, description } = useMemo(() => {
    const reason = searchParams.get('reason') ?? 'auth_failed';
    return AUTH_ERROR_MESSAGES[reason] ?? AUTH_ERROR_MESSAGES['auth_failed']!;
  }, [searchParams]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'>
      <div className='w-full max-w-md px-6 text-center'>
        <div className='mb-6 inline-flex items-center justify-center rounded-full bg-red-500/10 p-4'>
          <IconAlertTriangle className='size-12 text-red-500' />
        </div>

        <h1 className='mb-4 text-3xl font-bold text-white'>{title}</h1>
        <p className='mb-8 text-slate-400'>{description}</p>

        <button
          onClick={() => navigate('/login')}
          className='rounded-lg bg-white px-6 py-3 font-medium text-slate-900 transition-colors hover:bg-slate-100'
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
