'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createOrUpdateUser, getUser } from '@/lib/firestoreHelpers';
import { StatefulButton } from '@/components/ui/StatefulButton';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';
import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';

export default function BackgroundInfo() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form fields
  const [race, setRace] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [highSchoolType, setHighSchoolType] = useState('');
  const [financialAid, setFinancialAid] = useState('');
  const [university, setUniversity] = useState('');

  const router = useRouter();

  const raceOptions = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Two or more races',
    'Prefer not to say'
  ];

  const genderOptions = [
    'Male',
    'Female', 
    'Non-binary',
    'Other',
    'Prefer not to say'
  ];

  const countryList = [
    'United States of America',
    'Canada',
    'United Kingdom',
    'Australia',
    'Germany',
    'France',
    'India',
    'China',
    'Japan',
    'South Korea',
    'Singapore',
    'Mexico',
    'Brazil',
    'Argentina',
    'Spain',
    'Italy',
    'Netherlands',
    'Sweden',
    'Norway',
    'Denmark',
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Armenia',
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
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cabo Verde',
    'Cambodia',
    'Cameroon',
    'Central African Republic',
    'Chad',
    'Chile',
    'Colombia',
    'Comoros',
    'Congo (Congo-Brazzaville)',
    'Costa Rica',
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czechia',
    'Democratic Republic of the Congo',
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
    'Gabon',
    'Gambia',
    'Georgia',
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
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Jamaica',
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
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Korea',
    'North Macedonia',
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
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Sudan',
    'Sri Lanka',
    'Sudan',
    'Suriname',
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
    document.title = 'Background Information | Refr';
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      setUser(currentUser);
      
      try {
        const userData = await getUser(currentUser.uid);
        if (userData) {
          // Pre-fill form if data exists
          setRace(userData.race || '');
          setGender(userData.gender || '');
          setCountry(userData.country || '');
          setHighSchoolType(userData.highSchoolType || '');
          setFinancialAid(userData.financialAid || '');
          setUniversity(userData.university || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
      
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setLoading(true);

    try {
      await createOrUpdateUser(user.uid, {
        race,
        gender,
        country,
        highSchoolType,
        financialAid,
        university,
        backgroundInfoCompleted: true,
      });

      router.push('/upload-resume');
    } catch (err) {
      console.error('Error saving background info:', err);
      setError('An error occurred while saving your information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className='flex flex-col min-h-screen items-center justify-center bg-neutral-950 p-4'>
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
          <h1 className='text-2xl font-bold text-white mb-6 text-center'>
            Background Information
          </h1>
          <p className='text-gray-400 text-sm mb-6 text-center max-w-md'>
            Help us personalize your experience by sharing some background information.
          </p>
        
        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm max-w-md w-full'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4 w-full max-w-md'>
          <div>
            <label className='block text-gray-300 text-sm mb-2'>Race/Ethnicity</label>
            <select
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select race/ethnicity</option>
              {raceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-gray-300 text-sm mb-2'>Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select gender</option>
              {genderOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-gray-300 text-sm mb-2'>Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select country</option>
              {countryList.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-gray-300 text-sm mb-2'>High School Type</label>
            <select
              value={highSchoolType}
              onChange={(e) => setHighSchoolType(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select high school type</option>
              <option value='Public'>Public</option>
              <option value='Private'>Private</option>
              <option value='Homeschool'>Homeschool</option>
              <option value='Other'>Other</option>
            </select>
          </div>

          <div>
            <label className='block text-gray-300 text-sm mb-2'>Financial Aid Status</label>
            <select
              value={financialAid}
              onChange={(e) => setFinancialAid(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>Select financial aid status</option>
              <option value='Yes'>Yes, I receive financial aid</option>
              <option value='No'>No, I do not receive financial aid</option>
              <option value='Not applicable'>Not applicable</option>
            </select>
          </div>

          <div>
            <label className='block text-gray-300 text-sm mb-2'>University</label>
            <input
              type='text'
              placeholder='Enter your university name'
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className='w-full px-4 py-2 rounded-lg bg-neutral-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <StatefulButton type='submit' className='w-full' disabled={loading}>
            Continue to Resume Upload
          </StatefulButton>
        </form>

          <p className='text-gray-400 text-sm mt-4 text-center'>
            All fields are optional and help us provide better recommendations.
          </p>
        </div>
      </div>
    </>
  );
}