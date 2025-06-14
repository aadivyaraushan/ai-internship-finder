'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import {
  getUser,
  createOrUpdateUser,
  createOrUpdateResume,
} from '@/lib/firestoreHelpers';

interface Connection {
  id: number;
  name: string;
  imageUrl: string;
  matchPercentage: number;
  matchReason: string;
  status?: 'Awaiting response' | 'Responded' | null;
}

interface Role {
  title: string;
  bulletPoints: string[];
}

export default function Dashboard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reachedOutConnections, setReachedOutConnections] = useState<
    Connection[]
  >([]);
  const [suggestedConnections, setSuggestedConnections] = useState<
    Connection[]
  >([]);

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }

    const fetchUserData = async () => {
      try {
        const data = await getUser(auth.currentUser!.uid);
        if (data) {
          setUserData(data);
          setGoals(data.goals || '');
          // In production, these would be fetched from an API
          setReachedOutConnections([
            {
              id: 1,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
              status: 'Awaiting response',
            },
            {
              id: 2,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
              status: 'Responded',
            },
            {
              id: 3,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
              status: 'Awaiting response',
            },
          ]);
          setSuggestedConnections([
            {
              id: 4,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            },
            {
              id: 5,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            },
            {
              id: 6,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            },
            {
              id: 7,
              name: 'Udit Pai',
              imageUrl: '/placeholder-profile.jpg',
              matchPercentage: 90,
              matchReason:
                "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            },
          ]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: async (acceptedFiles) => {
      if (!auth.currentUser) {
        setError('Please sign in to continue');
        router.push('/signup');
        return;
      }

      try {
        setFile(acceptedFiles[0]);
        const formData = new FormData();
        formData.append('file', acceptedFiles[0]);

        const response = await fetch('/api/resume-analysis', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to analyze resume');
        }

        const data = await response.json();
        const resumeId = `${auth.currentUser.uid}_${Date.now()}`;

        await createOrUpdateResume(resumeId, {
          ...data.response.resumeData,
          userId: auth.currentUser.uid,
          uploadedAt: new Date().toISOString(),
        });

        await createOrUpdateUser(auth.currentUser.uid, {
          resume_id: resumeId,
        });

        setError('');
      } catch (err: any) {
        setError(err.message || 'Failed to process resume');
      }
    },
  });

  const handleGoalsUpdate = async () => {
    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    try {
      await createOrUpdateUser(auth.currentUser.uid, {
        goals: goals.trim(),
      });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to update goals');
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a]'>
        <div className='text-white'>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-4xl'>
        <h1 className='text-2xl font-semibold text-white mb-6'>Dashboard</h1>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div className='space-y-6'>
          {/* Connections Section */}
          <div>
            <h2 className='text-xl font-medium text-white mb-4'>
              Your Connections
            </h2>
            <div className='space-y-4'>
              {/* Reached Out Section */}
              <div>
                <h3 className='text-white font-medium mb-2'>Reached Out</h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  {reachedOutConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className='bg-[#2a2a2a] p-4 rounded-lg flex items-start gap-4'
                    >
                      <div className='relative'>
                        <div className='w-12 h-12 rounded-full overflow-hidden bg-gray-700'>
                          <Image
                            src={connection.imageUrl}
                            alt={connection.name}
                            width={48}
                            height={48}
                            className='object-cover'
                          />
                        </div>
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center justify-between mb-1'>
                          <h4 className='text-white font-medium'>
                            {connection.name}
                          </h4>
                          <span
                            className={`text-sm ${
                              connection.status === 'Responded'
                                ? 'text-green-500'
                                : 'text-yellow-500'
                            }`}
                          >
                            {connection.status}
                          </span>
                        </div>
                        <p className='text-gray-400 text-sm'>
                          {connection.matchReason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Connections */}
              <div>
                <h3 className='text-white font-medium mb-2'>
                  Suggested Connections
                </h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  {suggestedConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className='bg-[#2a2a2a] p-4 rounded-lg flex items-start gap-4'
                    >
                      <div className='relative'>
                        <div className='w-12 h-12 rounded-full overflow-hidden bg-gray-700'>
                          <Image
                            src={connection.imageUrl}
                            alt={connection.name}
                            width={48}
                            height={48}
                            className='object-cover'
                          />
                        </div>
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center justify-between mb-1'>
                          <h4 className='text-white font-medium'>
                            {connection.name}
                          </h4>
                          <span className='text-blue-500'>
                            {connection.matchPercentage}% Match
                          </span>
                        </div>
                        <p className='text-gray-400 text-sm'>
                          {connection.matchReason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resume Upload Section */}
          <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg p-8 ${
                isDragActive ? 'border-blue-500' : ''
              }`}
            >
              <input {...getInputProps()} />
              <svg
                className='w-8 h-8 text-gray-400 mb-2'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                />
              </svg>
              <p className='text-gray-300 mb-1'>
                {file ? file.name : 'Drag your resume here or click to upload'}
              </p>
              <p className='text-gray-500 text-sm'>
                Acceptable file types: PDF, DOCX (5MB max)
              </p>
            </div>

            {/* Update Goals */}
            <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
              <h3 className='text-white font-medium mb-2'>Update your goal</h3>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                onBlur={handleGoalsUpdate}
                placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
                className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
