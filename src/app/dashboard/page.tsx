'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';

interface Connection {
  id: number;
  name: string;
  imageUrl: string;
  matchPercentage: number;
  matchReason: string;
  status?: 'Awaiting response' | 'Responded' | null;
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');

  const [reachedOutConnections] = useState<Connection[]>([
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

  const [suggestedConnections] = useState<Connection[]>([
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]);
    },
  });

  return (
    <div className='min-h-screen bg-[#0a0a0a] p-4'>
      {/* Logo */}
      <div className='mb-8'>
        <div className='bg-[#2a2a2a] inline-block p-4 rounded-xl'>
          <h1 className='text-white text-2xl font-mono'>Refr ☕️</h1>
        </div>
      </div>

      <div className='flex gap-6'>
        {/* Main Content */}
        <div className='flex-1'>
          <div className='bg-[#1a1a1a] p-6 rounded-2xl mb-6'>
            <p className='text-gray-400 text-sm mb-6 text-center'>
              These are connections we found that match your profile
            </p>

            <div className='grid grid-cols-2 gap-4'>
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
                    <div className='flex items-center justify-between mb-2'>
                      <h3 className='text-white font-medium'>
                        {connection.name}
                      </h3>
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

          {/* Bottom Sections */}
          <div className='grid grid-cols-2 gap-4'>
            {/* Resume Upload */}
            <div
              {...getRootProps()}
              className={`bg-[#1a1a1a] p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed border-gray-600 hover:border-gray-500 ${
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
                Drag your resume here or click to upload
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
                placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
                className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className='w-80'>
          <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
            <h2 className='text-white text-sm font-medium text-center mb-4'>
              Connections you have already reached out to
            </h2>
            <div className='space-y-4'>
              {reachedOutConnections.map((connection) => (
                <div
                  key={connection.id}
                  className='flex items-center gap-3 bg-[#2a2a2a] p-2 rounded-lg'
                >
                  <Image
                    src={connection.imageUrl}
                    alt={connection.name}
                    width={32}
                    height={32}
                    className='rounded-full'
                  />
                  <div className='flex-1 min-w-0'>
                    <h3 className='text-white text-sm font-medium truncate'>
                      {connection.name}
                    </h3>
                    <p
                      className={`text-xs ${
                        connection.status === 'Responded'
                          ? 'text-green-500'
                          : 'text-red-400'
                      }`}
                    >
                      {connection.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
