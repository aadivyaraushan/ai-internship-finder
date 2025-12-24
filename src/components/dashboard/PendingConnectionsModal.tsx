'use client';

import { Connection } from '@/lib/firestoreHelpers';
import { PersonConnectionCard } from './PersonConnectionCard';
import { ProgramConnectionCard } from './ProgramConnectionCard';

export interface PendingConnectionsModalProps {
  open: boolean;
  view: 'people' | 'programs';
  pendingPeople: Connection[];
  pendingPrograms: Connection[];
  onClose: () => void;
  onViewChange: (view: 'people' | 'programs') => void;
  onStatusChange: (id: string, status: Connection['status']) => void;
}

export function PendingConnectionsModal({
  open,
  view,
  pendingPeople,
  pendingPrograms,
  onClose,
  onViewChange,
  onStatusChange,
}: PendingConnectionsModalProps) {
  if (!open) return null;

  const count = pendingPeople.length + pendingPrograms.length;

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
      <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] border border-gray-700 overflow-hidden'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-white text-xl font-bold'>
            Pending Connections ({count})
            <span className='text-sm text-gray-400 ml-2'>
              {pendingPeople.length} people, {pendingPrograms.length} programs
            </span>
          </h3>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white text-xl'
            aria-label='Close'
          >
            ×
          </button>
        </div>

        <div className='flex mb-6'>
          <div className='bg-[#2a2a2a] rounded-lg p-1 flex'>
            <button
              onClick={() => onViewChange('people')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'people'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              People
            </button>
            <button
              onClick={() => onViewChange('programs')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'programs'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Programs
            </button>
          </div>
        </div>

        <div className='overflow-y-auto max-h-[60vh]'>
          {view === 'people' ? (
            pendingPeople.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {pendingPeople.map((connection) => (
                  <PersonConnectionCard
                    key={connection.id}
                    connection={connection}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </div>
            ) : (
              <div className='text-center py-10 text-gray-400'>
                No pending people connections. Try finding some connections
                first!
              </div>
            )
          ) : pendingPrograms.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {pendingPrograms.map((connection) => (
                <ProgramConnectionCard
                  key={connection.id}
                  connection={connection}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className='text-center py-10 text-gray-400'>
              No pending program connections. Try finding some programs first!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
