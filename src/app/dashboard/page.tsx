'use client';

import { useState, useEffect, useMemo } from 'react';
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
import BorderMagicButton from '@/components/ui/BorderMagicButton';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgramConnectionCard } from '@/components/dashboard/ProgramConnectionCard';
import { PersonConnectionCard } from '@/components/dashboard/PersonConnectionCard';
import { getBackgroundColor } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionFilters } from '@/components/dashboard/ConnectionFilters';

interface Goal {
  title: string;
  description?: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState<string | Goal[]>('');
  const [selectedView, setSelectedView] = useState<
    'goal' | 'programs' | 'connections'
  >('goal');
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
  const [showArchive, setShowArchive] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'prepare', label: 'Preparing upload', status: 'pending' },
    { id: 'upload', label: 'Uploading file', status: 'pending' },
    { id: 'parse', label: 'Parsing resume content', status: 'pending' },
    { id: 'analyze', label: 'AI analysis', status: 'pending' },
    { id: 'store', label: 'Processing results', status: 'pending' },
  ]);

  // State for filters for main connections and archived connections
  const [filters, setFilters] = useState<{
    type: string;
    company: string;
    education: string;
    search: string;
  }>({
    type: '',
    company: '',
    education: '',
    search: '',
  });

  const [archiveFilters, setArchiveFilters] = useState<{
    type: string;
    company: string;
    education: string;
    search: string;
  }>({
    type: '',
    company: '',
    education: '',
    search: '',
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: any, isArchive: boolean) => {
    if (isArchive) {
      setArchiveFilters(newFilters);
    } else {
      setFilters(newFilters);
    }
  };

  // Apply filters to connections
  const filteredConnections = useMemo(() => {
    let result = [...connections];
    const activeFilters = showArchive ? archiveFilters : filters;

    // Apply status filter (archived/active)
    if (showArchive) {
      result = result.filter((c: Connection) => c.status === 'internship_acquired');
    } else {
      result = result.filter((c: Connection) => c.status !== 'internship_acquired');
    }

    // Apply search filter
    if (activeFilters.search) {
      const searchTerm = activeFilters.search.toLowerCase();
      result = result.filter(
        (c: Connection) =>
          c.name?.toLowerCase().includes(searchTerm) ||
          c.company?.toLowerCase().includes(searchTerm) ||
          c.current_role?.toLowerCase().includes(searchTerm) ||
          c.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply company filter
    if (activeFilters.company) {
      result = result.filter((c: Connection) => c.company === activeFilters.company);
    }

    // Apply type filter (academia/industry)
    if (activeFilters.type) {
      result = result.filter((c: Connection) => {
        const companyName = c.company?.toLowerCase() || '';
        if (activeFilters.type === 'academia') {
          return companyName.includes('university') || 
                 companyName.includes('college') ||
                 c.type === 'program';
        } else {
          return !companyName.includes('university') && 
                 !companyName.includes('college') &&
                 c.type !== 'program';
        }
      });
    }

    // Apply education level filter
    if (activeFilters.education) {
      result = result.filter((c: Connection) => {
        const role = c.current_role?.toLowerCase() || '';
        switch (activeFilters.education) {
          case 'undergraduate':
            return role.includes('undergrad') || role.includes('bachelor');
          case 'graduate':
            return role.includes('grad') || role.includes('master');
          case 'postgraduate':
            return role.includes('phd') || role.includes('postdoc') || role.includes('post-doc');
          default:
            return true;
        }
      });
    }

    return result;
  }, [connections, showArchive, filters, archiveFilters]);

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
  ): Promise<void> => {
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
  // Preferences state for what types of connections to search for using reusable component
  const [preferences, setPreferences] = useState(() => {
    if (typeof window === 'undefined')
      return { connections: true, programs: true };
    const stored = localStorage.getItem('connectionPreferences');
    return stored ? JSON.parse(stored) : { connections: true, programs: true };
  });

  // Persist prefs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'connectionPreferences',
        JSON.stringify(preferences)
      );
    }
  }, [preferences]);

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
          preferences: {
            programs: preferences.programs,
            connections: preferences.connections,
          },
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
                    { title: 'Programs', value: 'programs' },
                    {
                      title: 'Connections (For Cold Outreach)',
                      value: 'connections',
                    },
                  ]}
                  containerClassName=''
                  activeTabClassName='bg-accent/20'
                  onChange={(id) =>
                    setSelectedView(id as 'goal' | 'programs' | 'connections')
                  }
                />
              </div>

              {/* Content Sections */}
              {selectedView === 'goal' && (
                <div className='space-y-4'>
                  <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                    <h3 className='text-white font-medium mb-2'>
                      Current Goal (What do you want to do? Be as specific as
                      possible)
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

              {selectedView === 'programs' && (
                <div className='space-y-4'>
                  <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                    <ConnectionFilters 
                      connections={connections}
                      isArchive={showArchive}
                      onFilterChange={handleFilterChange}
                      initialFilters={showArchive ? archiveFilters : filters}
                    />
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {filteredConnections.filter((c: Connection) => c.type === 'program').length > 0 ? (
                        filteredConnections
                          .filter((c: Connection) => c.type === 'program')
                          .map((connection: Connection) => (
                            <ProgramConnectionCard
                              key={connection.id}
                              connection={connection}
                              onStatusChange={handleStatusChange}
                            />
                          ))
                      ) : (
                        <div className='col-span-full text-center py-10 text-gray-400'>
                          No programs match your current filters.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedView === 'connections' && (
                <div className='space-y-4'>
                  <div className='bg-[#2a2a2a] p-4 rounded-lg'>
                    <ConnectionFilters 
                      connections={connections}
                      isArchive={showArchive}
                      onFilterChange={handleFilterChange}
                      initialFilters={showArchive ? archiveFilters : filters}
                    />
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {filteredConnections.filter((c: Connection) => c.type === 'person').length > 0 ? (
                        filteredConnections
                          .filter((c: Connection) => c.type === 'person')
                          .map((connection: Connection) => (
                            <PersonConnectionCard
                              key={connection.id}
                              connection={connection}
                              onStatusChange={handleStatusChange}
                            />
                          ))
                      ) : (
                        <div className='col-span-full text-center py-10 text-gray-400'>
                          {showArchive ? 'No archived connections match your filters.' : 'No connections match your current filters.'}
                        </div>
                      )}
                    </div>
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
                    steps.some((step) => step.status === 'completed')) &&
                    (() => {
                      const inProgressIndex = steps.findIndex(
                        (step) => step.status === 'in_progress'
                      );
                      const progressIndex =
                        inProgressIndex !== -1
                          ? inProgressIndex
                          : Math.max(
                              0,
                              steps.filter((s) => s.status === 'completed')
                                .length - 1
                            );
                      return (
                        <MultiStepLoader
                          loadingStates={steps.map((s) => ({ text: s.label }))}
                          loading={uploading}
                          progressIndex={progressIndex}
                          loop={false}
                        />
                      );
                    })()}
                  <BorderMagicButton
                    onClick={handleResumeUpload}
                    disabled={uploading || !file}
                    className='mt-2'
                  >
                    {uploading ? 'Updating...' : 'Update Resume'}
                  </BorderMagicButton>
                  {uploadError && (
                    <div className='mt-2 text-red-500 text-sm'>
                      {uploadError}
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className='mt-2 text-green-500 text-sm'>
                      Resume updated and analyzed successfully!
                    </div>
                  )}
                </div>
              </div>

              {/* Archive side panel */}
              <div className='w-64 lg:w-72 bg-[#1a1a1a] p-4 rounded-2xl h-fit mt-4'>
                <h3 className='text-white font-medium mb-2'>Archive</h3>
                {connections.filter((c: Connection) => c.status === 'internship_acquired').length > 0 ? (
                  <ul className='space-y-2 max-h-64 overflow-y-auto'>
                    {connections
                      .filter((c: Connection) => c.status === 'internship_acquired')
                      .map((connection: Connection) => (
                        <li
                          key={connection.id}
                          className='text-gray-300 text-sm truncate'
                        >
                          {connection.name}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className='text-gray-400 text-sm'>
                    No archived connections.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className='space-y-4'>
            {/* Outreach strategy side panel */}
            <div className='w-64 lg:w-72 bg-[#1a1a1a] p-4 rounded-2xl h-fit'>
              <h3 className='text-white font-medium mb-2'>Outreach strategy</h3>
              <p className='text-gray-400 text-sm mb-2'>
                In the messages (emails, LinkedIn messages, etc) you send to
                these people, use the following strategy:
              </p>
              <ol className='list-decimal list-inside space-y-1 text-gray-400 text-sm'>
                <li>Introduce yourself with your and explain your goals</li>
                <li>
                  Connect with the other person based on how their work
                  resonates with / links to yours (shared background)
                </li>
                <li>Share your request for an internship</li>
              </ol>
            </div>

            {/* Archive side panel */}
            <div className='w-64 lg:w-72 bg-[#1a1a1a] p-4 rounded-2xl h-fit'>
              <div className='flex justify-between items-center mb-2'>
                <h3 className='text-white font-medium'>Archive</h3>
                <button
                  onClick={() => setShowArchive(!showArchive)}
                  className='text-gray-400 hover:text-white text-sm focus:outline-none'
                >
                  {showArchive
                    ? 'Hide'
                    : `Show (${connections.filter((c: Connection) => c.status === 'internship_acquired').length})`}
                </button>
              </div>

              {showArchive && (
                <div className='mt-2'>
                  {connections.filter((c: Connection) => c.status === 'internship_acquired').length > 0 ? (
                    <div className='grid grid-cols-1 gap-4 max-h-96 overflow-y-auto pr-2'>
                      {connections
                        .filter((c: Connection) => c.status === 'internship_acquired')
                        .map((connection: Connection) => (
                        <div
                          key={connection.id}
                          className='bg-[#2a2a2a] p-4 rounded-xl flex items-start gap-3 h-full min-w-0'
                        >
                          <div className='relative'>
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getBackgroundColor(
                                connection.name
                              )}`}
                            >
                              {getInitials(connection.name)}
                            </div>
                          </div>
                          <div className='flex-1 overflow-auto'>
                            <div className='flex flex-wrap items-center justify-between gap-2 mb-1'>
                              <h4 className='text-white font-medium text-sm truncate'>
                                {connection.name}
                              </h4>
                            </div>
                            <p className='text-gray-400 text-xs'>
                              {connection.current_role}
                              {connection.company &&
                                ` at ${connection.company}`}
                            </p>
                            {connection.description && (
                              <p className='text-gray-500 text-xs mt-1 line-clamp-2'>
                                {connection.description}
                              </p>
                            )}
                            <div className='mt-2 flex justify-end'>
                              <select
                                value={
                                  connection.status || 'internship_acquired'
                                }
                                onChange={(e) =>
                                  handleStatusChange(
                                    connection.id,
                                    e.target.value as Connection['status']
                                  )
                                }
                                className='bg-[#3a3a3a] text-gray-200 text-xs px-2 py-1 rounded-md focus:outline-none border border-gray-600'
                              >
                                <option value='internship_acquired'>
                                  Archived
                                </option>
                                <option value='not_contacted'>
                                  Not Contacted
                                </option>
                                <option value='email_sent'>
                                  Email/Message Sent
                                </option>
                                <option value='response_received'>
                                  Responded
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-400 text-sm'>
                      No archived connections.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
