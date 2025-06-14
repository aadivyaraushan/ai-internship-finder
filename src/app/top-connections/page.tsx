'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import { updateUserConnections, getUser } from '@/lib/firestoreHelpers';

interface Connection {
  id: number;
  name: string;
  imageUrl: string;
  matchPercentage: number;
  matchReason: string;
  verified: boolean;
}

export default function TopConnections() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }

    const fetchConnections = async () => {
      try {
        // Get user data to check if they have completed previous steps
        const userData = await getUser(auth.currentUser!.uid);
        if (!userData?.roles || !userData?.goals) {
          router.push('/upload-resume');
          return;
        }

        // For now, using mock data - in production, this would be an API call
        setConnections([
          {
            id: 1,
            name: 'Udit Pai',
            imageUrl: '/placeholder-profile.jpg',
            matchPercentage: 90,
            matchReason:
              "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            verified: true,
          },
          {
            id: 2,
            name: 'Udit Pai',
            imageUrl: '/placeholder-profile.jpg',
            matchPercentage: 90,
            matchReason:
              "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            verified: true,
          },
          {
            id: 3,
            name: 'Udit Pai',
            imageUrl: '/placeholder-profile.jpg',
            matchPercentage: 90,
            matchReason:
              "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            verified: true,
          },
          {
            id: 4,
            name: 'Udit Pai',
            imageUrl: '/placeholder-profile.jpg',
            matchPercentage: 90,
            matchReason:
              "We think this person is a great match because they're from UIUC and are members of the IEEE-Eta Kappa Nu (IEEE-HKN) honor society",
            verified: true,
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [router]);

  const handleConnect = async (connectionId: number) => {
    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    try {
      const selectedConnection = connections.find((c) => c.id === connectionId);
      if (selectedConnection) {
        await updateUserConnections(auth.currentUser.uid, [
          ...connections.filter((c) => c.id !== connectionId),
          { ...selectedConnection, status: 'pending' },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update connection');
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a]'>
        <div className='text-white'>Loading connections...</div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-4xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Connections
        </h1>
        <p className='text-gray-400 text-sm text-center mb-8'>
          Based on our AI search based on your roles, goals and resume
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {connections.map((connection) => (
            <div
              key={connection.id}
              className='bg-[#2a2a2a] p-4 rounded-lg flex items-start gap-4 hover:bg-[#3a3a3a] transition-colors'
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
                {connection.verified && (
                  <div className='absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1'>
                    <svg
                      className='w-3 h-3 text-white'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className='flex-1'>
                <h3 className='text-white font-medium'>{connection.name}</h3>
                <p className='text-gray-400 text-sm mt-1'>
                  {connection.matchReason}
                </p>
                <div className='flex items-center gap-2 mt-2'>
                  <div className='text-blue-500 font-medium'>
                    {connection.matchPercentage}% Match
                  </div>
                  <button
                    onClick={() => handleConnect(connection.id)}
                    className='px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors'
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
