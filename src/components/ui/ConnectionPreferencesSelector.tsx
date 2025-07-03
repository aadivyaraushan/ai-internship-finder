import React from 'react';

export interface ConnectionPreferences {
  connections: boolean; // people
  programs: boolean;
}

interface Props {
  value: ConnectionPreferences;
  /**
   * Called whenever either checkbox toggles.
   */
  onChange: (newValue: ConnectionPreferences) => void;
  /**
   * Optional extra classes for the container div.
   */
  className?: string;
  /**
   * Layout direction – row (default) or column.
   */
  direction?: 'row' | 'column';
}

/**
 * Reusable checkbox group allowing users to choose whether to include
 * people, programs, or both when searching for connections.
 */
const ConnectionPreferencesSelector: React.FC<Props> = ({
  value,
  onChange,
  className = '',
  direction = 'row',
}) => {
  const toggle = (key: keyof ConnectionPreferences) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const containerClass =
    direction === 'row'
      ? 'flex gap-4 ' + className
      : 'flex flex-col gap-2 ' + className;

  const checkboxClasses = 'accent-blue-500';

  return (
    <div className={containerClass}>
      <label className='flex items-center gap-2 text-gray-300'>
        <input
          type='checkbox'
          checked={value.connections}
          onChange={() => toggle('connections')}
          className={checkboxClasses}
        />
        People
      </label>
      <label className='flex items-center gap-2 text-gray-300'>
        <input
          type='checkbox'
          checked={value.programs}
          onChange={() => toggle('programs')}
          className={checkboxClasses}
        />
        Programs
      </label>
    </div>
  );
};

export default ConnectionPreferencesSelector;
