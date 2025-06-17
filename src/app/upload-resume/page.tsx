'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import {
  createOrUpdateResume,
  createOrUpdateUser,
} from '@/lib/firestoreHelpers';
import StatusUpdate, { ProcessingStep } from '@/components/StatusUpdate';

export default function UploadResume() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(true);
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
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/signup');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles: File[]) => {
      setFile(acceptedFiles[0]);
      setError(''); // Clear any previous errors
    },
  });

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

          // Store resume data in Firestore
          const resumeId = `${auth.currentUser.uid}_${Date.now()}`;
          await createOrUpdateResume(resumeId, {
            ...data.response.resumeData,
            userId: auth.currentUser.uid,
            uploadedAt: new Date().toISOString(),
          });

          // Update user with resume reference
          await createOrUpdateUser(auth.currentUser.uid, {
            resume_id: resumeId,
            goals: goals.trim(),
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
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push(`/top-goals?goal=${encodeURIComponent(goals)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to process resume');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-2xl'>
        <h1 className='text-2xl font-semibold text-white mb-6'>Upload Resume</h1>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div className='space-y-6'>
          {/* Resume Upload */}
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
              {file ? file.name : 'Drag your resume here or click to upload'}
            </p>
            <p className='text-gray-500 text-sm'>
              Acceptable file types: PDF, DOCX (5MB max)
            </p>
          </div>

          {/* Goals Input */}
          <div>
            <label
              htmlFor='goals'
              className='block text-sm font-medium text-gray-300 mb-2'
            >
              Your Goals
            </label>
            <textarea
              id='goals'
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
              className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !file || !goals.trim()}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </div>

        {/* Status Updates */}
        {loading && (
          <div className='mt-8'>
            <StatusUpdate
              currentStatus={currentStatus}
              steps={steps}
            />
          </div>
        )}
      </div>
    </div>
  );
}
