'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, auth } from '@/lib/firebase';
import {
  updateUserConnections,
  getUser,
  updateConnectionStatus,
  Connection,
} from '@/lib/firestoreHelpers';

const STATUS_COLORS: Record<Connection['status'], string> = {
  not_contacted: 'bg-gray-500',
  email_sent: 'bg-yellow-500',
  response_received: 'bg-green-500',
  meeting_scheduled: 'bg-blue-500',
  rejected: 'bg-red-500',
  ghosted: 'bg-purple-500',
};

const STATUS_LABELS: Record<Connection['status'], string> = {
  not_contacted: 'Not Contacted',
  email_sent: 'Email Sent',
  response_received: 'Response Received',
  meeting_scheduled: 'Meeting Scheduled',
  rejected: 'Rejected',
  ghosted: 'No Response (30+ days)',
};

export default function TopConnections() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/signup');
      return;
    }

    const loadConnections = async () => {
      try {
        // Get user data to check if they have completed previous steps
        const currentUser = auth.currentUser;
        if (!currentUser) {
          router.push('/signup');
          return;
        }

        const userData = await getUser(currentUser.uid);
        if (!userData?.roles || !userData?.goals) {
          router.push('/upload-resume');
          return;
        }

        // Try to get connections from localStorage first
        const stored = localStorage.getItem('topConnections');
        if (stored) {
          const parsedConnections = JSON.parse(stored);
          setConnections(parsedConnections);
          setLoading(false);
          return;
        }

        // If no stored connections, fetch from API
        const response = await fetch('/api/connections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roles: userData.roles,
            resumeContext: userData.resumeContext || '',
            goals: userData.goals || [],
            userId: currentUser.uid,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch connections');
        }

        const data = await response.json();
        const connections = data.response.connections;

        // Save to localStorage
        localStorage.setItem('topConnections', JSON.stringify(connections));
        setConnections(connections);
      } catch (err: any) {
        setError(err.message || 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    };

    loadConnections();
  }, [router]);

  const handleConnect = async (connectionId: string) => {
    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    try {
      const selectedConnection = connections.find((c) => c.id === connectionId);
      if (selectedConnection) {
        // Update the connection status to email_sent
        await updateConnectionStatus(
          auth.currentUser.uid,
          connectionId,
          'email_sent',
          'Initial connection request sent'
        );

        // Update local state
        setConnections((prev) =>
          prev.map((conn) =>
            conn.id === connectionId
              ? {
                  ...conn,
                  status: 'email_sent' as const,
                  lastUpdated: new Date().toISOString(),
                  notes: 'Initial connection request sent',
                }
              : conn
          )
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update connection');
    }
  };

  const handleStatusChange = async (
    connectionId: string,
    newStatus: Connection['status']
  ) => {
    if (!auth.currentUser) {
      setError('Please sign in to continue');
      router.push('/signup');
      return;
    }

    try {
      await updateConnectionStatus(
        auth.currentUser.uid,
        connectionId,
        newStatus,
        statusNote
      );

      // Update local state
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === connectionId
            ? {
                ...conn,
                status: newStatus,
                lastUpdated: new Date().toISOString(),
                notes: statusNote,
              }
            : conn
        )
      );

      // Reset note and selected connection
      setStatusNote('');
      setSelectedConnection(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update connection status');
    }
  };

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
          Based on your roles and career goals
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
              className='bg-[#2a2a2a] p-4 rounded-lg flex flex-col gap-4 hover:bg-[#3a3a3a] transition-colors'
            >
              <div className='flex items-start justify-between'>
                <div>
                  <h3 className='text-white font-medium'>
                    {connection.linkedInUrl ? (
                      <a
                        href={connection.linkedInUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:text-blue-400 transition-colors'
                      >
                        {connection.name}
                      </a>
                    ) : (
                      connection.name
                    )}
                  </h3>
                  <p className='text-gray-400 text-sm'>
                    {connection.current_role} at {connection.company}
                  </p>
                </div>
                <div className='text-blue-500 font-medium'>
                  {connection.matchPercentage}% Match
                </div>
              </div>

              <p className='text-gray-400 text-sm'>{connection.matchReason}</p>

              <div className='border-t border-gray-700 pt-3'>
                <p className='text-gray-300 text-sm font-medium mb-2'>
                  Key Similarities:
                </p>
                <div className='flex flex-wrap gap-2'>
                  {connection.sharedBackground.map((point, index) => (
                    <span
                      key={index}
                      className='px-2 py-1 bg-gray-700/50 rounded-md text-gray-300 text-xs'
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              <div className='border-t border-gray-700 pt-3'>
                <div className='flex items-center justify-between mb-2'>
                  <p className='text-gray-300 text-sm font-medium'>Status:</p>
                  <span
                    className={`px-2 py-1 rounded text-xs text-white ${
                      STATUS_COLORS[connection.status]
                    }`}
                  >
                    {STATUS_LABELS[connection.status]}
                  </span>
                </div>

                {connection.notes && (
                  <p className='text-gray-400 text-sm mt-2'>
                    {connection.notes}
                  </p>
                )}

                <button
                  onClick={() => setSelectedConnection(connection)}
                  className='mt-2 text-sm text-blue-400 hover:text-blue-300'
                >
                  Update Status
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Update Modal */}
      {selectedConnection && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4'>
          <div className='bg-[#2a2a2a] p-6 rounded-xl w-full max-w-md'>
            <h3 className='text-white font-medium mb-4'>
              Update Status for {selectedConnection.name}
            </h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-gray-300 text-sm mb-2'>
                  New Status:
                </label>
                <select
                  className='w-full bg-[#3a3a3a] text-white rounded-lg p-2'
                  value={selectedConnection.status}
                  onChange={(e) =>
                    handleStatusChange(
                      selectedConnection.id,
                      e.target.value as Connection['status']
                    )
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-gray-300 text-sm mb-2'>
                  Notes:
                </label>
                <textarea
                  className='w-full bg-[#3a3a3a] text-white rounded-lg p-2'
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={3}
                  placeholder='Add any notes about this status change...'
                />
              </div>

              <div className='flex justify-end gap-2'>
                <button
                  onClick={() => setSelectedConnection(null)}
                  className='px-4 py-2 text-gray-300 hover:text-white'
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleStatusChange(
                      selectedConnection.id,
                      selectedConnection.status
                    )
                  }
                  className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
