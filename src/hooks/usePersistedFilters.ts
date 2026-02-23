import { useState, useEffect } from 'react';

interface FilterState {
  status: string;
  priority: string;
  search: string;
  tags: string[];
  sortBy: 'date' | 'title';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: FilterState = {
  status: '',
  priority: '',
  search: '',
  tags: [],
  sortBy: 'date',
  sortOrder: 'desc'
};

const STORAGE_KEY = 'taskBoardFilters_v2';

export const usePersistedFilters = () => {
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        return {
          ...DEFAULT_FILTERS,
          ...Object.keys(DEFAULT_FILTERS).reduce((acc, key) => {
            if (parsed[key] !== undefined) {
              acc[key] = parsed[key];
            }
            return acc;
          }, {} as Partial<FilterState>)
        };
      }
    } catch (e) {
      console.error('Failed to parse filters from localStorage', e);
    }
    return DEFAULT_FILTERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to localStorage', e);
    }
  }, [filters]);

  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return {
    filters,
    updateFilters,
    resetFilters
  };
};
