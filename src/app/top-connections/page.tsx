'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';

interface Connection {
  id: string;
  name: string;
  imageUrl: string;
  matchPercentage: number;
  matchReason: string;
  type?: 'person' | 'program';
  program_description?: string;
  program_type?: string;
  organization?: string;
  url?: string;
  enrollment_info?: string;
  how_this_helps?: string;
  status?:
    | 'not_contacted'
    | 'email_sent'
    | 'response_received'
    | 'meeting_scheduled'
    | 'rejected'
    | 'ghosted';
  current_role?: string;
  company?: string;
  hiring_power?: {
    role_type: string;
    can_hire_interns: boolean;
    department: string;
  };
  exact_matches?: {
    education: {
      university: string;
      graduation_year: string;
      degree: string;
    };
    shared_activities: Array<{
      name: string;
      year: string;
      type: string;
    }>;
  };
  outreach_strategy?: {
    shared_background_points: string[];
    suggested_approach: string;
  };
}

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

function generateMatchExplanation(connection: Connection): React.ReactNode {
  const sharedBackgroundPoints: string[] =
    connection.outreach_strategy?.shared_background_points || [];
  const matchDetails: string[] = [];

  const sanitize = (text: string | undefined): string =>
    text ? text.replace(/<cite[^>]*>|<\/cite>/g, '') : '';

  if (connection.type === 'program') {
    // Build explanation for program
    return (
      <div className='space-y-2'>
        {connection.program_description && (
          <p className='text-gray-300'>
            {sanitize(connection.program_description)}
          </p>
        )}
        <div className='space-y-1'>
          <p className='text-blue-400 font-medium'>
            Why this program is a fit:
          </p>
          <ul className='list-disc list-inside space-y-1 text-gray-400 text-sm'>
            {connection.how_this_helps && (
              <li>{sanitize(connection.how_this_helps)}</li>
            )}
            {matchDetails.map((detail, index) => (
              <li key={index}>{sanitize(detail)}</li>
            ))}
          </ul>
          {connection.url && (
            <p className='text-gray-400 text-sm mt-2'>
              <a
                href={connection.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-400 underline'
              >
                Program website
              </a>
              {connection.enrollment_info &&
                ` – ${sanitize(connection.enrollment_info)}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Add education matches
  if (connection.exact_matches?.education) {
    const edu = connection.exact_matches.education;
    matchDetails.push(`Same university: ${sanitize(edu.university)}`);
    if (edu.degree) matchDetails.push(`Same degree: ${sanitize(edu.degree)}`);
    if (edu.graduation_year)
      matchDetails.push(`Graduation year: ${sanitize(edu.graduation_year)}`);
  }

  // Add shared activities
  connection.exact_matches?.shared_activities?.forEach((activity) => {
    matchDetails.push(
      `${sanitize(activity.type)}: ${sanitize(activity.name)} (${sanitize(
        activity.year
      )})`
    );
  });

  return (
    <div className='space-y-2'>
      <p className='text-gray-300 font-medium'>
        {connection.current_role &&
          `${sanitize(connection.name)} is a ${sanitize(
            connection.current_role
          )} at ${sanitize(connection.company)}`}
        {connection.hiring_power &&
          ` with ${
            connection.hiring_power.role_type === 'manager'
              ? 'management'
              : 'hiring'
          } responsibilities in ${sanitize(
            connection.hiring_power.department
          )}`}
      </p>
      <div className='space-y-1'>
        <p className='text-blue-400 font-medium'>
          We think this person is a great match because:
        </p>
        <ul className='list-disc list-inside space-y-1 text-gray-400 text-sm'>
          {connection.matchReason && (
            <li>{sanitize(connection.matchReason)}</li>
          )}
          {matchDetails.map((detail, index) => (
            <li key={index}>{sanitize(detail)}</li>
          ))}
          {sharedBackgroundPoints.map((point, index) => (
            <li key={`bp-${index}`}>{sanitize(point)}</li>
          ))}
        </ul>
        {connection.outreach_strategy?.suggested_approach && (
          <p className='text-gray-400 text-sm mt-2'>
            <span className='text-blue-400'>Suggested approach:</span>{' '}
            {sanitize(connection.outreach_strategy.suggested_approach)}
          </p>
        )}
      </div>
    </div>
  );
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
          console.log('Loaded connections from storage:', parsedConnections);
          setConnections(parsedConnections);
        }
      } catch (err: any) {
        console.error('Error loading connections:', err);
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
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-7xl'>
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

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {connections.map((connection, index) => (
            <div
              key={index}
              className='bg-[#2a2a2a] p-6 rounded-lg flex items-start gap-4 h-full'
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
              <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='min-w-0'>
                    <h3 className='text-white font-medium text-lg truncate'>
                      {connection.name}
                      {connection.type === 'program' && (
                        <span className='ml-2 px-2 py-0.5 rounded bg-indigo-600 text-xs text-white'>
                          PROGRAM
                        </span>
                      )}
                    </h3>
                    {connection.type === 'person' &&
                      connection.current_role && (
                        <p className='text-gray-400 truncate'>
                          {connection.current_role} at {connection.company}
                        </p>
                      )}
                    {connection.type === 'program' &&
                      connection.organization && (
                        <p className='text-gray-400 truncate'>
                          {connection.organization}
                        </p>
                      )}
                  </div>
                  <div className='text-blue-500 font-medium text-lg flex-shrink-0 ml-2'>
                    {connection.matchPercentage}% Match
                  </div>
                </div>
                {generateMatchExplanation(connection)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
