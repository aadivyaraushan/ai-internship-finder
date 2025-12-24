'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

import { auth, db } from '@/lib/firebase';
import {
  addUserConnection,
  Connection,
  createOrUpdateResume,
  createOrUpdateUser,
  getResume,
  getUser,
  updateConnectionStatus,
} from '@/lib/firestoreHelpers';
import { fetchUserData } from '@/lib/frontendUtils';
import { analytics } from '@/lib/analytics';

import { AdBlockerWarning } from '@/components/ui/AdBlockerWarning';
import { CloudyBackground } from '@/components/ui/CloudyBackground';
import { MultiStepLoader } from '@/components/ui/MultiStepLoader';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';

import { PersonConnectionCard } from '@/components/dashboard/PersonConnectionCard';
import { ProgramConnectionCard } from '@/components/dashboard/ProgramConnectionCard';

import DashboardHeader from './DashboardHeader';
import { PendingConnectionsModal } from './PendingConnectionsModal';
import { PersonalizationModal } from './PersonalizationModal';
import { ResumeUploadModal } from './ResumeUploadModal';
import { ResumeRequiredBanner } from './ResumeRequiredBanner';
import { UpdateResumeButton } from './UpdateResumeButton';

import type {
  ConnectionPreferences,
  Goal,
  PersonalizationSettings,
} from './types';

