'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { auth, db, getCurrentUser } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');
  const [selectedView, setSelectedView] = useState<'roles' | 'goals' | 'people'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      console.log('fetchUserData called');
      const user = getCurrentUser();
      console.log('Current user:', user);
      if (!user) return;

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Fetched userData from Firestore:', userData);
          // Handle goals: can be a string or array of objects
          if (userData.goals) {
            if (typeof userData.goals === 'string') {
              setGoals(userData.goals);
              console.log('Set goals (string):', userData.goals);
            } else if (Array.isArray(userData.goals)) {
              // If goals is an array, join titles for textarea
              setGoals(userData.goals.map((g: any) => g.title || '').join('\n'));
              console.log('Set goals (array):', userData.goals);
            } else {
              setGoals('');
              console.log('Set goals (unknown type):', userData.goals);
            }
          }
          // Handle roles: should be an array of Role objects
          if (userData.roles && Array.isArray(userData.roles)) {
            const parsedRoles = userData.roles.map((role: any) => ({
              title: role.title || '',
              bulletPoints: Array.isArray(role.bulletPoints) ? role.bulletPoints : [],
            }));
            setRoles(parsedRoles);
            console.log('Set roles:', parsedRoles);
          } else {
            setRoles([]);
            console.log('Set roles: []');
          }
        } else {
          console.log('No userDoc found for user:', user.uid);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const saveGoals = async () => {
    const user = getCurrentUser();
    if (!user) return;

    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        goals: goals
      }, { merge: true });
    } catch (error) {
      console.error('Error saving goals:', error);
    } finally {
      setSaving(false);
    }
  };

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
            {/* View Selector */}
            <div className='flex gap-4 mb-6'>
              <button
                onClick={() => setSelectedView('roles')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedView === 'roles'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setSelectedView('goals')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedView === 'goals'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                }`}
              >
                Goals
              </button>
              <button
                onClick={() => setSelectedView('people')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedView === 'people'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                }`}
              >
                People
              </button>
            </div>

            {/* Content Sections */}
            {selectedView === 'roles' && (
              <div className='space-y-4'>
                {loading ? (
                  <div className='text-gray-400 text-center'>Loading roles...</div>
                ) : (
                  roles.map((role, index) => (
                    <div key={index} className='bg-[#2a2a2a] p-4 rounded-lg'>
                      <h3 className='text-white font-medium mb-2'>{role.title}</h3>
                      <ul className='space-y-1'>
                        {role.bulletPoints.map((point, i) => (
                          <li key={i} className='text-gray-400 text-sm flex items-start'>
                            <span className='mr-2'>•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedView === 'goals' && (
              <div className='space-y-4'>
                <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                  <h3 className='text-white font-medium mb-2'>Your Goals</h3>
                  <textarea
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
                    className='w-full h-24 px-3 py-2 text-gray-300 bg-[#1a1a1a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
                  />
                  <button
                    onClick={saveGoals}
                    disabled={saving}
                    className='mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {saving ? 'Saving...' : 'Save Goals'}
                  </button>
                </div>
              </div>
            )}

            {selectedView === 'people' && (
              <div className='space-y-4'>
                <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                  <h3 className='text-white font-medium mb-2'>Suggested Connections</h3>
                  <p className='text-gray-400 text-sm'>
                    Coming soon: AI-powered connection suggestions based on your profile and goals.
                  </p>
                </div>
              </div>
            )}
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
                Drag your resume here or click to upload
              </p>
              <p className='text-gray-500 text-sm'>
                Acceptable file types: PDF, DOCX (5MB max)
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className='w-80'>
          <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
            <h2 className='text-white text-sm font-medium text-center mb-4'>
              Your Profile
            </h2>
            <div className='space-y-4'>
              <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                <h3 className='text-white text-sm font-medium mb-2'>Current Status</h3>
                <p className='text-gray-400 text-sm'>
                  {file ? 'Resume uploaded' : 'No resume uploaded'}
                </p>
              </div>
              <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                <h3 className='text-white text-sm font-medium mb-2'>Next Steps</h3>
                <ul className='text-gray-400 text-sm space-y-2'>
                  <li>• Upload your resume</li>
                  <li>• Set your career goals</li>
                  <li>• Explore suggested roles</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}