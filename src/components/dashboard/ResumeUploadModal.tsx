'use client';

import { FileUpload } from '@/components/ui/FileUpload';

export interface ResumeUploadModalProps {
  open: boolean;
  file: File | null;
  uploading: boolean;
  uploadError: string;
  uploadSuccess: boolean;
  onClose: () => void;
  onFileChange: (file: File) => void;
  onUpload: () => void;
}

export function ResumeUploadModal({
  open,
  uploading,
  uploadError,
  uploadSuccess,
  onClose,
  onFileChange,
  onUpload,
}: ResumeUploadModalProps) {
  if (!open) return null;

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
      <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md border border-gray-700'>
        <h3 className='text-white text-xl font-bold mb-6'>Update Resume</h3>

        <div className='space-y-4'>
          <FileUpload
            onChange={(files) => {
              if (files && files.length) onFileChange(files[0]);
            }}
            title='Select Resume'
            description='Upload your updated resume to improve connection finding'
          />

          {uploadError && (
            <div className='text-red-500 text-sm'>{uploadError}</div>
          )}

          {uploadSuccess && (
            <div className='text-green-500 text-sm'>
              Resume updated successfully!
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={onUpload}
            disabled={uploading}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors'
          >
            {uploading ? 'Uploading...' : 'Update Resume'}
          </button>
        </div>
      </div>
    </div>
  );
}
