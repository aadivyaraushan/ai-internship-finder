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
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  const raceOptions = [
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'White',
    'Middle Eastern or North African',
    'Native American or Alaska Native',
    'Native Hawaiian or Other Pacific Islander',
    'Other',
  ];

  const [races, setRaces] = useState<string[]>([]);
  // Gender state and options
  const genderOptions = [
    'Male',
    'Female',
    'Non-binary',
    'Prefer not to say',
    'Other',
  ];
  const [gender, setGender] = useState('');
  const [genderOpen, setGenderOpen] = useState(false);
  const toggleGender = () => setGenderOpen(!genderOpen);
  const genderDisplay = gender || 'Select Gender';
  const [countryOpen, setCountryOpen] = useState(false);

  // Multiselect dropdown handler
  const [raceOpen, setRaceOpen] = useState(false);
  const toggleRace = () => setRaceOpen(!raceOpen);
  const handleRaceSelect = (opt: string) => {
    setRaces((prev) =>
      prev.includes(opt) ? prev.filter((r) => r !== opt) : [...prev, opt]
    );
  };
  const raceDisplay =
    races.length > 0 ? races.join(', ') : 'Select Race / Ethnicity';

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
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      setAuthLoading(false);
      if (user) {
        console.log('User is already logged in');
        router.push('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

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

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      analytics.trackSignup('email');
      
      // Create initial Firestore document
      await createOrUpdateUser(user.uid, {
        email: email,
        race: races,
        location: country,
        gender: gender,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        hasResume: false,
        goals: [],
        roles: [],
        connections: [],
      });

      router.push('/upload-resume');
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
      <div className='flex flex-col min-h-screen flex items-center justify-center bg-neutral-950 p-4'>
      {/* <BackgroundGradient className='w-full max-w-lg bg-neutral-900 p-8 rounded-3xl'> */}
      <h1 className='heading text-white text-2xl font-bold text-center mb-6'>
        Sign Up
      </h1>
      {error && (
        <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          type='email'
          placeholder='Email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className='w-full px-4 py-2 mb-4 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className='w-full px-4 py-2 mb-4 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <div className='relative w-full'>
          <div className='dropdown-input' onClick={toggleRace}>
            <span>{raceDisplay}</span>
            <span className='caret' aria-hidden='true'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 20 20'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M6 8L10 12L14 8'
                  stroke='#9ca3af'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </span>
          </div>
          {raceOpen && (
            <div className='dropdown-menu'>
              {raceOptions.map((opt) => (
                <>
                  <label key={opt} className='dropdown-item'>
                    <input
                      type='checkbox'
                      checked={races.includes(opt)}
                      onChange={() => handleRaceSelect(opt)}
                      className='mr-2'
                    />
                    {opt}
                  </label>
                </>
              ))}
            </div>
          )}
        </div>
        {/* Gender dropdown */}
        <div className='relative w-full mt-2'>
          <div className='dropdown-input' onClick={toggleGender}>
            <span>{genderDisplay}</span>
            <span className='caret' aria-hidden='true'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 20 20'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M6 8L10 12L14 8'
                  stroke='#9ca3af'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </span>
          </div>
          {genderOpen && (
            <div className='dropdown-menu'>
              {genderOptions.map((opt) => (
                <div
                  key={opt}
                  className='dropdown-item'
                  onClick={() => {
                    setGender(opt);
                    setGenderOpen(false);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className='relative w-full mt-2'>
          <div
            className={`dropdown-input${country ? ' filled' : ''}`}
            onClick={() => setCountryOpen((open) => !open)}
            tabIndex={0}
            role='button'
            aria-haspopup='listbox'
            aria-expanded={countryOpen}
          >
            <span>
              {country || (
                <span style={{ color: '#9ca3af' }}>Select Country</span>
              )}
            </span>
            <span className='caret' aria-hidden='true'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 20 20'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M6 8L10 12L14 8'
                  stroke='#9ca3af'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </span>
          </div>
          {countryOpen && (
            <div className='dropdown-menu' role='listbox'>
              {countryList.map((c) => (
                <div
                  key={c}
                  className='dropdown-item'
                  role='option'
                  aria-selected={country === c}
                  onClick={() => {
                    setCountry(c);
                    setCountryOpen(false);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className='text-xs text-gray-400'>
          We ask for this information becuase it helps us filter out
          opportunities that might be restricted to certain backgrounds.
        </span>
        <StatefulButton type='submit' className='w-full mt-2'>
          Sign Up
        </StatefulButton>
      </form>
      <p className='text-gray-400 text-sm mt-4 text-center'>
        Already have an account?{' '}
        <Link href='/login' className='text-blue-500 underline'>
          Log in
        </Link>
      </p>
      </div>
    </>
  );
}
