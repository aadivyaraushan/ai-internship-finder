'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreHelpers';
import { useRouter } from 'next/navigation';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';
import { CloudyBackground } from '@/components/ui/CloudyBackground';
import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';
import { analytics } from '@/lib/analytics';
import BorderMagicButton from '@/components/ui/BorderMagicButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Login | Refr';
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await getUser(user.uid);
          if (userData && userData.hasResume) {
            router.push('/dashboard');
          } else {
            router.push('/upload-resume');
          }
        } catch (error) {
          console.error('Error checking user data:', error);
          router.push('/upload-resume');
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      analytics.trackLogin('email');
    } catch (err: any) {
      analytics.trackError('login', err.message || 'Login failed');
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className='flex flex-col min-h-screen flex items-center justify-center bg-neutral-950 p-4'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-white'></div>
        <p className='text-white mt-4'>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <AdBlockerWarning />
      <div className='flex flex-col min-h-screen items-center justify-center bg-neutral-950 p-4 relative'>
        <StarsBackground />
        <CloudyBackground />
        <ShootingStars />

        <div className='relative z-10 w-full max-w-sm'>
          <h1 className='text-3xl font-bold text-white mb-6 text-center'>
            Login
          </h1>

          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}

          <div className='space-y-3'>
            <input
              type='email'
              placeholder='Email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-3 rounded-lg bg-neutral-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />

            <input
              type='password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full px-4 py-3 rounded-lg bg-neutral-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />

            <BorderMagicButton
              onClick={handleSubmit}
              disabled={loading}
              className='w-full'
            >
              {loading ? 'Signing in...' : 'Login'}
            </BorderMagicButton>
          </div>

          <p className='text-gray-400 text-sm mt-6 text-center'>
            Don't have an account?{' '}
            <Link href='/signup' className='text-blue-400 hover:text-blue-300'>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
