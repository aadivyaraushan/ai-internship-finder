'use client';

import React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  updateConnectionStatus,
  getUser,
  getResume,
  createOrUpdateResume,
  createOrUpdateUser,
} from '@/lib/firestoreHelpers';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
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
import { ArchiveConnectionFilters } from '@/components/dashboard/ArchiveConnectionFilters';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchUserData } from '@/lib/frontendUtils';
import { Search, Sparkles, Upload, Clock } from 'lucide-react';

interface Goal {
  title: string;
  description?: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface PersonalizationSettings {
  enabled: boolean;
  professionalInterests: string;
  personalInterests: string;
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
  const [currentConnectionStepIndex, setCurrentConnectionStepIndex] =
    useState(0);
  const [uploadingStepIndex, setUploadingStepIndex] = useState(0);

  // New state for redesigned dashboard
  const [searchMode, setSearchMode] = useState(false);
  const [searchGoal, setSearchGoal] = useState('');
  const [searchBarCentered, setSearchBarCentered] = useState(true);
  const [personalizationModal, setPersonalizationModal] = useState(false);
  const [personalizationSettings, setPersonalizationSettings] =
    useState<PersonalizationSettings>({
      enabled: false,
      professionalInterests: '',
      personalInterests: '',
    });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingModalView, setPendingModalView] = useState<
    'people' | 'programs'
  >('people');
  const [allPendingConnections, setAllPendingConnections] = useState<
    Connection[]
  >([]);
  const [resumeError, setResumeError] = useState<string>('');

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

  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: any, isArchive: boolean) => {
    if (isArchive) {
      setArchiveFilters(newFilters);
    } else {
      setFilters(newFilters);
    }
  };

  // ===== Filtered connection lists =====
  const activeFilteredConnections = useMemo(() => {
    let result = [...connections];
    const activeFilters = filters;

    // Always exclude archived connections from active list
    result = result.filter(
      (c: Connection) => c.status !== 'internship_acquired'
    );

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
      result = result.filter(
        (c: Connection) => c.company === activeFilters.company
      );
    }

    // Apply type filter (academia/industry)
    if (activeFilters.type) {
      result = result.filter((c: Connection) => {
        const companyName = c.company?.toLowerCase() || '';
        if (activeFilters.type === 'academia') {
          return (
            companyName.includes('university') ||
            companyName.includes('college') ||
            c.type === 'program'
          );
        } else {
          return (
            !companyName.includes('university') &&
            !companyName.includes('college') &&
            c.type !== 'program'
          );
        }
      });
    }

    // Apply education level filter
    if (activeFilters.education) {
      result = result.filter((c: Connection) => {
        const eduLevel = (c.education_level ?? '').toLowerCase();
        const role = c.current_role?.toLowerCase() || '';
        switch (activeFilters.education) {
          case 'undergraduate':
            return (
              eduLevel === 'undergraduate' ||
              role.includes('undergrad') ||
              role.includes('bachelor')
            );
          case 'graduate':
            return (
              eduLevel === 'graduate' ||
              role.includes('grad') ||
              role.includes('master')
            );
          case 'postgraduate':
            return (
              eduLevel === 'postgraduate' ||
              role.includes('phd') ||
              role.includes('postdoc') ||
              role.includes('post-doc') ||
              role.includes('postgraduate')
            );
          default:
            return true;
        }
      });
    }

    return result;
  }, [connections, filters]);

  const archivedFilteredConnections = useMemo(() => {
    let result: Connection[] = connections.filter(
      (c: Connection) => c.status === 'internship_acquired'
    );
    const activeFilters = archiveFilters;

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
      result = result.filter(
        (c: Connection) => c.company === activeFilters.company
      );
    }

    // Apply type filter (academia/industry)
    if (activeFilters.type) {
      result = result.filter((c: Connection) => {
        const companyName = c.company?.toLowerCase() || '';
        if (activeFilters.type === 'academia') {
          return (
            companyName.includes('university') ||
            companyName.includes('college') ||
            c.type === 'program'
          );
        } else {
          return (
            !companyName.includes('university') &&
            !companyName.includes('college') &&
            c.type !== 'program'
          );
        }
      });
    }

    // Apply education level filter
    if (activeFilters.education) {
      result = result.filter((c: Connection) => {
        const eduLevel = (c.education_level ?? '').toLowerCase();
        const role = c.current_role?.toLowerCase() || '';
        switch (activeFilters.education) {
          case 'undergraduate':
            return (
              eduLevel === 'undergraduate' ||
              role.includes('undergrad') ||
              role.includes('bachelor')
            );
          case 'graduate':
            return (
              eduLevel === 'graduate' ||
              role.includes('grad') ||
              role.includes('master')
            );
          case 'postgraduate':
            return (
              eduLevel === 'postgraduate' ||
              role.includes('phd') ||
              role.includes('postdoc') ||
              role.includes('post-doc') ||
              role.includes('postgraduate')
            );
          default:
            return true;
        }
      });
    }

    return result;
  }, [connections, archiveFilters]);

  // Pending connections from ALL searches (for modal)
  const allPendingPeople = useMemo(() => {
    return allPendingConnections.filter((c: Connection) => c.type === 'person');
  }, [allPendingConnections]);

  const allPendingPrograms = useMemo(() => {
    return allPendingConnections.filter(
      (c: Connection) => c.type === 'program'
    );
  }, [allPendingConnections]);

  // Pending connections from current search only (for button count)
  const pendingConnections = useMemo(() => {
    return connections.filter(
      (c: Connection) =>
        c.type === 'person' && (c.status === 'not_contacted' || !c.status)
    );
  }, [connections]);

  const pendingPrograms = useMemo(() => {
    return connections.filter(
      (c: Connection) =>
        c.type === 'program' && (c.status === 'not_contacted' || !c.status)
    );
  }, [connections]);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserDataLocal = async () => {
    setLoading(true);
    if (!currentUser) return;
    try {
      const {
        goals,
        connections,
        personalizationSettings: fetchedPersonalizationSettings,
      } = await fetchUserData(currentUser);
      setGoals(goals);
      setConnections(connections);
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
      console.log('All connections:', allConnections);
      const pending = allConnections.filter(
        (c: Connection) => c.status === 'not_contacted' || !c.status
      );
      console.log('Pending connections:', pending);
      const pendingPrograms = pending.filter((c: Connection) => c.type === 'program');
      console.log('Pending programs:', pendingPrograms);
      setAllPendingConnections(pending);
    } catch (error) {
      console.error('Error fetching all pending connections:', error);
    }
  };

  // Fetch user data when currentUser is available
  useEffect(() => {
    if (!currentUser) return;

    fetchUserDataLocal();
  }, [currentUser]);

  // Auto-start connection search if coming from upload page
  useEffect(() => {
    const autoStart = searchParams.get('autoStart');
    const goalFromUrl = searchParams.get('goal');
    
    if (autoStart === 'true' && goalFromUrl && currentUser && !findingMore && !searchMode) {
      // Set the search goal from URL
      setSearchGoal(goalFromUrl);
      
      // Start the search automatically after a brief delay to ensure UI is ready
      const timeoutId = setTimeout(async () => {
        // Manually trigger the search logic here to avoid dependency issues
        setResumeError('');
        setSearchMode(true);
        setConnections([]);
        setGoals(goalFromUrl);

        // Save the goal to database
        if (currentUser) {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            { goals: goalFromUrl },
            { merge: true }
          );
        }

        // Trigger connection finding
        await fetchMoreConnections();
      }, 1000);
      
      // Clean up URL parameters
      router.replace('/dashboard');
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentUser, searchParams, findingMore, searchMode]);

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
  const [preferences, setPreferences] = useState({ connections: true, programs: true });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load preferences from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('connectionPreferences');
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
      setPreferencesLoaded(true);
    }
  }, []);

  // Persist prefs (only after initial load to prevent hydration issues)
  useEffect(() => {
    if (typeof window !== 'undefined' && preferencesLoaded) {
      localStorage.setItem(
        'connectionPreferences',
        JSON.stringify(preferences)
      );
    }
  }, [preferences, preferencesLoaded]);

  const fetchMoreConnections = async () => {
    if (!currentUser) return;
    setFindingMore(true);
    setResumeError(''); // Clear any previous errors

    try {
      // Refresh user + resume data to build the payload
      const freshUserData: any = await getUser(currentUser.uid);
      if (!freshUserData) {
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
        setResumeError('Please upload your resume first to find relevant connections.');
        return;
      }

      // Log the data we're about to send for debugging
      console.log('🎯 Fresh User Data:', {
        hasResumeAspects: !!freshUserData?.resumeAspects,
        resumeAspects: freshUserData?.resumeAspects ? 'Present' : 'Missing',
        resumeAspectsKeys: freshUserData?.resumeAspects ? Object.keys(freshUserData.resumeAspects) : 'N/A',
        race: freshUserData?.race,
        raceConverted: Array.isArray(freshUserData?.race) ? freshUserData.race.join(', ') : (freshUserData?.race || ''),
        location: freshUserData?.location,
      });
      
      // Detailed logging of resumeAspects content
      if (freshUserData?.resumeAspects) {
        console.log('🎯 Resume Aspects Details:', JSON.stringify(freshUserData.resumeAspects, null, 2));
      } else {
        console.warn('⚠️ Frontend - resumeAspects is missing from user data, background info will not be included');
      }

      // Check if resumeAspects is missing or empty
      if (!freshUserData?.resumeAspects || Object.keys(freshUserData.resumeAspects).length === 0) {
        setResumeError(
          'Your resume needs to be analyzed before we can find connections. Please upload or re-upload your resume to analyze it properly.'
        );
        return;
      }
      console.log('🎯 Resume Data:', {
        hasText: !!resumeData?.text,
        textLength: resumeData?.text?.length || 0,
      });

      // Extract a single goal title for the API
      const goalTitle =
        typeof freshUserData?.goals === 'string' ? freshUserData.goals : '';
      const rawResumeText = resumeData?.text || '';

      // Debug personalization settings before sending
      console.log('🎯 Frontend - Sending Personalization Settings:', {
        enabled: personalizationSettings?.enabled,
        professionalInterests: personalizationSettings?.professionalInterests,
        personalInterests: personalizationSettings?.personalInterests,
      });

      // Make the streaming request
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalTitle: typeof goals === 'string' ? goals : goals[0]?.title,
          preferences,
          userId: currentUser.uid,
          race: Array.isArray(freshUserData?.race) ? freshUserData.race.join(', ') : (freshUserData?.race || ''),
          location: freshUserData?.location || '',
          resumeAspects: freshUserData?.resumeAspects || {},
          rawResumeText: resumeData?.text || '',
          personalizationSettings,
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

      // Set up streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamedConnections: Connection[] = [];
      let finalConnections: Connection[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'step-update':
                  // Update your loader step
                  setCurrentConnectionStepIndex(data.step);
                  break;

                case 'connection-found':
                  // Debug what's received from SSE
                  console.log(`🎯 Frontend SSE - Received connection: ${data.connection?.name}`);
                  console.log('  shared_professional_interests:', JSON.stringify(data.connection?.shared_professional_interests, null, 2));
                  console.log('  shared_personal_interests:', JSON.stringify(data.connection?.shared_personal_interests, null, 2));
                  
                  // Add connections as they're found and update UI immediately
                  streamedConnections.push(data.connection);
                  
                  // Update UI to show connections as they arrive
                  setConnections((prev) => {
                    const existingIds = new Set(prev.map((c) => c.id));
                    if (!existingIds.has(data.connection.id)) {
                      return [...prev, data.connection];
                    }
                    return prev;
                  });
                  break;

                case 'enrichment-progress':
                  // Optional: show enrichment progress
                  console.log(`Enriching connections: ${data.progress}%`);
                  break;

                case 'complete':
                  // This contains the final processed connections
                  finalConnections = data.data.connections || [];
                  // Don't move search bar here since it's already moved when first connection arrives
                  break;

                case 'error':
                  console.error('Stream error:', data.message);
                  throw new Error(data.message);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }

      // Connections are already added during streaming, so just save them to Firestore
      if (finalConnections.length > 0) {
        const connectionsWithDefaults = finalConnections.map(conn => ({
          ...conn,
          status: conn.status || 'not_contacted',
          lastUpdated: new Date().toISOString(),
        }));
        
        updateDoc(doc(db, 'users', currentUser.uid), {
          connections: arrayUnion(...connectionsWithDefaults)
        }).catch((error) => {
          console.error('❌ Technical error - Failed to save connections:', {
            userId: currentUser.uid,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      console.error('❌ Technical error - Failed to fetch connections:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // You might want to add a toast notification here
      // toast.error('We had trouble finding connections. Please try again.');
    } finally {
      setFindingMore(false);
      // Reset the step index after completion
      setCurrentConnectionStepIndex(0);
    }
  };

  // Helper to refresh user data after upload
  const refreshUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserData(userData);
        if (userData.personalizationSettings) {
          console.log('🎯 Loading Personalization Settings from Firebase:', {
            enabled: userData.personalizationSettings.enabled,
            professionalInterests: userData.personalizationSettings.professionalInterests,
            personalInterests: userData.personalizationSettings.personalInterests,
          });
          setPersonalizationSettings(userData.personalizationSettings);
        } else {
          console.log('⚠️ No personalization settings found in Firebase - using defaults');
        }
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
    setUploading(true);
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
    try {
      // Prepare upload
      updateStep('prepare', 'in_progress');
      setCurrentStatus('Preparing to upload resume...');
      setUploadingStepIndex(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUser.uid); // Add user ID
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStep('prepare', 'completed');

      // Upload file
      setUploadingStepIndex(1);
      updateStep('upload', 'in_progress');
      setCurrentStatus('Uploading resume...');
      const response = await fetch('/api/resume-analysis', {
        method: 'POST',
        body: formData,
      });

      // First, check if the response is OK
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to analyze resume');
      }

      // Only parse JSON if response is OK
      const result = await response.clone().json();

      // Write the resume data to Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userRef,
          {
            resumeStructuredData: result.response.structuredData,
            resumeAspects: result.response.resumeAspects,
          },
          { merge: true }
        );
      }

      updateStep('upload', 'completed');
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Parse and analyze
      setUploadingStepIndex(2);
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
          setUploadingStepIndex(3);
          setCurrentStatus('AI analyzing resume...');
        }
        if (apiSteps.pdfParsed) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (apiSteps.aiAnalysis) {
          updateStep('analyze', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 400));
          updateStep('store', 'in_progress');
          setUploadingStepIndex(4);
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
      setResumeError(''); // Clear resume error on successful upload
      setFile(null); // Optionally clear file
      await refreshUserData();
      window.location.reload();
    } catch (err) {
      setCurrentStatus('Error during upload');
      updateStep(
        steps.find((step) => step.status === 'in_progress')?.id || 'prepare',
        'failed'
      );
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload resume'
      );
    } finally {
      setUploading(false);
    }
  };

  // New handler functions for redesigned dashboard
  const handleSearch = async () => {
    if (!searchGoal.trim()) return;

    // Clear any previous resume errors
    setResumeError('');

    // Move search bar to top and set search mode immediately
    setSearchMode(true);
    setSearchBarCentered(false);

    // Clear existing connections before new search
    setConnections([]);

    // Use the search goal as the new goal and trigger connection finding
    setGoals(searchGoal);

    // Save the goal to database
    if (currentUser) {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { goals: searchGoal },
        { merge: true }
      );
    }

    // Trigger connection finding
    await fetchMoreConnections();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const savePersonalization = async () => {
    if (!currentUser) return;

    // Debug personalization form submission
    console.log('🎯 Personalization Form - Saving Settings:', {
      enabled: personalizationSettings.enabled,
      professionalInterests: personalizationSettings.professionalInterests,
      personalInterests: personalizationSettings.personalInterests,
    });

    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          personalizationSettings: personalizationSettings,
        },
        { merge: true }
      );
      console.log('✅ Personalization settings saved to Firebase successfully');
      setPersonalizationModal(false);
    } catch (error) {
      console.error('❌ Error saving personalization settings:', error);
    }
  };

  const resetToHome = () => {
    setSearchMode(false);
    setSearchBarCentered(true);
    setSearchGoal('');
    setConnections([]);
  };

  useEffect(
    () => console.log('Uploaded changed to: ' + uploading),
    [uploading]
  );

  return (
    <>

      {/* Show multistep loader during upload */}
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

      {/* NEW REDESIGNED DASHBOARD */}
      <div className='min-h-screen bg-[#0a0a0a] p-4'>
        <div className='flex justify-between items-center mb-8'>
          <button
            onClick={resetToHome}
            className='bg-[#2a2a2a] hover:bg-[#3a3a3a] inline-block p-4 rounded-xl transition-colors cursor-pointer'
          >
            <h1 className='text-white text-2xl font-mono'>Refr ☕️</h1>
          </button>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => {
                setShowPendingModal(true);
                fetchAllPendingConnections();
              }}
              className='bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border border-gray-700'
            >
              <Clock className='w-4 h-4' />
              View {allPendingPeople.length + allPendingPrograms.length + ' '}
              Pending Connections
            </button>
            <BorderMagicButton
              onClick={() => setPersonalizationModal(true)}
              className='flex items-center gap-2 font-medium rounded-lg'
            >
              <Sparkles className='w-4 h-4' />
              Personalize Connection-Finding Agent
            </BorderMagicButton>
            <button
              onClick={handleSignOut}
              className='bg-[#2a2a2a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm'
            >
              Sign Out
            </button>
          </div>
        </div>

        {loading ? (
          <div className='text-gray-400 text-center'>
            Loading your profile...
          </div>
        ) : (
          <>
            {/* Search Section */}
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
                    What's your goal?
                  </h2>
                )}
                <div className='relative'>
                  <input
                    type='text'
                    value={searchGoal}
                    onChange={(e) => setSearchGoal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Enter your career goal to find relevant connections...'
                    className='w-full px-6 py-4 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg'
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchGoal.trim() || findingMore}
                    className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                  >
                    <Search className='w-5 h-5' />
                  </button>
                </div>

                {/* Preferences Checkboxes */}
                <div className='flex justify-center gap-6 mt-4'>
                  <label className='flex items-center gap-2 text-gray-300 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={preferences.connections}
                      onChange={(e) =>
                        setPreferences((prev: any) => ({
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
                        setPreferences((prev: any) => ({
                          ...prev,
                          programs: e.target.checked,
                        }))
                      }
                      className='w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-blue-600 focus:ring-blue-500 focus:ring-2'
                    />
                    Programs
                  </label>
                </div>
              </div>
            </div>

            {/* Resume Error Message */}
            {resumeError && (
              <div className='max-w-2xl mx-auto mb-8'>
                <div className='bg-red-900/20 border border-red-700 rounded-lg p-4'>
                  <div className='flex items-start gap-3'>
                    <div className='flex-shrink-0 mt-1'>
                      <Upload className='w-5 h-5 text-red-400' />
                    </div>
                    <div>
                      <h4 className='text-red-300 font-medium mb-1'>Resume Required</h4>
                      <p className='text-red-200 text-sm mb-3'>{resumeError}</p>
                      <button
                        onClick={() => setShowResumeModal(true)}
                        className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2'
                      >
                        <Upload className='w-4 h-4' />
                        Upload Resume
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Connections Layout */}
            {searchMode && !searchBarCentered && !resumeError && (
              <div className={`${findingMore ? 'flex gap-8' : ''}`}>
                {/* Connections Grid */}
                <div className={`${findingMore ? 'flex-1' : ''} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`}>
                  {activeFilteredConnections.map((connection: Connection) =>
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
                
                {/* Inline Connection Finder Loader */}
                {findingMore && (
                  <div className="w-80 flex-shrink-0">
                    <div className="sticky top-8 bg-[#1a1a1a] rounded-lg p-6 border border-gray-700">
                      <h3 className="text-white text-lg font-semibold mb-4">Finding Connections</h3>
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
          </>
        )}

        {/* Update Resume Button - Bottom Right */}
        <div className='fixed bottom-6 right-6'>
          <button
            onClick={() => setShowResumeModal(true)}
            className='bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-lg border border-gray-700'
          >
            <Upload className='w-4 h-4' />
            Update Resume
          </button>
        </div>

        {/* Resume Upload Modal */}
        {showResumeModal && (
          <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
            <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md border border-gray-700'>
              <h3 className='text-white text-xl font-bold mb-6'>
                Update Resume
              </h3>

              <div className='space-y-4'>
                <FileUpload
                  onChange={(files) => {
                    if (files && files.length) {
                      setFile(files[0]);
                      setUploadError('');
                    }
                  }}
                  title='Select Resume'
                  description='Upload your updated resume to improve connection finding'
                />

                {uploadError && (
                  <div className='text-red-500 text-sm'>{uploadError}</div>
                )}

                {uploadSuccess && (
                  <div className='text-green-500 text-sm'>
                    Resume updated successfully!
                  </div>
                )}
              </div>

              <div className='flex justify-end gap-3 mt-6'>
                <button
                  onClick={() => {
                    setShowResumeModal(false);
                    setFile(null);
                    setUploadError('');
                    setUploadSuccess(false);
                    setResumeError(''); // Clear resume error when closing modal
                  }}
                  className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleResumeUpload();
                  }}
                  disabled={uploading || !file}
                  className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors'
                >
                  {uploading ? 'Uploading...' : 'Update Resume'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Connections Modal */}
        {showPendingModal && (
          <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
            <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] border border-gray-700 overflow-hidden'>
              <div className='flex justify-between items-center mb-6'>
                <h3 className='text-white text-xl font-bold'>
                  Pending{' '}
                  {pendingModalView === 'people'
                    ? `People (${allPendingPeople.length})`
                    : `Programs (${allPendingPrograms.length})`}
                </h3>
                <button
                  onClick={() => setShowPendingModal(false)}
                  className='text-gray-400 hover:text-white text-xl'
                >
                  ×
                </button>
              </div>

              {/* Toggle */}
              <div className='flex mb-6'>
                <div className='bg-[#2a2a2a] rounded-lg p-1 flex'>
                  <button
                    onClick={() => setPendingModalView('people')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pendingModalView === 'people'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    People
                  </button>
                  <button
                    onClick={() => setPendingModalView('programs')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pendingModalView === 'programs'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Programs
                  </button>
                </div>
              </div>

              <div className='overflow-y-auto max-h-[60vh]'>
                {pendingModalView === 'people' ? (
                  allPendingPeople.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      {allPendingPeople.map((connection: Connection, index: number) => (
                        <PersonConnectionCard
                          key={`${connection.id}-${Math.random().toString().substring(2, 12)}-${index}`}
                          connection={connection}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-10 text-gray-400'>
                      No pending people connections. Try finding some
                      connections first!
                    </div>
                  )
                ) : allPendingPrograms.length > 0 ? (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {allPendingPrograms.map((connection: Connection, index: number) => (
                      <ProgramConnectionCard
                        key={`${connection.id}-${Math.random().toString().substring(2, 12)}-${index}`}
                        connection={connection}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-10 text-gray-400'>
                    No pending program connections. Try finding some programs
                    first!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Personalization Modal */}
        {personalizationModal && (
          <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
            <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md border border-gray-700'>
              <h3 className='text-white text-xl font-bold mb-6'>
                Personalize Your Connections
              </h3>

              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-white font-medium'>
                    Enable Personalization
                  </span>
                  <label className='relative inline-flex items-center cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={personalizationSettings.enabled}
                      onChange={(e) =>
                        setPersonalizationSettings((prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                        }))
                      }
                      className='sr-only peer'
                    />
                    <div className='w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600'></div>
                  </label>
                </div>

                <div>
                  <label
                    className={`block font-medium mb-2 ${
                      personalizationSettings.enabled
                        ? 'text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    Professional Interests
                  </label>
                  <textarea
                    value={personalizationSettings.professionalInterests}
                    onChange={(e) =>
                      setPersonalizationSettings((prev) => ({
                        ...prev,
                        professionalInterests: e.target.value,
                      }))
                    }
                    disabled={!personalizationSettings.enabled}
                    placeholder='Describe your professional interests...'
                    className={`w-full h-24 px-3 py-2 border rounded-lg focus:outline-none ${
                      personalizationSettings.enabled
                        ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                        : 'bg-gray-800 border-gray-700 text-gray-500 placeholder-gray-600 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block font-medium mb-2 ${
                      personalizationSettings.enabled
                        ? 'text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    Personal Interests & Hobbies
                  </label>
                  <textarea
                    value={personalizationSettings.personalInterests}
                    onChange={(e) =>
                      setPersonalizationSettings((prev) => ({
                        ...prev,
                        personalInterests: e.target.value,
                      }))
                    }
                    disabled={!personalizationSettings.enabled}
                    placeholder='Describe your hobbies and personal interests...'
                    className={`w-full h-24 px-3 py-2 border rounded-lg focus:outline-none ${
                      personalizationSettings.enabled
                        ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                        : 'bg-gray-800 border-gray-700 text-gray-500 placeholder-gray-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              <div className='flex justify-end gap-3 mt-6'>
                <button
                  onClick={() => setPersonalizationModal(false)}
                  className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={savePersonalization}
                  className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
