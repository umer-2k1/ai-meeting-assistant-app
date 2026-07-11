import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type User } from '@/contexts/auth-context';
import { BrandLoader } from '@/components/brand/brand-loader';

export default function AuthCallbackScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const token = searchParams.get('token');
  const userParam = searchParams.get('user');

  useEffect(() => {
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
  }, [token, userParam, navigate, setAuth]);

  return <BrandLoader fullScreen label='Completing sign in…' />;
}
