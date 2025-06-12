'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkAuth } from '@/lib/firebase';
import StatusUpdate, { ProcessingStep } from '@/components/StatusUpdate';

interface Role {
  title: string;
  bulletPoints: string[];
}

export default function TopRoles() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'load', label: 'Loading your goals', status: 'pending' },
    { id: 'analyze', label: 'Analyzing career paths', status: 'pending' },
    { id: 'generate', label: 'Generating role suggestions', status: 'pending' },
    { id: 'prepare', label: 'Preparing recommendations', status: 'pending' },
  ]);

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setSteps(
      steps.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }
  }, [router]);

  const fetchRoles = async () => {
    setLoading(true);
    setCurrentStatus('Starting role analysis...');

    // Reset all steps to pending
    setSteps(steps.map((step) => ({ ...step, status: 'pending' })));

    try {
      // Start loading goals
      updateStep('load', 'in_progress');
      setCurrentStatus('Loading your selected goals...');
      await new Promise((resolve) => setTimeout(resolve, 800));
      updateStep('load', 'completed');

      // Start analysis
      updateStep('analyze', 'in_progress');
      setCurrentStatus('Analyzing potential career paths...');

      const response = await fetch('/api/roles-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goals: JSON.parse(searchParams.get('goals') || '[]'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze roles');
      }

      const data = await response.json();

      // Update steps based on API response
      if (data.response.processingSteps) {
        const apiSteps = data.response.processingSteps;

        if (apiSteps.contextAnalyzed) {
          updateStep('analyze', 'completed');
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Start generating suggestions
          updateStep('generate', 'in_progress');
          setCurrentStatus('Generating personalized role suggestions...');
        }

        if (apiSteps.rolesIdentified) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          updateStep('generate', 'completed');

          // Start preparing recommendations
          updateStep('prepare', 'in_progress');
          setCurrentStatus('Preparing your role recommendations...');
        }

        if (apiSteps.recommendationsFormatted) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          updateStep('prepare', 'completed');
          setCurrentStatus('Your recommended roles are ready!');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      setRoles(data.response.suggestedRoles);
      setCurrentStatus('');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze roles');
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

  useEffect(() => {
    const goals = searchParams.get('goals');
    if (!goals) {
      router.push('/top-goals');
      return;
    }
    fetchRoles();
  }, [searchParams]);

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Roles
        </h1>
        <p className='text-gray-400 text-sm text-center mb-6'>
          Based on our AI analysis of your goals
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        {(loading || steps.some((step) => step.status === 'completed')) && (
          <StatusUpdate steps={steps} currentStatus={currentStatus} />
        )}

        <p className='text-gray-300 text-sm mb-4'>
          Order the roles based on how much you like them
        </p>

        <div className='space-y-3 mb-6'>
          {roles.map((role, index) => (
            <div
              key={index}
              className='p-4 rounded-lg bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors cursor-pointer'
            >
              <h3 className='text-white font-medium mb-2'>{role.title}</h3>
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
          ))}
        </div>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors'
            onClick={() => router.push('/top-goals')}
          >
            Back
          </button>
          <button
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
            onClick={() => console.log('Submit')}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
