'use client';

import type { PersonalizationSettings } from './types';

export interface PersonalizationModalProps {
  open: boolean;
  settings: PersonalizationSettings;
  onClose: () => void;
  onChange: (next: PersonalizationSettings) => void;
  onSave: () => void;
}

export function PersonalizationModal({
  open,
  settings,
  onClose,
  onChange,
  onSave,
}: PersonalizationModalProps) {
  if (!open) return null;

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50'>
      <div className='bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md border border-gray-700'>
        <h3 className='text-white text-xl font-bold mb-6'>
          Personalize Your Connections
        </h3>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <span className='text-white font-medium'>
              Enable Personalization
            </span>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.enabled}
                onChange={(e) =>
                  onChange({ ...settings, enabled: e.target.checked })
                }
                className='sr-only peer'
              />
              <div className='w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600'></div>
            </label>
          </div>

          <div>
            <label
              className={`block font-medium mb-2 ${
                settings.enabled ? 'text-white' : 'text-gray-500'
              }`}
            >
              Professional Interests
            </label>
            <textarea
              value={settings.professionalInterests}
              onChange={(e) =>
                onChange({ ...settings, professionalInterests: e.target.value })
              }
              disabled={!settings.enabled}
              placeholder='Describe your professional interests...'
              className={`w-full h-24 px-3 py-2 border rounded-lg focus:outline-none ${
                settings.enabled
                  ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-gray-800 border-gray-700 text-gray-500 placeholder-gray-600 cursor-not-allowed'
              }`}
            />
          </div>

          <div>
            <label
              className={`block font-medium mb-2 ${
                settings.enabled ? 'text-white' : 'text-gray-500'
              }`}
            >
              Personal Interests & Hobbies
            </label>
            <textarea
              value={settings.personalInterests}
              onChange={(e) =>
                onChange({ ...settings, personalInterests: e.target.value })
              }
              disabled={!settings.enabled}
              placeholder='Describe your hobbies and personal interests...'
              className={`w-full h-24 px-3 py-2 border rounded-lg focus:outline-none ${
                settings.enabled
                  ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-gray-800 border-gray-700 text-gray-500 placeholder-gray-600 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
