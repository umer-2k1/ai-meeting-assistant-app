import { IconBrandGoogle, IconSparkles } from '@tabler/icons-react';
import { useAuth } from '../../contexts/auth-context';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function LoginScreen() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background'>
        <div className='inline-block size-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    );
  }

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'>
      {/* Background Effects */}
      <div className='pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-cyan-500/10 blur-3xl' />
      <div className='pointer-events-none absolute top-1/3 right-0 size-[32rem] rounded-full bg-blue-500/10 blur-3xl' />
      <div className='pointer-events-none absolute bottom-0 left-1/3 size-[36rem] rounded-full bg-indigo-500/10 blur-3xl' />

      <div className='relative z-10 w-full max-w-md px-6'>
        {/* Logo/Brand */}
        <div className='mb-8 text-center'>
          <div className='mb-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 p-4 backdrop-blur-xl'>
            <IconSparkles className='size-12 text-cyan-400' />
          </div>
          <h1 className='mb-2 text-4xl font-bold tracking-tight text-white'>
            AI Meeting Copilot
          </h1>
          <p className='text-lg text-slate-400'>
            Your intelligent meeting assistant
          </p>
        </div>

        {/* Login Card */}
        <div className='rounded-2xl border border-slate-800/50 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl'>
          <div className='mb-6 space-y-2 text-center'>
            <h2 className='text-2xl font-semibold text-white'>Welcome</h2>
            <p className='text-sm text-slate-400'>
              Sign in to access your meetings and AI insights
            </p>
          </div>

          <button
            onClick={login}
            className='group relative w-full overflow-hidden rounded-lg border border-slate-700 bg-white px-6 py-3.5 text-base font-medium text-slate-900 transition-all duration-200 hover:bg-slate-50'
          >
            <span className='relative z-10 flex items-center justify-center gap-3'>
              <IconBrandGoogle className='size-5' />
              Continue with Google
            </span>
            <div className='absolute inset-0 -z-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 transition-opacity group-hover:opacity-100' />
          </button>

          <div className='mt-6 text-center text-xs text-slate-500'>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>

        {/* Features */}
        <div className='mt-8 grid grid-cols-3 gap-4 text-center'>
          <div className='rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur'>
            <div className='mb-1 text-2xl'>🎙️</div>
            <div className='text-xs text-slate-400'>Live Recording</div>
          </div>
          <div className='rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur'>
            <div className='mb-1 text-2xl'>✨</div>
            <div className='text-xs text-slate-400'>AI Insights</div>
          </div>
          <div className='rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur'>
            <div className='mb-1 text-2xl'>📊</div>
            <div className='text-xs text-slate-400'>Smart Summary</div>
          </div>
        </div>
      </div>
    </div>
  );
}
