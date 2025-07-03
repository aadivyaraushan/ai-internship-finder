'use client';

import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionFilters } from './ConnectionFilters';

export interface ArchiveConnectionFiltersProps {
  connections: Connection[];
  onFilterChange: (filters: {
    type: string;
    company: string;
    education: string;
    search: string;
  }) => void;
  initialFilters?: {
    type: string;
    company: string;
    education: string;
    search: string;
  };
}

// Thin wrapper around ConnectionFilters which forces isArchive to true.
export function ArchiveConnectionFilters({ connections, onFilterChange, initialFilters }: ArchiveConnectionFiltersProps) {
  return (
    <ConnectionFilters
      connections={connections}
      isArchive={true}
      onFilterChange={(filters) => onFilterChange(filters)}
      initialFilters={initialFilters}
    />
  );
}

export default ArchiveConnectionFilters;
