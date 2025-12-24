'use client';

import BorderMagicButton from '@/components/ui/BorderMagicButton';
import { Clock, Sparkles } from 'lucide-react';

export interface DashboardHeaderProps {
  pendingCount?: number;
  pendingLoaded: boolean;
  onReset: () => void;
  onOpenPending: () => void;
  onOpenPersonalization: () => void;
  onSignOut: () => void;
}

export function DashboardHeader({
  pendingCount,
  pendingLoaded,
  onReset,
  onOpenPending,
  onOpenPersonalization,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <div className='flex justify-between items-center mb-8'>
      <button
        onClick={onReset}
        className='bg-[#2a2a2a] hover:bg-[#3a3a3a] inline-block p-4 rounded-xl transition-colors cursor-pointer'
      >
        <h1 className='text-white text-2xl font-mono'>Refr ☕️</h1>
      </button>

      <div className='flex items-center gap-4'>
        <button
          onClick={onOpenPending}
          className='bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border border-gray-700'
        >
          <Clock className='w-4 h-4' />
          View {pendingLoaded ? `${pendingCount ?? 0} ` : ''}Pending Connections
        </button>

        <BorderMagicButton
          onClick={onOpenPersonalization}
          className='flex items-center gap-2 font-medium rounded-lg'
        >
          <Sparkles className='w-4 h-4' />
          Personalize Connection-Finding Agent
        </BorderMagicButton>

        <button
          onClick={onSignOut}
          className='bg-[#2a2a2a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm'
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default DashboardHeader;
