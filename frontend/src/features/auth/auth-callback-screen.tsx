import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type User } from '@/contexts/auth-context';

export default function AuthCallbackScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam)) as User;
        setAuth(token, user);
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth/error', { replace: true });
      }
    } else {
      navigate('/auth/error', { replace: true });
    }
  }, [searchParams, navigate, setAuth]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='text-center'>
        <div className='mb-4 inline-block size-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
        <p className='text-lg text-foreground'>Completing sign in...</p>
      </div>
    </div>
  );
}
