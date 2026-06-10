import { createContext, useContext, useState, type ReactNode } from 'react';

type CategoryFilter = 'all' | number;

interface SearchContextType {
  search: string;
  setSearch: (value: string) => void;
  selectedCategory: CategoryFilter;
  setSelectedCategory: (value: CategoryFilter) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  return (
    <SearchContext.Provider value={{ search, setSearch, selectedCategory, setSelectedCategory }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
