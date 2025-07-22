// components/PersonConnectionCard.tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { getBackgroundColor, getInitials } from '@/lib/utils';
import { Connection } from '@/lib/firestoreHelpers';

interface PersonConnectionCardProps {
  connection: Connection;
  onStatusChange: (id: string, status: Connection['status']) => void;
  className?: string;
}

export function PersonConnectionCard({
  connection,
  onStatusChange,
  className = '',
}: PersonConnectionCardProps) {
  const [showBackground, setShowBackground] = useState(false);
  return (
    <div
      className={`bg-[#1a1a1a] p-5 rounded-2xl flex items-start gap-4 h-full min-w-0 ${className}`}
    >
      <div className='relative'>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${getBackgroundColor(
            connection.name
          )}`}
        >
          {getInitials(connection.name)}
        </div>
      </div>
      <div className='flex-1 overflow-auto'>
        <div className='flex items-center justify-between gap-2 mb-1'>
          <h3 className='text-white font-medium text-sm'>{connection.name}</h3>
          {(connection.email || connection.verified_profile_url) && (
            <a
              href={
                connection.verified_profile_url
                  ? connection.verified_profile_url
                  : `mailto:${connection.email}`
              }
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-500 text-xs'
            >
              {connection.verified_profile_url?.includes('linkedin')
                ? 'LinkedIn'
                : connection.email
                ? 'Email'
                : 'Non-LinkedIn Contact'}
            </a>
          )}
        </div>
        <p className='text-gray-400 text-xs'>
          {connection.current_role}
          {connection.company && ` at ${connection.company}`}
        </p>
        {connection.description && (
          <p className='text-gray-500 text-xs mt-2 line-clamp-5'>
            {connection.description}
          </p>
        )}
        {connection.shared_background_points &&
          connection.shared_background_points.length > 0 && (
            <div className='mt-2'>
              <button
                onClick={() => setShowBackground(!showBackground)}
                className='flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors'
              >
                {showBackground ? (
                  <ChevronUp className='w-3 h-3 mr-1' />
                ) : (
                  <ChevronDown className='w-3 h-3 mr-1' />
                )}
                {showBackground ? 'Hide' : 'Show'} connection points
              </button>
              {showBackground && (
                <div className='mt-2 space-y-1.5'>
                  {connection.shared_background_points?.map((point, index) => (
                    <div key={index} className='flex items-start gap-1.5'>
                      <CheckCircle className='h-3 w-3 text-green-500 mt-0.5 flex-shrink-0' />
                      <p className='text-xs text-gray-400'>{point}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        <div className='mt-3'>
          <select
            value={connection.status || 'not_contacted'}
            onChange={(e) =>
              onStatusChange(connection.id, e.target.value as any)
            }
            className='w-full bg-[#3a3a3a] text-gray-200 text-xs px-2 py-1 rounded border border-gray-600'
          >
            <option value='not_contacted'>Not Contacted</option>
            <option value='email_sent'>Email/Message Sent</option>
            <option value='response_received'>Responded</option>
            <option value='internship_acquired'>Archive</option>
          </select>
        </div>
      </div>
    </div>
  );
}
