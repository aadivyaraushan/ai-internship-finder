'use client';
import { BackgroundGradient } from '@/components/ui/BackgroundGradient';
import { StatefulButton } from '@/components/ui/StatefulButton';
import '../signup.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createOrUpdateUser } from '@/lib/firestoreHelpers';
import { useRouter } from 'next/navigation';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';
import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';
import { analytics } from '@/lib/analytics';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  // Full list of ISO country names for dropdown
  const countryList = [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Argentina',
    'Armenia',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bhutan',
    'Bolivia',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cabo Verde',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Colombia',
    'Comoros',
    'Congo (Congo-Brazzaville)',
    'Costa Rica',
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czechia',
    'Democratic Republic of the Congo',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Eswatini (fmr. "Swaziland")',
    'Ethiopia',
    'Fiji',
    'Finland',
    'France',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Greece',
    'Grenada',
    'Guatemala',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Holy See',
    'Honduras',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Italy',
    'Jamaica',
    'Japan',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    'Kuwait',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Mauritania',
    'Mauritius',
    'Mexico',
    'Micronesia',
    'Moldova',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Morocco',
    'Mozambique',
    'Myanmar (formerly Burma)',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Korea',
    'North Macedonia',
    'Norway',
    'Oman',
    'Pakistan',
    'Palau',
    'Palestine State',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Poland',
    'Portugal',
    'Qatar',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'Sao Tome and Principe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Korea',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Sweden',
    'Switzerland',
    'Syria',
    'Tajikistan',
    'Tanzania',
    'Thailand',
    'Timor-Leste',
    'Togo',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Tuvalu',
    'Uganda',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States of America',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Venezuela',
    'Vietnam',
    'Yemen',
    'Zambia',
    'Zimbabwe',
  ];

  useEffect(() => {
    // Set page title
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Check password strength before submission
    const warnings = validatePassword(password);
    if (warnings.length > 0) {
      setError('Please fix the password requirements before continuing.');
      setLoading(false);
      return;
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      analytics.trackSignup('email');
      
      // Create minimal initial Firestore document
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

  // Show loading spinner while checking auth state
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
        <ShootingStars />
        <StarsBackground />
        <div className='relative z-10 flex flex-col items-center'>
          <h1 className='heading text-white text-2xl font-bold text-center mb-6'>
            Sign Up
          </h1>
          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className='space-y-4 w-full max-w-md'>
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
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            
            {/* Password strength indicators */}
            {password && passwordWarnings.length > 0 && (
              <div className='mt-2 space-y-1'>
                {passwordWarnings.map((warning, index) => (
                  <div key={index} className='text-red-400 text-xs flex items-center'>
                    <span className='w-2 h-2 bg-red-400 rounded-full mr-2'></span>
                    {warning}
                  </div>
                ))}
              </div>
            )}
            
            {/* Password strength success indicators */}
            {password && passwordWarnings.length === 0 && (
              <div className='mt-2 text-green-400 text-xs flex items-center'>
                <span className='w-2 h-2 bg-green-400 rounded-full mr-2'></span>
                Password meets all requirements
              </div>
            )}
            
            <StatefulButton type='submit' className='w-full'>
              Continue to Background Info
            </StatefulButton>
          </form>
          <p className='text-gray-400 text-sm mt-4 text-center'>
            Already have an account?{' '}
            <Link href='/login' className='text-blue-500 underline'>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
