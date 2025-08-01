// components/PersonConnectionCard.tsx
import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  MessageSquare,
  Briefcase,
  Heart,
} from 'lucide-react';
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
  const [showOutreach, setShowOutreach] = useState(false);

  // Use actual data from connection object
  const sharedProfessionalBackground =
    connection.shared_background_points || [];
  const sharedProfessionalInterests =
    connection.shared_professional_interests || [];
  const sharedPersonalInterests = connection.shared_personal_interests || [];

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
              {connection.verified_profile_url?.includes('linkedin.com')
                ? 'LinkedIn'
                : connection.email
                ? 'Email'
                : 'Non-LinkedIn Contact'}
            </a>
          )}
        </div>

        {/* Shared Professional Background */}
        {sharedProfessionalBackground.length > 0 && (
          <div className='mt-3'>
            <div className='flex items-center gap-2 mb-2'>
              <Briefcase className='w-3 h-3 text-blue-400' />
              <span className='text-xs font-medium text-blue-400'>
                Shared Professional Background
              </span>
            </div>
            <div className='space-y-1'>
              {sharedProfessionalBackground.slice(0, 3).map((point, index) => (
                <div key={index} className='flex items-start gap-1.5'>
                  <div className='w-1 h-1 rounded-full bg-blue-400 mt-2 flex-shrink-0' />
                  <p className='text-xs text-white leading-relaxed'>{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Professional Interests */}
        {sharedProfessionalInterests.length > 0 && (
          <div className='mt-3'>
            <div className='flex items-center gap-2 mb-2'>
              <CheckCircle className='w-3 h-3 text-green-400' />
              <span className='text-xs font-medium text-green-400'>
                Shared Professional Interests
              </span>
            </div>
            <div className='space-y-1'>
              {sharedProfessionalInterests.slice(0, 3).map((point, index) => (
                <div key={index} className='flex items-start gap-1.5'>
                  <div className='w-1 h-1 rounded-full bg-green-400 mt-2 flex-shrink-0' />
                  <p className='text-xs text-white leading-relaxed'>{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Personal Interests */}
        {sharedPersonalInterests.length > 0 && (
          <div className='mt-3'>
            <div className='flex items-center gap-2 mb-2'>
              <Heart className='w-3 h-3 text-purple-400' />
              <span className='text-xs font-medium text-purple-400'>
                Shared Personal Interests
              </span>
            </div>
            <div className='space-y-1'>
              {sharedPersonalInterests.slice(0, 3).map((point, index) => (
                <div key={index} className='flex items-start gap-1.5'>
                  <div className='w-1 h-1 rounded-full bg-purple-400 mt-2 flex-shrink-0' />
                  <p className='text-xs text-white leading-relaxed'>{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Outreach Message Button */}
        <div className='mt-4'>
          <button
            onClick={() => setShowOutreach(!showOutreach)}
            className='w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium'
          >
            <MessageSquare className='w-3 h-3' />
            {showOutreach ? 'Hide' : 'View'} AI Outreach Message
          </button>

          {showOutreach && (
            <div className='mt-3 p-3 bg-[#2a2a2a] rounded-lg border border-gray-700'>
              <h4 className='text-xs font-medium text-white mb-2'>
                Suggested Outreach Message:
              </h4>
              <p className='text-xs text-gray-300 leading-relaxed'>
                {connection.ai_outreach_message ||
                  'No personalized message generated'}
              </p>
              <button className='mt-2 text-xs text-blue-400 hover:text-blue-300'>
                Copy Message
              </button>
            </div>
          )}
        </div>

        <div className='mt-4'>
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
