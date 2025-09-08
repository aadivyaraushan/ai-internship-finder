'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createOrUpdateUser } from '@/lib/firestoreHelpers';
import { useRouter } from 'next/navigation';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';
import { CloudyBackground } from '@/components/ui/CloudyBackground';
import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';
import { analytics } from '@/lib/analytics';
import BorderMagicButton from '@/components/ui/BorderMagicButton';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    document.title = 'Sign Up | Refr';

    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      setAuthLoading(false);
      if (user) {
        console.log('User is already logged in');
        router.push('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const validatePassword = (password: string): string[] => {
    const warnings: string[] = [];

    if (password.length < 8) {
      warnings.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      warnings.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      warnings.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      warnings.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      warnings.push('Password must contain at least one special character');
    }

    return warnings;
  };

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
    const warnings = validatePassword(newPassword);
    setPasswordWarnings(warnings);
  };

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled. Please contact support.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    const warnings = validatePassword(password);
    if (warnings.length > 0) {
      setError('Please fix the password requirements before continuing.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      analytics.trackSignup('email');

      await createOrUpdateUser(user.uid, {
        email: email,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        hasResume: false,
        goals: [],
        roles: [],
        connections: [],
      });

      router.push('/background-info');
    } catch (err: any) {
      analytics.trackError('signup', err.message || 'Signup failed');
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
            Sign Up
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
              className='w-full px-4 py-3 rounded-lg bg-neutral-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />

            <div>
              <input
                type='password'
                placeholder='Password'
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className='w-full px-4 py-3 rounded-lg bg-neutral-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
              />

              {password && passwordWarnings.length > 0 && (
                <div className='mt-2 space-y-1'>
                  {passwordWarnings.map((warning, index) => (
                    <div
                      key={index}
                      className='text-red-400 text-xs flex items-center'
                    >
                      <span className='w-1.5 h-1.5 bg-red-400 rounded-full mr-2'></span>
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {password && passwordWarnings.length === 0 && (
                <div className='mt-2 text-green-400 text-xs flex items-center'>
                  <span className='w-1.5 h-1.5 bg-green-400 rounded-full mr-2'></span>
                  Password meets all requirements
                </div>
              )}
            </div>

            <BorderMagicButton
              onClick={handleSubmit}
              disabled={loading}
              className='w-full'
            >
              {loading ? 'Creating account...' : 'Continue'}
            </BorderMagicButton>
          </div>

          <p className='text-gray-400 text-sm mt-6 text-center'>
            Already have an account?{' '}
            <Link href='/login' className='text-blue-400 hover:text-blue-300'>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
