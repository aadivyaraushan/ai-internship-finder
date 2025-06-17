'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { auth, db, getCurrentUser } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

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

interface Goal {
  title: string;
  description?: string;
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedView, setSelectedView] = useState<'roles' | 'goals' | 'people'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [expandedRoles, setExpandedRoles] = useState<boolean[]>([]);
  const [error, setError] = useState('');
  const [reachedOutConnections, setReachedOutConnections] = useState<Connection[]>([]);
  const [suggestedConnections, setSuggestedConnections] = useState<Connection[]>([]);
  const router = useRouter();

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        router.push('/signup');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch user data when currentUser is available
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      console.log('fetchUserData called');
      console.log('Current user:', currentUser);
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
          console.log('Fetched userData from Firestore:', userData);
          // Handle goals: can be a string or array of objects
          if (userData.goals) {
            if (Array.isArray(userData.goals)) {
              setGoals(userData.goals);
              console.log('Set goals (array):', userData.goals);
            } else {
              // Convert string to Goal array if needed
              setGoals([{ title: userData.goals }]);
              console.log('Set goals (converted string):', userData.goals);
            }
          } else {
            setGoals([]);
            console.log('Set goals: []');
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
          console.log('No userDoc found for user:', currentUser.uid);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [currentUser]);

  // When roles are loaded, initialize expandedRoles state
  useEffect(() => {
    setExpandedRoles(Array(roles.length).fill(false));
  }, [roles.length]);

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

  const handleGoalsUpdate = async () => {
    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        goals: goals
      }, { merge: true });
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
                ) : roles.length === 0 ? (
                  <div className='text-gray-400 text-center'>No roles found. Save your goals to generate roles.</div>
                ) : (
                  roles.map((role, index) => (
                    <div key={index} className='bg-[#2a2a2a] p-4 rounded-lg'>
                      <h3 className='text-white font-medium mb-2'>{role.title}</h3>
                      <ul className='space-y-1'>
                        {role.bulletPoints.map((point: string, i: number) => (
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
                    value={JSON.stringify(goals, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setGoals(Array.isArray(parsed) ? parsed : []);
                      } catch {
                        // If JSON parsing fails, create a new goal with the text
                        setGoals([{ title: e.target.value }]);
                      }
                    }}
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
                <ul className='text-gray-400 text-sm space-y-2'>
                  <li className='flex items-center'>
                    {userData && userData.resume_id ? (
                      <span className='text-green-400 mr-2'>✔</span>
                    ) : (
                      <span className='text-gray-500 mr-2'>○</span>
                    )}
                    Resume uploaded
                  </li>
                  <li className='flex items-center'>
                    {userData && goals.length > 0 ? (
                      <span className='text-green-400 mr-2'>✔</span>
                    ) : (
                      <span className='text-gray-500 mr-2'>○</span>
                    )}
                    Goals set
                  </li>
                  <li className='flex items-center'>
                    {userData && Array.isArray(userData.roles) && userData.roles.length > 0 ? (
                      <span className='text-green-400 mr-2'>✔</span>
                    ) : (
                      <span className='text-gray-500 mr-2'>○</span>
                    )}
                    Roles explored
                  </li>
                </ul>
              </div>
              <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                <h3 className='text-white text-sm font-medium mb-2'>Next Steps</h3>
                <ul className='text-gray-400 text-sm space-y-2'>
                  {userData && !userData.resume_id && (
                    <li>• Upload your resume</li>
                  )}
                  {userData && goals.length === 0 && (
                    <li>• Set your career goals</li>
                  )}
                  {userData && !(Array.isArray(userData.roles) && userData.roles.length > 0) && (
                    <li>• Explore suggested roles</li>
                  )}
                  {userData && userData.resume_id && goals.length > 0 && (Array.isArray(userData.roles) && userData.roles.length > 0) && (
                    <li className='text-green-400'>All steps complete! 🎉</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Update Goals */}
          <div className='bg-[#1a1a1a] p-6 rounded-2xl mt-4'>
            <h3 className='text-white font-medium mb-2'>Update your goal</h3>
            <textarea
              value={JSON.stringify(goals, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setGoals(Array.isArray(parsed) ? parsed : []);
                } catch {
                  // If JSON parsing fails, create a new goal with the text
                  setGoals([{ title: e.target.value }]);
                }
              }}
              onBlur={handleGoalsUpdate}
              placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
              className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
        </div>
      </div>
    </div>
  );
}