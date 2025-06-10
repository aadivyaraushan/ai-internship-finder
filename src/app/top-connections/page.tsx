'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { checkAuth } from '@/lib/firebase';

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

  useEffect(() => {
      if (!checkAuth()) {
          router.push('/signup');
      }
  }, [router]);

  const [connections] = useState<Connection[]>([
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

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-4xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Connections
        </h1>
        <p className='text-gray-400 text-sm text-center mb-8'>
          Based on our AI search based on your roles, goals and resume
        </p>

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
                <div className='flex items-center justify-between mb-2'>
                  <h3 className='text-white font-medium'>{connection.name}</h3>
                  <span className='text-blue-400 font-medium'>
                    {connection.matchPercentage}%
                  </span>
                </div>
                <p className='text-gray-400 text-sm leading-snug'>
                  {connection.matchReason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
