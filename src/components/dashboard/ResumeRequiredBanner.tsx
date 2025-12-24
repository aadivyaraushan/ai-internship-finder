'use client';

import { Upload } from 'lucide-react';

export function ResumeRequiredBanner({
  message,
  onUploadClick,
}: {
  message: string;
  onUploadClick: () => void;
}) {
  return (
    <div className='max-w-2xl mx-auto mb-8'>
      <div className='bg-red-900/20 border border-red-700 rounded-lg p-4'>
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0 mt-1'>
            <Upload className='w-5 h-5 text-red-400' />
          </div>
          <div>
            <h4 className='text-red-300 font-medium mb-1'>Resume Required</h4>
            <p className='text-red-200 text-sm mb-3'>{message}</p>
            <button
              onClick={onUploadClick}
              className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2'
            >
              <Upload className='w-4 h-4' />
              Upload Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
