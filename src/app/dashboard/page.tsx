'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { auth, db } from '@/lib/firebase';
import { getCurrentUser, updateConnectionStatus } from '@/lib/firestoreHelpers';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Connection {
  id: string;
  name: string;
  imageUrl?: string;
  matchPercentage?: number;
  linkedin_url?: string;
  type?: 'person' | 'program';
  program_description?: string;
  program_type?: string;
  organization?: string;
  website_url?: string;
  enrollment_info?: string;
  how_this_helps?: string;
  status?:
    | 'not_contacted'
    | 'email_sent'
    | 'response_received'
    | 'meeting_scheduled'
    | 'rejected'
    | 'ghosted'
    | 'internship_acquired';
  current_role?: string;
  company?: string;
}

interface Role {
  title: string;
  bulletPoints: string[];
}

interface Goal {
  title: string;
  description?: string;
}

function getRandomColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
  ];
  const index = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Map status to label and color classes for badge UI
function getStatusInfo(status: Connection['status'] | undefined): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'email_sent':
      return {
        label: 'Email Sent',
        colorClass: 'bg-blue-600/20 text-blue-400',
      };
    case 'response_received':
      return {
        label: 'Responded',
        colorClass: 'bg-cyan-600/20 text-cyan-400',
      };
    case 'internship_acquired':
      return {
        label: 'Internship Acquired',
        colorClass: 'bg-green-600/20 text-green-400',
      };
    case 'rejected':
      return { label: 'Rejected', colorClass: 'bg-red-600/20 text-red-400' };
    case 'ghosted':
      return {
        label: 'No Response',
        colorClass: 'bg-yellow-600/20 text-yellow-400',
      };
    case 'not_contacted':
    default:
      return {
        label: 'Not Contacted',
        colorClass: 'bg-gray-600/20 text-gray-400',
      };
  }
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState<string | Goal[]>('');
  const [selectedView, setSelectedView] = useState<
    'roles' | 'goals' | 'people'
  >('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [expandedRoles, setExpandedRoles] = useState<boolean[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch user data when currentUser is available
  useEffect(() => {
    if (!currentUser) return;
    const fetchUserData = async () => {
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
            if (typeof userData.goals === 'string') {
              setGoals(userData.goals);
              console.log('Set goals (string):', userData.goals);
            } else if (Array.isArray(userData.goals)) {
              setGoals(userData.goals);
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
              bulletPoints: Array.isArray(role.bulletPoints)
                ? role.bulletPoints
                : [],
            }));
            setRoles(parsedRoles);
            console.log('Set roles:', parsedRoles);
          } else {
            setRoles([]);
            console.log('Set roles: []');
          }
          // Handle connections if present
          if (userData.connections && Array.isArray(userData.connections)) {
            setConnections(userData.connections);
            console.log(
              'Set connections from Firestore:',
              userData.connections
            );
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

  // Load connections from localStorage as a fallback when component mounts
  useEffect(() => {
    try {
      const stored = localStorage.getItem('topConnections');
      if (stored) {
        const parsedConnections: Connection[] = JSON.parse(stored);
        if (parsedConnections.length > 0) {
          setConnections((prev) =>
            prev.length === 0 ? parsedConnections : prev
          );
          console.log(
            'Loaded connections from localStorage:',
            parsedConnections
          );
        }
      }
    } catch (err) {
      console.error('Error loading connections from localStorage', err);
    }
  }, []);

  // When roles are loaded, initialize expandedRoles state
  useEffect(() => {
    setExpandedRoles(Array(roles.length).fill(false));
  }, [roles.length]);

  const saveGoals = async () => {
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          goals: goals,
        },
        { merge: true }
      );
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

  // Handler to update a connection's status
  const handleStatusChange = async (
    connectionId: string,
    newStatus: Connection['status']
  ) => {
    if (!currentUser) return;
    try {
      // Optimistic UI update
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, status: newStatus } : c
        )
      );
      await updateConnectionStatus(
        currentUser.uid,
        connectionId,
        newStatus as any
      );
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

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
              <div>
                {loading ? (
                  <div className='text-gray-400 text-center'>
                    Loading roles...
                  </div>
                ) : (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {roles.map((role, index) => {
                      const expanded = expandedRoles[index];
                      const handleToggle = () => {
                        setExpandedRoles((prev) => {
                          const newExpanded = [...prev];
                          newExpanded[index] = !expanded;
                          return newExpanded;
                        });
                      };
                      // If expanded, span both columns
                      const colSpanClass = expanded ? 'md:col-span-2' : '';
                      return (
                        <div
                          key={index}
                          className={`bg-[#2a2a2a] rounded-lg overflow-hidden ${colSpanClass} transition-all duration-300 ${
                            expanded
                              ? 'shadow-lg bg-blue-500/30 border border-blue-500'
                              : ''
                          }`}
                          style={{
                            transition: 'box-shadow 0.3s, background 0.3s',
                          }}
                        >
                          <button
                            className='w-full text-left px-4 py-3 focus:outline-none flex items-center justify-between'
                            onClick={handleToggle}
                          >
                            <span className='text-white font-medium'>
                              {role.title}
                            </span>
                            <svg
                              className={`w-5 h-5 ml-2 transition-transform ${
                                expanded ? 'rotate-180' : ''
                              }`}
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M19 9l-7 7-7-7'
                              />
                            </svg>
                          </button>
                          <div
                            className={`transition-all duration-300 ease-in-out ${
                              expanded
                                ? 'max-h-96 opacity-100 py-4 px-4'
                                : 'max-h-0 opacity-0 py-0 px-4'
                            }`}
                            style={{ overflow: 'hidden' }}
                          >
                            <ul className='space-y-1'>
                              {role.bulletPoints.map((point, i) => (
                                <li
                                  key={i}
                                  className='text-gray-400 text-sm flex items-start'
                                >
                                  <span className='mr-2'>•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedView === 'goals' && (
              <div className='space-y-4'>
                <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                  <h3 className='text-white font-medium mb-2'>Your Goals</h3>
                  {Array.isArray(goals) ? (
                    <div className='space-y-3'>
                      {goals.map((goal, i) => (
                        <div key={i} className='bg-[#1a1a1a] p-3 rounded-lg'>
                          <h4 className='text-white font-semibold'>
                            {goal.title}
                          </h4>
                          {goal.description && (
                            <p className='text-gray-400 text-sm'>
                              {goal.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='bg-[#1a1a1a] p-3 rounded-lg text-gray-300'>
                      {goals || 'No goals set yet.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedView === 'people' && (
              <div className='space-y-4'>
                <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                  <h3 className='text-white font-medium mb-2'>
                    Suggested Connections
                  </h3>
                  {connections && connections.length > 0 ? (
                    <div className='space-y-3'>
                      {connections.map((connection) => {
                        console.log('Rendering connection:', connection);
                        return (
                          <div
                            key={connection.id}
                            className='bg-[#1a1a1a] p-4 rounded-lg flex items-start gap-4'
                          >
                            <div className='relative'>
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${getRandomColor(
                                  connection.name
                                )}`}
                              >
                                {getInitials(connection.name)}
                              </div>
                            </div>
                            <div className='flex-1'>
                              {/* Header: name + status badge + LinkedIn */}
                              <div className='flex flex-wrap items-center justify-between gap-2 mb-1'>
                                <div className='flex items-center gap-2 min-w-0'>
                                  <h3 className='text-white font-medium truncate'>
                                    {connection.name}
                                  </h3>
                                  {/* Status badge */}
                                  {(() => {
                                    const { label, colorClass } = getStatusInfo(
                                      connection.status
                                    );
                                    return (
                                      <span
                                        className={`text-xs font-medium px-2 py-0.5 rounded ${colorClass}`}
                                      >
                                        {label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {connection.linkedin_url && (
                                  <a
                                    href={connection.linkedin_url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-blue-500 font-medium text-sm underline flex-shrink-0'
                                  >
                                    LinkedIn
                                  </a>
                                )}
                              </div>

                              {/* Secondary info */}
                              <p className='text-gray-400 text-sm mb-1'>
                                {connection.type === 'program' ? (
                                  <>
                                    {connection.program_type && (
                                      <span className='capitalize'>
                                        {connection.program_type}
                                      </span>
                                    )}
                                    {connection.organization && (
                                      <>
                                        {connection.program_type && ' • '}
                                        <span>{connection.organization}</span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {connection.current_role && (
                                      <span>{connection.current_role}</span>
                                    )}
                                    {connection.company && (
                                      <>
                                        {connection.current_role && ' at '}
                                        <span>{connection.company}</span>
                                      </>
                                    )}
                                  </>
                                )}
                              </p>

                              {/* Status selector */}
                              <div className='mt-2'>
                                <select
                                  value={connection.status || 'not_contacted'}
                                  onChange={(e) =>
                                    handleStatusChange(
                                      connection.id,
                                      e.target.value as Connection['status']
                                    )
                                  }
                                  className='bg-[#2a2a2a] text-gray-300 text-xs px-2 py-1 rounded focus:outline-none'
                                >
                                  <option value='not_contacted'>
                                    Not Contacted
                                  </option>
                                  <option value='email_sent'>
                                    Email/Message Sent / Waiting for Response
                                  </option>
                                  <option value='response_received'>
                                    Responded
                                  </option>
                                  <option value='internship_acquired'>
                                    Internship Acquired
                                  </option>
                                  <option value='ghosted'>No Response</option>
                                  <option value='rejected'>Rejected</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className='text-gray-400 text-sm'>
                      Coming soon: AI-powered connection suggestions based on
                      your profile and goals.
                    </p>
                  )}
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
                <h3 className='text-white text-sm font-medium mb-2'>
                  Current Status
                </h3>
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
                    {userData &&
                    ((Array.isArray(userData.goals) &&
                      userData.goals.length > 0) ||
                      (typeof userData.goals === 'string' &&
                        userData.goals.trim() !== '')) ? (
                      <span className='text-green-400 mr-2'>✔</span>
                    ) : (
                      <span className='text-gray-500 mr-2'>○</span>
                    )}
                    Goals set
                  </li>
                  <li className='flex items-center'>
                    {userData &&
                    Array.isArray(userData.roles) &&
                    userData.roles.length > 0 ? (
                      <span className='text-green-400 mr-2'>✔</span>
                    ) : (
                      <span className='text-gray-500 mr-2'>○</span>
                    )}
                    Roles explored
                  </li>
                </ul>
              </div>
              <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                <h3 className='text-white text-sm font-medium mb-2'>
                  Next Steps
                </h3>
                <ul className='text-gray-400 text-sm space-y-2'>
                  {userData && !userData.resume_id && (
                    <li>• Upload your resume</li>
                  )}
                  {userData &&
                    !(
                      (Array.isArray(userData.goals) &&
                        userData.goals.length > 0) ||
                      (typeof userData.goals === 'string' &&
                        userData.goals.trim() !== '')
                    ) && <li>• Set your career goals</li>}
                  {userData &&
                    !(
                      Array.isArray(userData.roles) && userData.roles.length > 0
                    ) && <li>• Explore suggested roles</li>}
                  {userData &&
                    userData.resume_id &&
                    ((Array.isArray(userData.goals) &&
                      userData.goals.length > 0) ||
                      (typeof userData.goals === 'string' &&
                        userData.goals.trim() !== '')) &&
                    Array.isArray(userData.roles) &&
                    userData.roles.length > 0 && (
                      <li className='text-green-400'>All steps complete! 🎉</li>
                    )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
