'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import { MultiStepLoader } from '@/components/ui/MultiStepLoader';
import {
  getUser,
  getResume,
  updateUserConnections,
} from '@/lib/firestoreHelpers';
import { Connection } from '@/lib/firestoreHelpers';
import BorderMagicButton from '@/components/ui/BorderMagicButton';
import { fetchUserData } from '@/lib/frontendUtils';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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

function generateMatchExplanation(connection: Connection): React.ReactNode {
  const sharedBackgroundPoints: string[] =
    connection.shared_background_points || [];

  const sanitize = (text: string | undefined): string =>
    text ? text.replace(/<cite[^>]*>|<\/cite>/g, '') : '';

  if (connection.type === 'program') {
    // Build explanation for program
    return (
      <div className='space-y-2'>
        {connection.program_description && (
          <p className='text-gray-300'>
            {sanitize(connection.program_description)}
          </p>
        )}
        <div className='space-y-1'>
          <p className='text-blue-400 font-medium'>
            Why this program is a fit:
          </p>
          <ul className='list-disc list-inside space-y-1 text-gray-400 text-sm'>
            {connection.how_this_helps && (
              <li>{sanitize(connection.how_this_helps)}</li>
            )}
          </ul>
          {/* Removed inline program website line to avoid redundancy */}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <p className='text-gray-300 font-medium'>
        {connection.current_role &&
          `${sanitize(connection.name)} is a ${sanitize(
            connection.current_role ?? undefined
          )} at ${sanitize(connection.company ?? undefined)}`}
        {connection.hiring_power &&
          ` with ${
            connection.hiring_power.role_type === 'manager'
              ? 'management'
              : 'hiring'
          } responsibilities in ${sanitize(
            connection.hiring_power.department ?? undefined
          )}`}
      </p>
      <div className='space-y-1'>
        <p className='text-blue-400 font-medium'>
          We think this person is a great match because:
        </p>
        <ul className='list-disc list-inside space-y-1 text-gray-400 text-sm'>
          {sharedBackgroundPoints.map((point, index) => (
            <li key={`bp-${index}`}>{sanitize(point)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export default function TopConnections() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'load', label: 'Loading profile data', status: 'pending' },
    { id: 'analyze', label: 'Analyzing profile', status: 'pending' },
    { id: 'find', label: 'Finding connections', status: 'pending' },
    { id: 'score', label: 'Scoring matches', status: 'pending' },
    { id: 'prepare', label: 'Preparing recommendations', status: 'pending' },
  ]);
  const [connectionSteps, setConnectionSteps] = useState<string[]>([]);
  const [currentConnectionStepIndex, setCurrentConnectionStepIndex] = useState(-1);

  useEffect(() => {
    const eventSource = new EventSource('/api/events/connections');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'step-init') {
          setConnectionSteps(data.steps);
          setCurrentConnectionStepIndex(0);
        } else if (data.type === 'step-update') {
          setCurrentConnectionStepIndex(data.stepIndex);
        } else if (data.action === 'add') {
          setConnections((prev) => {
            if (prev.some((c) => c.id === data.connection.id)) return prev;
            return [data.connection, ...prev];
          });
        } else if (data.action === 'remove') {
          setConnections((prev) =>
            prev.filter((c) => c.id !== data.connection.id)
          );
        }
      } catch (error) {
        console.error('Error parsing connection event:', error);
      }
    };

    return () => eventSource.close();
  }, []);

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  useEffect(() => {
    if (currentConnectionStepIndex >= 0 && currentConnectionStepIndex === connectionSteps.length - 1) {
      fetchUserDataLocal();
    }
  }, [currentConnectionStepIndex, connectionSteps]);

  const fetchUserDataLocal = async () => {
    setLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const { connections } = await fetchUserData(currentUser);
      setConnections(connections);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedPrefs =
      typeof window !== 'undefined'
        ? localStorage.getItem('connectionPreferences')
        : null;
    const parsedPrefs: { programs: boolean; connections: boolean } = storedPrefs
      ? JSON.parse(storedPrefs)
      : { programs: true, connections: true };
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }

    const runConnectionSearch = async () => {
      try {
        // Load user + resume data
        updateStep('load', 'in_progress');
        setCurrentStatus('Loading your profile data...');

        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const userData: any = await getUser(user.uid);
        const resumeData: any = await getResume(user.uid);

        updateStep('load', 'completed');
        await new Promise((r) => setTimeout(r, 600));

        // 3. Analyze step (visual only)
        updateStep('analyze', 'in_progress');
        setCurrentStatus('Analyzing your resume and goals...');
        await new Promise((r) => setTimeout(r, 900));
        updateStep('analyze', 'completed');

        // 4. Find connections
        updateStep('find', 'in_progress');
        setCurrentStatus('Searching for potential connections...');

        // Ensure goals are always passed as an array of objects with a `title` key
        const goalsPayload = Array.isArray(userData.goals)
          ? userData.goals.map((g: any) =>
              typeof g === 'string' ? { title: g } : g
            )
          : userData.goals
          ? [{ title: userData.goals }]
          : [];

        const response = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roles: userData.roles || [],
            goals: goalsPayload,
            resumeContext: resumeData?.text || '',
            race: userData.race || '',
            location: userData.location || '',
            preferences: parsedPrefs,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to find connections');
        }

        const data = await response.json();

        updateStep('find', 'completed');
        await new Promise((r) => setTimeout(r, 800));

        // 5. Scoring step (visual)
        updateStep('score', 'in_progress');
        setCurrentStatus(
          `${data.response.connections.length} connections found! Scoring and ranking matches...`
        );
        await new Promise((r) => setTimeout(r, 800));
        updateStep('score', 'completed');

        // 6. Prepare final recommendations
        updateStep('prepare', 'in_progress');
        setCurrentStatus('Preparing your outreach strategies...');
        await new Promise((r) => setTimeout(r, 700));
        updateStep('prepare', 'completed');
        setCurrentStatus('Your connections are ready!');

        setConnections(data.response.connections);

        // Persist connections to Firestore only
        await updateUserConnections(user.uid, data.response.connections);
      } catch (err: any) {
        console.error('Error during connection search:', err);
        setError(err.message || 'Failed to find connections');
      } finally {
        setLoading(false);
      }
    };

    runConnectionSearch();
  }, [router]);

  // Helper to decide if we're mid-process
  const inProgress =
    loading || steps.some((step) => step.status === 'in_progress');

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      {/* <BackgroundGradient className='rounded-3xl w-full max-w-7xl'> */}
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          {inProgress
            ? `Finding Your Top Connections${
                connections.length > 0 ? ` (${connections.length} found)` : ''
              }`
            : `Your Top Connections (${connections.length})`}
        </h1>
        <p className='text-gray-400 text-sm text-center mb-8'>
          {inProgress
            ? 'Please wait while we analyze your profile and identify the best matches for you'
            : 'Based on your goals and resume'}
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        {(loading || steps.some((step) => step.status === 'completed')) &&
          (() => {
            const inProgressIndex = steps.findIndex(
              (step) => step.status === 'in_progress'
            );
            const progressIndex =
              inProgressIndex !== -1
                ? inProgressIndex
                : Math.max(
                    0,
                    steps.filter((s) => s.status === 'completed').length - 1
                  );
            return (
              <MultiStepLoader
                loadingStates={steps.map((s) => ({ text: s.label }))}
                loading={loading}
                progressIndex={progressIndex}
                loop={false}
              />
            );
          })()}

        {!inProgress && connections.length === 0 && (
          <div className='text-center'>
            <p className='text-gray-400 mb-6'>
              We couldn't find any relevant connections. Please try updating
              your goals and resume.
            </p>
            <button
              onClick={() => router.push('/upload-resume')}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
            >
              Update Goals
            </button>
          </div>
        )}

        {!inProgress && connections.length > 0 && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-[#2a2a2a] p-6 rounded-lg flex items-start gap-4 h-full"
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
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='min-w-0'>
                      <h3 className='text-white font-medium text-lg truncate'>
                        {connection.name}
                        {connection.type === 'program' && (
                          <span className='ml-2 px-2 py-0.5 rounded bg-indigo-600 text-xs text-white'>
                            PROGRAM
                          </span>
                        )}
                      </h3>
                      {connection.type === 'person' &&
                        connection.current_role && (
                          <p className='text-gray-400 truncate'>
                            {connection.current_role} at {connection.company}
                          </p>
                        )}
                      {connection.type === 'program' &&
                        connection.organization && (
                          <p className='text-gray-400 truncate'>
                            {connection.organization}
                          </p>
                        )}
                    </div>
                    {/* External links for this connection */}
                    <div className='flex items-center flex-shrink-0 ml-2 space-x-2'>
                      {/* Show program website link */}
                      {connection.type === 'program' &&
                        connection.website_url && (
                          <a
                            href={connection.website_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-500 font-medium text-sm underline'
                          >
                            Website
                          </a>
                        )}

                      {/* Show contact link for person connections */}
                      {connection.type === 'person' &&
                        (connection.email ||
                          connection.verified_profile_url) && (
                          <a
                            href={
                              connection.email
                                ? `mailto:${connection.email}`
                                : connection.verified_profile_url
                            }
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-500 font-medium text-sm underline'
                          >
                            Connect
                          </a>
                        )}
                    </div>
                  </div>
                  {generateMatchExplanation(connection)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Go to Dashboard button now at bottom */}
        {!inProgress && (
          <div className='flex justify-center mt-8'>
            <BorderMagicButton onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </BorderMagicButton>
          </div>
        )}
      </div>
      {/* </BackgroundGradient> */}
    </div>
  );
}
