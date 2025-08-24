'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreHelpers';
import { useRouter } from 'next/navigation';
import { BackgroundGradient } from '@/components/ui/BackgroundGradient';
import { StatefulButton } from '@/components/ui/StatefulButton';
import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';
import { analytics } from '@/lib/analytics';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Set page title (client-side only)
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
      // Let onAuthStateChanged handle the redirect to avoid double redirects
    } catch (err: any) {
      analytics.trackError('login', err.message || 'Login failed');
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // Always show loading until we confirm user is not logged in
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
      <div className='flex flex-col min-h-screen flex items-center justify-center bg-neutral-950 p-4'>
      {/* <BackgroundGradient className='w-full max-w-md bg-neutral-900 p-8 rounded-3xl'> */}
      <h1 className='text-2xl font-bold text-white mb-6 text-center'>Login</h1>
      {error && (
        <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className='space-y-4'>
        <input
          type='email'
          placeholder='Email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <StatefulButton type='submit' className='w-full'>
          Login
        </StatefulButton>
      </form>
      <p className='text-gray-400 text-sm mt-4 text-center'>
        Don't have an account?{' '}
        <Link href='/' className='text-blue-500 underline'>
          Sign up
        </Link>
      </p>
      {/* </BackgroundGradient> */}
      </div>
    </>
  );
}
