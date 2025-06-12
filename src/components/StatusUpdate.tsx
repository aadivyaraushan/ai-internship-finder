import React, { useEffect, useState } from 'react';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface StatusUpdateProps {
  steps: ProcessingStep[];
  currentStatus: string;
}

export default function StatusUpdate({
  steps,
  currentStatus,
}: StatusUpdateProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Find the highest index where status is completed
    const lastCompletedIdx = steps.reduce((acc, step, idx) => {
      return step.status === 'completed' ? idx : acc;
    }, -1);
    // Mark all steps up to and including lastCompletedIdx as completed
    if (lastCompletedIdx >= 0) {
      const completedIds = new Set(steps.slice(0, lastCompletedIdx + 1).map((step) => step.id));
      setCompletedSteps(completedIds);
    }
  }, [steps]);

  return (
    <div className='mb-4 p-4 bg-blue-500/10 border border-blue-500 rounded-lg text-blue-400 text-sm'>
      <div className='mb-2 font-medium'>{currentStatus}</div>
      <div className='space-y-2'>
        {steps.map((step) => (
          <div key={step.id} className='flex items-center gap-2'>
            {completedSteps.has(step.id) ? (
              <svg
                className='w-4 h-4 text-green-500 flex-shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 13l4 4L19 7'
                />
              </svg>
            ) : step.status === 'in_progress' ? (
              <div className='animate-spin h-4 w-4 flex-shrink-0'>
                <svg
                  className='h-4 w-4 text-blue-500'
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
              </div>
            ) : step.status === 'error' ? (
              <svg
                className='w-4 h-4 text-red-500 flex-shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            ) : (
              <div className='w-4 h-4 border-2 border-gray-400 rounded-full flex-shrink-0'></div>
            )}
            <span
              className={`${
                completedSteps.has(step.id)
                  ? 'text-green-400'
                  : step.status === 'in_progress'
                  ? 'text-blue-400'
                  : step.status === 'error'
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