import {
  buildConnectionsRequestBody,
  goalTextFrom,
  isPendingConnection,
  parseConnectionPreferences,
  parseSseChunk,
  serializeConnectionPreferences,
  upsertConnectionById,
  type ResumeDocForSearch,
  type UserDocForSearch,
} from './dashboardClientHelpers';

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Goal/search UI
  const [goals, setGoals] = useState<string | Goal[]>('');
  const [searchGoal, setSearchGoal] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchBarCentered, setSearchBarCentered] = useState(true);

  // Connections
  const [connections, setConnections] = useState<Connection[]>([]);
  const [findingMore, setFindingMore] = useState(false);
  const [currentConnectionStepIndex, setCurrentConnectionStepIndex] =
    useState(0);

  // Preferences
  const [preferences, setPreferences] = useState<ConnectionPreferences>({
    connections: true,
    programs: true,
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Personalization
  const [personalizationModalOpen, setPersonalizationModalOpen] =
    useState(false);
  const [personalizationSettings, setPersonalizationSettings] =
    useState<PersonalizationSettings>({
      enabled: false,
      professionalInterests: '',
      personalInterests: '',
    });

  // Pending connections modal
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingModalView, setPendingModalView] = useState<
    'people' | 'programs'
  >('people');
  const [allPendingConnections, setAllPendingConnections] = useState<
    Connection[]
  >([]);
  const [pendingConnectionsLoaded, setPendingConnectionsLoaded] =
    useState(false);

  // Resume upload modal
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeError, setResumeError] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadingStepIndex, setUploadingStepIndex] = useState(0);

  // Cache for connection-finding speed
  const [cachedUserData, setCachedUserData] = useState<UserDocForSearch | null>(
    null
  );
  const [cachedResumeData, setCachedResumeData] =
    useState<ResumeDocForSearch | null>(null);

  const allPendingPeople = useMemo(
    () => allPendingConnections.filter((c) => c.type === 'person'),
    [allPendingConnections]
  );
  const allPendingPrograms = useMemo(
    () => allPendingConnections.filter((c) => c.type === 'program'),
    [allPendingConnections]
  );

  // Only show non-archived connections in main grid (archive is tracked via status)
  const activeConnections = useMemo(
    () => connections.filter((c) => c.status !== 'internship_acquired'),
    [connections]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'Dashboard | Refr';
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) setTimeout(() => router.push('/signup'), 100);
    });
    return () => unsubscribe();
  }, [router]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('connectionPreferences');
    const parsed = parseConnectionPreferences(stored);
    if (parsed) setPreferences(parsed);
    setPreferencesLoaded(true);
  }, []);

  // Persist preferences after load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!preferencesLoaded) return;
    localStorage.setItem(
      'connectionPreferences',
      serializeConnectionPreferences(preferences)
    );
  }, [preferences, preferencesLoaded]);

  const fetchUserDataLocal = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const {
        goals: fetchedGoals,
        connections: fetchedConnections,
        personalizationSettings: fetchedPersonalizationSettings,
      } = await fetchUserData(currentUser);

      // cache for faster search
      const freshUserData = (await getUser(
        currentUser.uid
      )) as UserDocForSearch | null;
      const resumeData = (await getResume(
        currentUser.uid
      )) as ResumeDocForSearch | null;
      setCachedUserData(freshUserData);
      setCachedResumeData(resumeData);

      setGoals(fetchedGoals);
      setConnections(fetchedConnections);
      setPersonalizationSettings(fetchedPersonalizationSettings);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPendingConnections = async () => {
    if (!currentUser) return;
    try {
      const { connections: allConnections } = await fetchUserData(currentUser);
      const pending = allConnections.filter(
        (c: Connection) => c.status === 'not_contacted' || !c.status
      );
      setAllPendingConnections(pending);
      setPendingConnectionsLoaded(true);
    } catch (error) {
      console.error('Error fetching all pending connections:', error);
      setPendingConnectionsLoaded(true);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      fetchUserDataLocal().catch(console.error);
      fetchAllPendingConnections().catch(console.error);
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleSignOut = async () => {
    try {
      analytics.trackLogout();
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleStatusChange = async (
    connectionId: string,
    newStatus: Connection['status']
  ) => {
    if (!currentUser) return;
    const connection = connections.find((c) => c.id === connectionId);
    const oldStatus = connection?.status || 'not_contacted';
    const connectionType = (connection?.type || 'person') as
      | 'person'
      | 'program';

    try {
      analytics.trackConnectionStatusChange(
        oldStatus,
        newStatus || 'not_contacted',
        connectionType
      );
      if (newStatus === 'internship_acquired')
        analytics.trackSuccessfulInternshipAcquisition();
      if (
        oldStatus === 'not_contacted' &&
        (newStatus === 'email_sent' || newStatus === 'response_received')
      ) {
        analytics.trackFirstConnectionContacted();
      }

      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, status: newStatus } : c
        )
      );
      setAllPendingConnections((prev) =>
        prev
          .map((c) => (c.id === connectionId ? { ...c, status: newStatus } : c))
          .filter((c) => c.status === 'not_contacted' || !c.status)
      );

      await updateConnectionStatus(
        currentUser.uid,
        connectionId,
        (newStatus ?? 'not_contacted') as Connection['status']
      );
    } catch (error) {
      console.error('Failed to update connection status:', error);
      // best-effort refresh
      fetchUserDataLocal().catch(() => undefined);
      fetchAllPendingConnections().catch(() => undefined);
    }
  };

  const fetchMoreConnections = useCallback(
    async (goalOverride?: string) => {
      if (!currentUser) return;
      setFindingMore(true);
      setResumeError('');

      const searchStartTime = Date.now();
      const goalText = goalTextFrom(goals, goalOverride);
      analytics.trackConnectionSearch(goalText, preferences);

      try {
        let freshUserData = cachedUserData;
        let resumeData = cachedResumeData;

        if (!freshUserData || !resumeData) {
          freshUserData = (await getUser(
            currentUser.uid
          )) as UserDocForSearch | null;
          resumeData = (await getResume(
            currentUser.uid
          )) as ResumeDocForSearch | null;
          setCachedUserData(freshUserData);
          setCachedResumeData(resumeData);
        }

        if (!freshUserData)
          throw new Error(
            'Unable to load your profile. Please refresh and try again.'
          );

        if (!resumeData) {
          setResumeError(
            'Please upload your resume first to find relevant connections.'
          );
          return;
        }

        if (
          !freshUserData?.resumeAspects ||
          Object.keys(freshUserData.resumeAspects).length === 0
        ) {
          setResumeError(
            'Your resume needs to be analyzed before we can find connections. Please upload or re-upload your resume to analyze it properly.'
          );
          return;
        }

        const response = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildConnectionsRequestBody({
              goalTitle: goalText,
              preferences,
              userId: currentUser.uid,
              userDoc: freshUserData,
              resumeDoc: resumeData,
              personalizationSettings,
            })
          ),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              'We had trouble finding connections. Please try again in a few moments.'
          );
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const streamedConnections: Connection[] = [];

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          for (const msg of parseSseChunk(chunk)) {
            switch (msg.type) {
              case 'step-update':
                setCurrentConnectionStepIndex((msg as { step: number }).step);
                break;
              case 'connection-found': {
                const connection = (msg as { connection: Connection })
                  .connection;
                analytics.trackConnectionFound(
                  connection?.type || 'person',
                  streamedConnections.length + 1
                );
                streamedConnections.push(connection);

                // persist immediately
                addUserConnection(currentUser.uid, connection).catch((err) =>
                  console.error('Failed to save connection immediately:', err)
                );

                setConnections((prev) =>
                  upsertConnectionById(prev, connection)
                );

                if (isPendingConnection(connection)) {
                  setAllPendingConnections((prev) =>
                    upsertConnectionById(prev, connection)
                  );
                }
                break;
              }
              case 'complete': {
                const searchDuration = Date.now() - searchStartTime;
                analytics.trackConnectionFindingTime(searchDuration);
                break;
              }
              case 'error':
                throw new Error(
                  (msg as { message?: string }).message || 'Stream error'
                );
              default:
                break;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error);
      } finally {
        setFindingMore(false);
        setCurrentConnectionStepIndex(0);
      }
    },
    [
      cachedResumeData,
      cachedUserData,
      currentUser,
      goals,
      personalizationSettings,
      preferences,
    ]
  );

  // Auto-start connection search (e.g. from upload page)
  useEffect(() => {
    const autoStart = searchParams.get('autoStart');
    const goalFromUrl = searchParams.get('goal');

    if (
      autoStart === 'true' &&
      goalFromUrl &&
      currentUser &&
      !findingMore &&
      !searchMode
    ) {
      setSearchGoal(goalFromUrl);
      const timeoutId = setTimeout(async () => {
        setResumeError('');
        setSearchMode(true);
        setSearchBarCentered(false);
        setConnections([]);
        setGoals(goalFromUrl);
        await setDoc(
          doc(db, 'users', currentUser.uid),
          { goals: goalFromUrl },
          { merge: true }
        );
        await fetchMoreConnections(goalFromUrl);
      }, 1000);

      router.replace('/dashboard');
      return () => clearTimeout(timeoutId);
    }
  }, [
    currentUser,
    fetchMoreConnections,
    findingMore,
    router,
    searchMode,
    searchParams,
  ]);

  const handleSearch = async () => {
    if (!searchGoal.trim() || !currentUser) return;

    setResumeError('');
    setSearchMode(true);
    setSearchBarCentered(false);
    setConnections([]);
    setGoals(searchGoal);

    await setDoc(
      doc(db, 'users', currentUser.uid),
      { goals: searchGoal },
      { merge: true }
    );
    await fetchMoreConnections(searchGoal);
  };

  const resetToHome = () => {
    setSearchMode(false);
    setSearchBarCentered(true);
    setSearchGoal('');
    setConnections([]);
    setResumeError('');
  };

  const savePersonalization = async () => {
    if (!currentUser) return;
    try {
      if (personalizationSettings.enabled)
        analytics.trackPersonalizationEnabled();
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { personalizationSettings: personalizationSettings },
        { merge: true }
      );
      analytics.trackPersonalizationSaved();
      setPersonalizationModalOpen(false);
    } catch (error) {
      console.error('Error saving personalization settings:', error);
    }
  };

  const refreshUserAfterResumeUpload = async () => {
    if (!currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setCachedUserData(null);
        setCachedResumeData(null);
        if (data?.personalizationSettings)
          setPersonalizationSettings(data.personalizationSettings);
      }
    } catch {
      // ignore
    }
  };

  const handleResumeUpload = async () => {
    if (!file) {
      setUploadError('Please select a resume file to upload.');
      return;
    }
    if (!currentUser) {
      setUploadError('You must be signed in to upload a resume.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    setUploadingStepIndex(0);

    try {
      setUploadingStepIndex(0);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUser.uid);

      setUploadingStepIndex(1);
      const response = await fetch('/api/resume-analysis', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to analyze resume');
      }

      const result = await response.clone().json();
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          resumeStructuredData: result.response.structuredData,
          resumeAspects: result.response.resumeAspects,
        },
        { merge: true }
      );

      setUploadingStepIndex(2);
      const data = await response.json();

      setUploadingStepIndex(3);
      await createOrUpdateResume(currentUser.uid, {
        text: data.response.rawText,
        structuredData: data.response.structuredData,
        userId: currentUser.uid,
        uploadedAt: new Date().toISOString(),
      });
      await createOrUpdateUser(currentUser.uid, { hasResume: true });
      setUploadingStepIndex(4);

      analytics.trackResumeUpload(true);
      analytics.trackResumeAnalysis(true);

      setUploadSuccess(true);
      setResumeError('');
      setFile(null);
      await refreshUserAfterResumeUpload();
      await fetchUserDataLocal();
    } catch (err) {
      analytics.trackResumeUpload(false);
      analytics.trackError(
        'resume_upload',
        err instanceof Error ? err.message : 'Unknown error'
      );
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload resume'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <AdBlockerWarning />

      {uploading && (
        <MultiStepLoader
          loadingStates={[
            { text: 'Preparing upload' },
            { text: 'Uploading file' },
            { text: 'Parsing resume content' },
            { text: 'AI analysis' },
            { text: 'Processing results' },
          ]}
          loading={uploading}
          progressIndex={uploadingStepIndex}
          duration={2000}
          loop={false}
        />
      )}

      <div className='min-h-screen bg-[#0a0a0a] p-4 relative'>
        <StarsBackground />
        <CloudyBackground />
        <ShootingStars />

        <div className='relative z-10'>
          <DashboardHeader
            pendingCount={
              pendingConnectionsLoaded
                ? allPendingPeople.length + allPendingPrograms.length
                : undefined
            }
            pendingLoaded={pendingConnectionsLoaded}
            onReset={resetToHome}
            onOpenPending={() => {
              analytics.trackModalOpened('pending_connections');
              setPendingModalOpen(true);
            }}
            onOpenPersonalization={() => {
              analytics.trackModalOpened('personalization');
              setPersonalizationModalOpen(true);
            }}
            onSignOut={handleSignOut}
          />

          {loading && (
            <div className='text-gray-400 text-center mb-4'>
              Loading your profile...
            </div>
          )}

          <div
            className={`transition-all duration-500 ${
              searchBarCentered
                ? 'flex items-center justify-center min-h-[50vh]'
                : 'mb-8'
            }`}
          >
            <div
              className={`w-full ${
                searchBarCentered ? 'max-w-2xl text-center' : ''
              }`}
            >
              {searchBarCentered && (
                <h2 className='text-white text-3xl font-bold mb-8'>
                  What&apos;s your goal?
                </h2>
              )}

              <div className='relative'>
                <textarea
                  value={searchGoal}
                  onChange={(e) => setSearchGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch().catch(() => undefined);
                    }
                  }}
                  placeholder='Enter your career goal to find relevant connections...'
                  rows={1}
                  className='w-full px-6 py-4 pr-16 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg resize-none overflow-hidden min-h-[56px]'
                  style={{ height: 'auto', minHeight: '56px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height =
                      Math.max(56, target.scrollHeight) + 'px';
                  }}
                />
                <button
                  onClick={() => handleSearch().catch(() => undefined)}
                  disabled={!searchGoal.trim() || findingMore}
                  className='absolute right-2 top-1/2 transform -translate-y-1/2 -translate-x-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                  aria-label='Search'
                >
                  Search
                </button>
              </div>

              {preferencesLoaded && (
                <div className='flex justify-center gap-6 mt-4'>
                  <label className='flex items-center gap-2 text-gray-300 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={preferences.connections}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          connections: e.target.checked,
                        }))
                      }
                      className='w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-blue-600 focus:ring-blue-500 focus:ring-2'
                    />
                    People
                  </label>
                  <label className='flex items-center gap-2 text-gray-300 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={preferences.programs}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          programs: e.target.checked,
                        }))
                      }
                      className='w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-blue-600 focus:ring-blue-500 focus:ring-2'
                    />
                    Programs
                  </label>
                </div>
              )}
            </div>
          </div>

          {resumeError && (
            <ResumeRequiredBanner
              message={resumeError}
              onUploadClick={() => setResumeModalOpen(true)}
            />
          )}

          {searchMode && !searchBarCentered && !resumeError && (
            <div className={`${findingMore ? 'flex gap-8' : ''}`}>
              <div
                className={`${
                  findingMore ? 'flex-1' : ''
                } grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`}
              >
                {activeConnections.map((connection) =>
                  connection.type === 'person' ? (
                    <PersonConnectionCard
                      key={connection.id}
                      connection={connection}
                      onStatusChange={handleStatusChange}
                    />
                  ) : (
                    <ProgramConnectionCard
                      key={connection.id}
                      connection={connection}
                      onStatusChange={handleStatusChange}
                    />
                  )
                )}
              </div>

              {findingMore && (
                <div className='w-80 flex-shrink-0'>
                  <div className='sticky top-8 bg-[#1a1a1a] rounded-lg p-6 border border-gray-700'>
                    <h3 className='text-white text-lg font-semibold mb-4'>
                      Finding Connections
                    </h3>
                    <MultiStepLoader
                      loadingStates={[
                        { text: 'Analyzing your background' },
                        { text: 'Finding 1st connection' },
                        { text: 'Finding 2nd connection' },
                        { text: 'Finding 3rd connection' },
                        { text: 'Finding 4th connection' },
                        { text: 'Finding 5th connection' },
                        { text: 'Processing results' },
                      ]}
                      loading={findingMore}
                      progressIndex={currentConnectionStepIndex}
                      loop={false}
                      inline={true}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <UpdateResumeButton onClick={() => setResumeModalOpen(true)} />

          <ResumeUploadModal
            open={resumeModalOpen}
            file={file}
            uploading={uploading}
            uploadError={uploadError}
            uploadSuccess={uploadSuccess}
            onClose={() => {
              setResumeModalOpen(false);
              setFile(null);
              setUploadError('');
              setUploadSuccess(false);
              setResumeError('');
            }}
            onFileChange={(f) => {
              setFile(f);
              setUploadError('');
            }}
            onUpload={() => handleResumeUpload().catch(() => undefined)}
          />

          <PendingConnectionsModal
            open={pendingModalOpen}
            view={pendingModalView}
            pendingPeople={allPendingPeople}
            pendingPrograms={allPendingPrograms}
            onClose={() => setPendingModalOpen(false)}
            onViewChange={setPendingModalView}
            onStatusChange={handleStatusChange}
          />

          <PersonalizationModal
            open={personalizationModalOpen}
            settings={personalizationSettings}
            onClose={() => setPersonalizationModalOpen(false)}
            onChange={setPersonalizationSettings}
            onSave={() => savePersonalization().catch(() => undefined)}
          />
        </div>
      </div>
    </>
  );
}
