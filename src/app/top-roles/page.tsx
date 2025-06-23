'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { checkAuth, auth } from '@/lib/firebase';
import { updateUserRoles } from '@/lib/firestoreHelpers';
import StatusUpdate, { ProcessingStep } from '@/components/StatusUpdate';

interface Role {
  title: string;
  bulletPoints: string[];
}

function RoleItem({
  role,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  role: Role;
  index: number;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      className={`p-4 rounded-lg bg-[#2a2a2a] hover:bg-[#3a3a3a] cursor-move transition-all duration-200 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className='flex items-center gap-2 mb-2'>
        <svg
          className='w-5 h-5 text-gray-400'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M4 8h16M4 16h16'
          />
        </svg>
        <h3 className='text-white font-medium'>{role.title}</h3>
      </div>
      <ul className='space-y-1'>
        {role.bulletPoints.map((point, i) => (
          <li key={i} className='text-gray-400 text-sm flex items-start'>
            <span className='mr-2'>•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TopRoles() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay to the opacity change for smoother visual feedback
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    dragOverIndex.current = null;
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    dragOverIndex.current = index;

    // Reorder the array
    setRoles((prevRoles) => {
      const newRoles = [...prevRoles];
      const draggedRole = newRoles[draggedIndex];
      newRoles.splice(draggedIndex, 1);
      newRoles.splice(index, 0, draggedRole);
      return newRoles;
    });

    // Update the dragged index to the new position
    setDraggedIndex(index);
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

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Persist the ordered roles
      await updateUserRoles(user.uid, roles);

      // Defer the connection-finding process to the /top-connections page
      router.push('/top-connections');
    } catch (err: any) {
      console.error('Error submitting roles:', err);
      setError(err.message || 'Failed to submit roles');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Roles
        </h1>
        <p className='text-gray-400 text-sm text-center mb-6'>
          Based on the goals you provided
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
          Drag and drop to order the roles based on how much you like them
        </p>

        <div className='space-y-3 mb-6'>
          {roles.map((role, index) => (
            <RoleItem
              key={index}
              role={role}
              index={index}
              isDragging={index === draggedIndex}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            />
          ))}
        </div>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors'
            onClick={() => router.push('/top-goals')}
            disabled={submitting}
          >
            Back
          </button>
          <button
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
            onClick={handleSubmit}
            disabled={submitting || roles.length === 0}
          >
            {submitting ? (
              <>
                <svg
                  className='animate-spin h-5 w-5'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              'Find Connections'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
