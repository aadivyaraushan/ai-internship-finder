'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  updateConnectionStatus,
  getUser,
  getResume,
  updateUserConnections,
  createOrUpdateResume,
  createOrUpdateUser,
} from '@/lib/firestoreHelpers';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { MultiStepLoader } from '@/components/ui/MultiStepLoader';
import { AnimatedTabs } from '@/components/ui/AnimatedTabs';
import { StatefulButton } from '@/components/ui/StatefulButton';
import BorderMagicButton from '@/components/ui/BorderMagicButton';
import { FileUpload } from '@/components/ui/FileUpload';

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
  description?: string;
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

interface Goal {
  title: string;
  description?: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

function getBackgroundColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
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
  const [selectedView, setSelectedView] = useState<'goal' | 'people'>('goal');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [findingMore, setFindingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'prepare', label: 'Preparing upload', status: 'pending' },
    { id: 'upload', label: 'Uploading file', status: 'pending' },
    { id: 'parse', label: 'Parsing resume content', status: 'pending' },
    { id: 'analyze', label: 'AI analysis', status: 'pending' },
    { id: 'store', label: 'Processing results', status: 'pending' },
  ]);

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

  const saveGoal = async () => {
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          goals: typeof goals === 'string' ? goals : JSON.stringify(goals),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setSaving(false);
    }
  };

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
    } catch (error) {
      // Revert optimistic update on error
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? { ...c, status: c.status } // revert to original status
            : c
        )
      );
      console.error('Failed to update connection status:', {
        connectionId,
        newStatus,
        error,
      });
      // You might want to add a toast notification here if you have a notification system
    }
  };

  // Fetch additional connections from the backend and merge with existing list
  const fetchMoreConnections = async () => {
    if (!currentUser) return;

    try {
      setFindingMore(true);

      // Refresh user + resume data to build the payload
      const userData: any = await getUser(currentUser.uid);
      if (!userData) {
        console.error('❌ Technical error - User data not found:', {
          userId: currentUser.uid,
        });
        throw new Error(
          'Unable to load your profile. Please try refreshing the page.'
        );
      }

      const resumeData: any = await getResume(currentUser.uid);
      if (!resumeData) {
        console.error('❌ Technical error - Resume data not found:', {
          userId: currentUser.uid,
        });
        throw new Error(
          'Please upload your resume to help us find relevant connections.'
        );
      }

      // Build goals payload in the format the API expects
      const goalsPayload = Array.isArray(userData?.goals)
        ? userData.goals.map((g: any) =>
            typeof g === 'string' ? { title: g } : g
          )
        : userData?.goals
        ? [{ title: userData.goals }]
        : [];

      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: goalsPayload,
          resumeContext: resumeData?.text || '',
          race: userData?.race || '',
          location: userData?.location || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Technical error - API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(
          errorData.error ||
            'We had trouble finding connections. Please try again in a few moments.'
        );
      }

      const data = await response.json();
      const newConnections: Connection[] = data.response.connections || [];

      setConnections((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const merged = [
          ...prev,
          ...newConnections.filter((c) => !existingIds.has(c.id)),
        ];

        // Persist merged list back to Firestore
        updateUserConnections(currentUser.uid, merged as any).catch((error) => {
          console.error('❌ Technical error - Failed to save connections:', {
            userId: currentUser.uid,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw here as this is a background operation
        });

        return merged;
      });
    } catch (error) {
      console.error('❌ Technical error - Failed to fetch connections:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // You might want to add a toast notification here if you have a notification system
      // toast.error('We had trouble finding connections. Please try again.');
    } finally {
      setFindingMore(false);
    }
  };

  // Helper to refresh user data after upload
  const refreshUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  // Resume upload handler
  const handleResumeUpload = async () => {
    setUploadError('');
    setUploadSuccess(false);
    setCurrentStatus('');
    setSteps([
      { id: 'prepare', label: 'Preparing upload', status: 'pending' },
      { id: 'upload', label: 'Uploading file', status: 'pending' },
      { id: 'parse', label: 'Parsing resume content', status: 'pending' },
      { id: 'analyze', label: 'AI analysis', status: 'pending' },
      { id: 'store', label: 'Processing results', status: 'pending' },
    ]);
    if (!file) {
      setUploadError('Please select a resume file to upload.');
      return;
    }
    if (!currentUser) {
      setUploadError('You must be signed in to upload a resume.');
      return;
    }
    setUploading(true);
    try {
      // Prepare upload
      updateStep('prepare', 'in_progress');
      setCurrentStatus('Preparing to upload resume...');
      const formData = new FormData();
      formData.append('file', file);
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStep('prepare', 'completed');

      // Upload file
      updateStep('upload', 'in_progress');
      setCurrentStatus('Uploading resume...');
      const response = await fetch('/api/resume-analysis', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to analyze resume');
      }
      updateStep('upload', 'completed');
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Parse and analyze
      updateStep('parse', 'in_progress');
      setCurrentStatus('Reading resume content...');
      const data = await response.json();

      // Handle initial processing steps
      if (data.response.processingSteps) {
        const apiSteps = data.response.processingSteps;
        if (apiSteps.fileRead) {
          updateStep('parse', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 400));
          updateStep('analyze', 'in_progress');
          setCurrentStatus('AI analyzing resume...');
        }
        if (apiSteps.pdfParsed) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (apiSteps.aiAnalysis) {
          updateStep('analyze', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 400));
          updateStep('store', 'in_progress');
          setCurrentStatus('Processing analysis results...');
        }
        if (apiSteps.dataStored) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          updateStep('store', 'completed');
          setCurrentStatus('Analysis complete!');
        }
      }

      // Store resume data in Firestore
      await createOrUpdateResume(currentUser.uid, {
        text: data.response.rawText,
        structuredData: data.response.structuredData,
        userId: currentUser.uid,
        uploadedAt: new Date().toISOString(),
      });
      // Update user with resume reference
      await createOrUpdateUser(currentUser.uid, {
        hasResume: true,
      });
      setUploadSuccess(true);
      setFile(null); // Optionally clear file
      await refreshUserData();
    } catch (err) {
      setCurrentStatus('Error during upload');
      updateStep(
        steps.find((step) => step.status === 'in_progress')?.id || 'prepare',
        'error'
      );
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload resume'
      );
    } finally {
      setUploading(false);
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

      {loading ? (
        <div className='text-gray-400 text-center'>Loading your profile...</div>
      ) : (
        <div className='flex gap-6'>
          {/* Main Content */}
          <div className='flex-1 m-'>
              <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
                {/* View Selector */}
                <div className='mb-6'>
                  <AnimatedTabs
                    tabs={[
                      { title: 'Current Goal', value: 'goal' },
                      { title: 'Programs / Connections', value: 'people' },
                    ]}
                    containerClassName=''
                    activeTabClassName='bg-accent/20'
                    onChange={(id) => setSelectedView(id as 'goal' | 'people')}
                  />
                </div>

                {/* Content Sections */}
                {selectedView === 'goal' && (
                  <div className='space-y-4'>
                    <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                      <h3 className='text-white font-medium mb-2'>
                        Current Goal
                      </h3>
                      <textarea
                        className='w-full h-24 px-3 py-2 text-gray-300 bg-[#1a1a1a] rounded-lg focus:outline-none'
                        value={typeof goals === 'string' ? goals : ''}
                        onChange={(e) => setGoals(e.target.value)}
                        placeholder='Describe your current career goal...'
                      />
                      <BorderMagicButton
                        onClick={saveGoal}
                        disabled={saving}
                        className='mt-2'
                      >
                        {saving ? 'Saving...' : 'Save Goal'}
                      </BorderMagicButton>
                    </div>
                  </div>
                )}

                {selectedView === 'people' && (
                  <div className='space-y-4'>
                    <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                      {connections && connections.length > 0 ? (
                        <>
                          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {connections.map((connection) => {
                              console.log('Connection data:', {
                                id: connection.id,
                                name: connection.name,
                                description: connection.description,
                                type: connection.type,
                                matchPercentage: connection.matchPercentage,
                              });
                              return (
                                <div
                                  key={connection.id}
                                  className='bg-[#1a1a1a] p-5 rounded-2xl flex items-start gap-4 h-full min-w-0'
                                >
                                  <div className='relative'>
                                    <div
                                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${getBackgroundColor(
                                        connection.name
                                      )}`}
                                    >
                                      {getInitials(connection.name)}
                                    </div>
                                  </div>
                                  <div className='flex-1 overflow-auto'>
                                    {/* Header: name + status badge + LinkedIn */}
                                    <div className='flex flex-wrap items-center justify-between gap-2 mb-1'>
                                      <div className='flex items-center gap-2 min-w-0'>
                                        <h3 className='text-white font-medium truncate'>
                                          {connection.name}
                                        </h3>
                                        {/* Status badge */}
                                        {(() => {
                                          const { label, colorClass } =
                                            getStatusInfo(connection.status);
                                          return (
                                            <span
                                              className={`text-xs font-medium px-2 py-0.5 rounded ${colorClass}`}
                                            >
                                              {label}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      {/* External links */}
                                      <div className='flex items-center gap-2 flex-shrink-0'>
                                        {/* Program website link */}
                                        {connection.type === 'program' && (
                                          <>
                                            {(connection.website_url ||
                                              (connection as any).url) && (
                                              <a
                                                href={
                                                  connection.website_url ||
                                                  (connection as any).url
                                                }
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='text-blue-500 font-medium text-sm underline'
                                              >
                                                Website
                                              </a>
                                            )}
                                          </>
                                        )}

                                        {/* LinkedIn link for person connections */}
                                        {connection.type === 'person' &&
                                          connection.linkedin_url && (
                                            <a
                                              href={connection.linkedin_url}
                                              target='_blank'
                                              rel='noopener noreferrer'
                                              className='text-blue-500 font-medium text-sm underline'
                                            >
                                              Connect
                                            </a>
                                          )}
                                      </div>
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
                                              <span>
                                                {connection.organization}
                                              </span>
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          {connection.current_role && (
                                            <span>
                                              {connection.current_role}
                                            </span>
                                          )}
                                          {connection.company && (
                                            <>
                                              {connection.current_role &&
                                                ' at '}
                                              <span>{connection.company}</span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </p>

                                    {/* Description - with debug comment */}
                                    {connection.description ? (
                                      <p className='text-gray-400 text-xs mt-2 mb-2 border-t border-gray-700 pt-2 break-words max-h-32 pr-1 overflow-y-auto'>
                                        {connection.description}
                                      </p>
                                    ) : (
                                      <p className='text-gray-500 text-xs mt-2 mb-2 border-t border-gray-700 pt-2'>
                                        {/* Debug info */}
                                        No description available for{' '}
                                        {connection.name}
                                      </p>
                                    )}

                                    {/* Status selector */}
                                    <div className='mt-2'>
                                      <select
                                        value={
                                          connection.status || 'not_contacted'
                                        }
                                        onChange={(e) =>
                                          handleStatusChange(
                                            connection.id,
                                            e.target
                                              .value as Connection['status']
                                          )
                                        }
                                        className='bg-[#2a2a2a] text-gray-300 text-xs px-2 py-1 rounded focus:outline-none'
                                      >
                                        <option value='not_contacted'>
                                          Not Contacted
                                        </option>
                                        <option value='email_sent'>
                                          Email/Message Sent / Waiting for
                                          Response
                                        </option>
                                        <option value='response_received'>
                                          Responded
                                        </option>
                                        <option value='internship_acquired'>
                                          Internship Acquired
                                        </option>
                                        <option value='ghosted'>
                                          No Response
                                        </option>
                                        <option value='rejected'>
                                          Rejected
                                        </option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className='pt-4 flex justify-center'>
                            <StatefulButton
                              disabled={findingMore}
                              onClick={() => fetchMoreConnections()}
                              className='w-full md:w-auto'
                            >
                              Find more connections
                            </StatefulButton>
                          </div>
                        </>
                      ) : (
                        <p className='text-gray-400 text-sm'>
                          Coming soon: AI-powered connection suggestions based
                          on your profile and goals.
                          <br />
                          <div className='flex justify-center mt-3'>
                            <StatefulButton
                              disabled={findingMore}
                              onClick={() => fetchMoreConnections()}
                              className='w-full md:w-auto'
                            >
                              Find more connections
                            </StatefulButton>
                          </div>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            

            {/* Resume Upload Section */}
            <div className='mt-3'>
              <div className='bg-[#1a1a1a] p-6 rounded-2xl'>
                <FileUpload
                  onChange={(files) => {
                    if (files && files.length) {
                      setFile(files[0]);
                      setUploadError('');
                    }
                  }}
                  title='Update Resume'
                  description='Update your resume to tailor your connection finding algorithm to your latest experience and skills'
                />
                {/* Upload button and feedback */}
                <div className='mt-4 flex flex-col items-center'>
                  {(uploading ||
                    steps.some((step) => step.status === 'completed')) && (
                    <MultiStepLoader
                      loadingStates={steps.map((s) => ({ text: s.label }))}
                      loading={uploading}
                    />
                  )}
                  <BorderMagicButton
                    onClick={handleResumeUpload}
                    disabled={uploading || !file}
                    className='mt-2'
                  >
                    {uploading ? 'Updating...' : 'Update Resume'}
                  </BorderMagicButton>
                  {uploadError && (
                    <div className='mt-2 text-red-500 text-sm'>{uploadError}</div>
                  )}
                  {uploadSuccess && (
                    <div className='mt-2 text-green-500 text-sm'>
                      Resume updated and analyzed successfully!
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
