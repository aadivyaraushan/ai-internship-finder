'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkAuth } from '@/lib/firebase';
import StatusUpdate, { ProcessingStep } from '@/components/StatusUpdate';

interface Goal {
  id: number;
  title: string;
  description: string;
  selected: boolean;
  isEditing?: boolean;
}

export default function TopGoals() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goal = searchParams.get('goal');
  const [apiGoals, setApiGoals] = useState<Goal[]>([]);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'load', label: 'Loading resume data', status: 'pending' },
    { id: 'analyze', label: 'AI analyzing goals', status: 'pending' },
    { id: 'generate', label: 'Generating suggestions', status: 'pending' },
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
    }

    if (!goal) {
      router.push('/upload-resume');
    }
  }, [router]);

  const fetchGoals = async () => {
    setLoading(true);
    setCurrentStatus('Starting goal analysis...');

    // Reset all steps to pending
    setSteps(steps.map((step) => ({ ...step, status: 'pending' })));

    try {
      // Start loading resume data
      updateStep('load', 'in_progress');
      setCurrentStatus('Loading your resume data...');

      const response = await fetch('/api/goal-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: goal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze goals');
      }

      // Initial data loaded
      updateStep('load', 'completed');
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Start AI analysis
      updateStep('analyze', 'in_progress');
      setCurrentStatus('AI analyzing your profile...');
      const data = await response.json();

      if (data.processingSteps) {
        const apiSteps = data.processingSteps;

        // Context loaded
        if (apiSteps.contextLoaded) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          updateStep('analyze', 'completed');

          // Start generating suggestions
          updateStep('generate', 'in_progress');
          setCurrentStatus('Generating personalized goals...');
        }

        // AI analysis complete
        if (apiSteps.aiAnalysis) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          updateStep('generate', 'completed');

          // Start preparing recommendations
          updateStep('prepare', 'in_progress');
          setCurrentStatus('Formatting your recommendations...');
        }

        // Goals generated
        if (apiSteps.goalsGenerated) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        // Recommendations formatted
        if (apiSteps.recommendationsFormatted) {
          updateStep('prepare', 'completed');
          setCurrentStatus('Your personalized goals are ready!');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const endGoals = data.response.endGoals;
      const goals = endGoals.map((goal: any, index: number) => ({
        id: index + 1,
        title: goal.title,
        description: goal.description,
        selected: false,
      }));

      setApiGoals(goals);
      setCurrentStatus('');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze goals');
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
    fetchGoals();
  }, [goal]);

  const toggleGoal = (id: number) => {
    const selectedCount = apiGoals.filter((goal) => goal.selected).length;
    setApiGoals(
      apiGoals.map((goal) => {
        if (goal.id === id) {
          if (!goal.selected && selectedCount >= 3) return goal;
          return { ...goal, selected: !goal.selected };
        }
        return goal;
      })
    );
  };

  const addNewGoal = () => {
    const newId = Math.max(...apiGoals.map((g) => g.id), 0) + 1;
    const newGoal: Goal = {
      id: newId,
      title: '',
      description: '',
      selected: false,
      isEditing: true,
    };
    setApiGoals([...apiGoals, newGoal]);
    setEditingGoal(newGoal);
  };

  const saveGoal = (id: number, title: string, description: string) => {
    setApiGoals(
      apiGoals.map((goal) =>
        goal.id === id
          ? { ...goal, title, description, isEditing: false }
          : goal
      )
    );
    setEditingGoal(null);
  };

  const deleteGoal = (id: number) => {
    setApiGoals(apiGoals.filter((goal) => goal.id !== id));
    setEditingGoal(null);
  };

  const EditableGoalItem = ({ goal }: { goal: Goal }) => {
    const [title, setTitle] = useState(goal.title);
    const [description, setDescription] = useState(goal.description);

    if (goal.isEditing) {
      return (
        <div className='p-4 rounded-lg bg-[#2a2a2a] border border-blue-500'>
          <input
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Goal title'
            className='w-full mb-2 px-3 py-2 bg-[#1a1a1a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Goal description'
            className='w-full mb-3 px-3 py-2 bg-[#1a1a1a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <div className='flex justify-end gap-2'>
            <button
              onClick={() => deleteGoal(goal.id)}
              className='px-3 py-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors'
            >
              Delete
            </button>
            <button
              onClick={() => saveGoal(goal.id, title, description)}
              className='px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => toggleGoal(goal.id)}
        className={`p-4 rounded-lg cursor-pointer transition-all ${
          goal.selected
            ? 'bg-blue-500/20 border border-blue-500'
            : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent'
        }`}
      >
        <h3 className='text-white font-medium mb-1'>{goal.title}</h3>
        <p className='text-gray-400 text-sm'>{goal.description}</p>
      </div>
    );
  };

  const handleSubmit = () => {
    const selectedGoals = apiGoals.filter((goal) => goal.selected);
    if (selectedGoals.length === 0) {
      setError('Please select at least one goal');
      return;
    }
    router.push(
      `/top-roles?goals=${encodeURIComponent(JSON.stringify(selectedGoals))}`
    );
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Goals
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
          Select the 3 most important goals to you.
        </p>

        <div className='space-y-3 mb-6'>
          {apiGoals.map((goal) => (
            <EditableGoalItem key={goal.id} goal={goal} />
          ))}
        </div>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors'
            onClick={addNewGoal}
          >
            Add Goal
          </button>
          <button
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
