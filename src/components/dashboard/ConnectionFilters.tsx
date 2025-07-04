'use client';

import { useState, useEffect } from 'react';
import { Connection } from '@/lib/firestoreHelpers';
import { FiSearch, FiX, FiFilter, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface FilterState {
  type: string;
  company: string;
  education: string;
  search: string;
}

interface ConnectionFiltersProps {
  connections: Connection[];
  isArchive?: boolean;
  onFilterChange: (filters: FilterState, isArchive: boolean) => void;
  initialFilters?: FilterState;
}

export function ConnectionFilters({ 
  connections, 
  onFilterChange, 
  isArchive = false, 
  initialFilters 
}: ConnectionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters || {
    type: '',
    company: '',
    education: '',
    search: '',
  });

  // Extract unique companies from connections
  const companies = Array.from(
    new Set(
      connections
        .map((c) => c.company)
        .filter((company): company is string => !!company)
    )
  ).sort();

  useEffect(() => {
    onFilterChange(filters, isArchive);
  }, [filters, onFilterChange, isArchive]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // Save to localStorage
    const storageKey = isArchive ? 'archiveConnectionFilters' : 'connectionFilters';
    localStorage.setItem(storageKey, JSON.stringify(newFilters));
  };

  const clearFilters = () => {
    const clearedFilters = {
      type: '',
      company: '',
      education: '',
      search: '',
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters, isArchive);
    const storageKey = isArchive ? 'archiveConnectionFilters' : 'connectionFilters';
    localStorage.removeItem(storageKey);
  };

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const storageKey = isArchive ? 'archiveConnectionFilters' : 'connectionFilters';
    const savedFilters = localStorage.getItem(storageKey);
    if (savedFilters) {
      const parsedFilters = JSON.parse(savedFilters);
      setFilters(parsedFilters);
      onFilterChange(parsedFilters, isArchive);
    }
  }, [isArchive]);

  const hasPersonConnections = connections.some((c) => c.type !== 'program');
  // Count active filters
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="mb-6">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-white hover:text-zinc-200 mb-2"
      >
        <FiFilter className="h-4 w-4" />
        <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
        {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
      </button>

      {/* Filters Panel */}
      {isExpanded && (
        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search connections..."
                value={filters.search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('search', e.target.value)}
                className="pl-10 w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {filters.search && (
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <FiX className="h-4 w-4 text-zinc-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="academia">Academia</option>
                <option value="industry">Industry</option>
              </select>
            </div>

            {/* Company Filter */}
            <div>
              <select
                value={filters.company}
                onChange={(e) => handleFilterChange('company', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>

            {/* Education Level Filter */}
            {hasPersonConnections && (
              <div className="flex gap-2">
                <select
                  value={filters.education}
                  onChange={(e) => handleFilterChange('education', e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">All Education Levels</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                  <option value="postgraduate">Postgraduate</option>
                </select>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white"
                  title="Clear all filters"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
