'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import { Connection } from '@/lib/firestoreHelpers';

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

function generateMatchExplanation(connection: Connection): string {
  // Get the most unique/interesting shared activity
  const mostUniqueActivity = connection.exact_matches.shared_activities.find(
    (activity) => activity.type === 'club' || activity.type === 'competition'
  );

  // Get the hiring power context
  const hiringContext =
    connection.hiring_power.role_type === 'hiring_manager'
      ? 'hiring manager'
      : connection.hiring_power.role_type === 'team_lead'
      ? 'team lead'
      : 'senior member';

  // Build the explanation focusing on the strongest connection points
  const sharedBackground = connection.outreach_strategy.unique_connection_angle;

  return sharedBackground;
}

export default function TopConnections() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }

    const loadConnections = async () => {
      try {
        // Try to get connections from localStorage first
        const stored = localStorage.getItem('topConnections');
        if (stored) {
          const parsedConnections = JSON.parse(stored);
          setConnections(parsedConnections);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    };

    loadConnections();
  }, [router]);

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a]'>
        <div className='text-white'>Finding potential connections...</div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
        <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-4xl text-center'>
          <h1 className='text-2xl font-semibold text-white mb-4'>
            No Connections Found
          </h1>
          <p className='text-gray-400 mb-6'>
            We couldn't find any relevant connections. Please try updating your
            roles and goals.
          </p>
          <button
            onClick={() => router.push('/top-roles')}
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
          >
            Update Roles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-4xl'>
        <h1 className='text-2xl font-semibold text-white text-center mb-1'>
          Your Top Connections
        </h1>
        <p className='text-gray-400 text-sm text-center mb-8'>
          Based on our AI search based on your roles, goals and resume
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {connections.map((connection) => (
            <div
              key={connection.id}
              className='bg-[#2a2a2a] p-4 rounded-lg flex items-start gap-4'
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
              <div className='flex-1'>
                <div className='flex items-center justify-between mb-2'>
                  <h3 className='text-white font-medium'>{connection.name}</h3>
                  <div className='text-blue-500 font-medium'>
                    {connection.match_details.total_percentage}%
                  </div>
                </div>
                <p className='text-gray-400 text-sm'>
                  {generateMatchExplanation(connection)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
