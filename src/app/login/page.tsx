'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, checkAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { BackgroundGradient } from '@/components/ui/BackgroundGradient';
import { StatefulButton } from '@/components/ui/StatefulButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (checkAuth()) {
      console.log('User is already logged in');
      router.push('/dashboard');
    }
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
      router.push('/dashboard'); // Redirect to dashboard after successful login
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}
