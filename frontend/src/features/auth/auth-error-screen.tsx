import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export default function AuthErrorScreen() {
  const navigate = useNavigate();

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'>
      <div className='w-full max-w-md px-6 text-center'>
        <div className='mb-6 inline-flex items-center justify-center rounded-full bg-red-500/10 p-4'>
          <IconAlertTriangle className='size-12 text-red-500' />
        </div>
        
        <h1 className='mb-4 text-3xl font-bold text-white'>Authentication Failed</h1>
        <p className='mb-8 text-slate-400'>
          We couldn't sign you in. Please try again.
        </p>

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
