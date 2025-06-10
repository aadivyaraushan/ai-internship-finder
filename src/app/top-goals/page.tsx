'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkAuth } from '@/lib/firebase';

interface Goal {
  id: number;
  title: string;
  description: string;
  selected: boolean;
}

export default function TopGoals() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goal = searchParams.get('goal');
  const [apiGoals, setApiGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!goal) {
      router.push('/upload-resume');
    }

    const fetchGoals = async () => {
      const response = await fetch('/api/goal-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({'goal': goal}),
      });
      const data = await response.json();
      const endGoals = (JSON.parse(data.response.kwargs.content)).endGoals;
      console.log(endGoals);
      // Convert the response into the expected Goal format
      const goals = endGoals.map((goal: any, index: number) => ({
        id: index + 1,
        title: goal.title,
        description: goal.description,
        selected: false
      }));
      setApiGoals(goals);
    };
    fetchGoals();
  }, [goal]);

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      }
  }, [router]);
  
  

  const toggleGoal = (id: number) => {
    const selectedCount = apiGoals.filter((goal) => goal.selected).length;
    setApiGoals(
      apiGoals.map((goal) => {
        if (goal.id === id) {
          // Only allow selection if less than 3 are selected, or if we're deselecting
          if (!goal.selected && selectedCount >= 3) return goal;
          return { ...goal, selected: !goal.selected };
        }
        return goal;
      })
    );
  };

  const handleSubmit = () => {
    const selectedGoals = apiGoals.filter((goal) => goal.selected);
    console.log('Selected apiGoals:', selectedGoals);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top apiGoals
        </h1>
        <p className='text-gray-400 text-sm text-center mb-6'>
          Based on our AI analysis of your apiGoals
        </p>

        <p className='text-gray-300 text-sm mb-4'>
          Select the 3 most important apiGoals to you.
        </p>

        <div className='space-y-3 mb-6'>
          {apiGoals.map((goal) => (
            <div
              key={goal.id}
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
          ))}
        </div>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors'
            onClick={() => {
              const newId = Math.max(...apiGoals.map((g) => g.id)) + 1;
              setApiGoals([
                ...apiGoals,
                {
                  id: newId,
                  title: 'Career exploration and validation',
                  description:
                    'Testing whether you actually enjoy EE work in practice and exploring different specializations to find your niche',
                  selected: false,
                },
              ]);
            }}
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
