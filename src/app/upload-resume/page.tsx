'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import {
  createOrUpdateResume,
  createOrUpdateUser,
} from '@/lib/firestoreHelpers';
import { useEffect } from 'react';
import { MultiStepLoader } from '@/components/ui/MultiStepLoader';
import { FileUpload } from '@/components/ui/FileUpload';
import BorderMagicButton from '@/components/ui/BorderMagicButton';
import { ShootingStars } from '@/components/ui/ShootingStars';
import { StarsBackground } from '@/components/ui/StarsBackground';

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export default function UploadResume() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const [includePeople, setIncludePeople] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('connectionPreferences');
    return stored ? JSON.parse(stored).connections ?? true : true;
  });
  const [includePrograms, setIncludePrograms] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('connectionPreferences');
    return stored ? JSON.parse(stored).programs ?? true : true;
  });
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'prepare', label: 'Preparing upload', status: 'pending' },
    { id: 'upload', label: 'Uploading file', status: 'pending' },
    { id: 'parse', label: 'Parsing resume content', status: 'pending' },
    { id: 'analyze', label: 'AI analysis', status: 'pending' },
    { id: 'store', label: 'Processing results', status: 'pending' },
  ]);

  const router = useRouter();

  useEffect(() => {
    console.log('Checking auth', checkAuth());
    if (!checkAuth()) {
      router.push('/signup');
    }
  }, [router]);

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setSteps(
      steps.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please upload a resume file');
      return;
    }

    if (!goals.trim()) {
      setError('Please enter your goals before submitting');
      return;
    }

    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    setLoading(true);
    setError('');
    setCurrentStatus('Starting resume analysis...');

    // Reset all steps to pending
    setSteps(steps.map((step) => ({ ...step, status: 'pending' })));

    try {
      // Prepare upload
      updateStep('prepare', 'in_progress');
      setCurrentStatus('Preparing to upload resume...');
      const formData = new FormData();
      formData.append('file', file);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateStep('prepare', 'completed');

      // Upload file
      updateStep('upload', 'in_progress');
      setCurrentStatus('Uploading resume...');
      const response = await fetch('/api/resume-analysis', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze resume');
      }
      updateStep('upload', 'completed');
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Parse and analyze
      updateStep('parse', 'in_progress');
      setCurrentStatus('Reading resume content...');
      const data = await response.json();

      // Handle initial processing steps
      if (data.response.processingSteps) {
        const apiSteps = data.response.processingSteps;

        // File read step
        if (apiSteps.fileRead) {
          updateStep('parse', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Start AI analysis
          updateStep('analyze', 'in_progress');
          setCurrentStatus('AI analyzing resume...');
        }

        // PDF parsed step
        if (apiSteps.pdfParsed) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // AI analysis step
        if (apiSteps.aiAnalysis) {
          updateStep('analyze', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Start storing results
          updateStep('store', 'in_progress');
          setCurrentStatus('Processing analysis results...');

          // Store resume data in Firestore with correct ID format
          await createOrUpdateResume(auth.currentUser.uid, {
            text: data.response.rawText, // Store the actual resume text
            structuredData: data.response.structuredData,
            userId: auth.currentUser.uid,
            uploadedAt: new Date().toISOString(),
          });

          // Update user with resume reference (no need to store resume_id since it's predictable)
          await createOrUpdateUser(auth.currentUser.uid, {
            goals: goals.trim(),
            hasResume: true,
          });
        }

        // Data storage step
        if (apiSteps.dataStored) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          updateStep('store', 'completed');
          setCurrentStatus('Analysis complete! Redirecting...');
        }
      }

      // Final delay before redirect
      // Persist preferences for next page
      localStorage.setItem(
        'connectionPreferences',
        JSON.stringify({
          programs: includePrograms,
          connections: includePeople,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));
      // Directly move to connection-finding, passing no intermediate goal-analysis step
      router.push('/top-connections');
    } catch (err: any) {
      setError(err.message || 'Failed to process resume');
      setCurrentStatus('');
      // Mark current step as error
      const currentStep = steps.find((step) => step.status === 'in_progress');
      if (currentStep) {
        updateStep(currentStep.id, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Determine which step is currently active for loader highlighting
  const inProgressIndex = steps.findIndex(
    (step) => step.status === 'in_progress'
  );
  const progressIndex =
    inProgressIndex !== -1
      ? inProgressIndex
      : Math.max(0, steps.filter((s) => s.status === 'completed').length - 1);

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white mb-1'>
          Upload your resume
        </h1>
        <p className='text-gray-400 text-sm mb-6'>
          Help us get to know you better by sharing your resume
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        {(loading || steps.some((step) => step.status === 'completed')) && (
          <MultiStepLoader
            loadingStates={steps.map((s) => ({ text: s.label }))}
            loading={loading}
            progressIndex={progressIndex}
            loop={false}
          />
        )}

        <div className='mb-6'>
          <FileUpload
            onChange={(files) => {
              if (files && files.length) {
                setFile(files[0]);
                setError('');
              }
            }}
            title='Upload your resume (PDF)'
            description="Drop your resume here or click to browse. We'll analyze it to find the best internship connections for you."
          />
        </div>

        <div className='mb-6'>
          <label htmlFor='goals' className='block text-white mb-2'>
            Please tell us your goals
          </label>
          <textarea
            id='goals'
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
            className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        <div className='flex justify-between gap-4'>
          <BorderMagicButton
            onClick={() => console.log('Save as draft')}
            disabled={loading}
            className='!bg-[#2a2a2a] hover:!bg-[#3a3a3a] !border-[#2a2a2a] before:!hidden [&>span:first-child]:!hidden'
          >
            Save as Draft
          </BorderMagicButton>
          <BorderMagicButton onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : 'Submit'}
          </BorderMagicButton>
        </div>
      </div>
      <ShootingStars />
      <StarsBackground />
    </div>
  );
}
