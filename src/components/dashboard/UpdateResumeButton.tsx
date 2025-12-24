'use client';

import { Upload } from 'lucide-react';

export function UpdateResumeButton({ onClick }: { onClick: () => void }) {
  return (
    <div className='fixed bottom-6 right-6'>
      <button
        onClick={onClick}
        className='bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-lg border border-gray-700'
      >
        <Upload className='w-4 h-4' />
        Update Resume
      </button>
    </div>
  );
}
