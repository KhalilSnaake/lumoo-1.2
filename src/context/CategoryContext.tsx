import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
  id: number;
  name: string;
  slug?: string | null;
  created_at?: string;
}

export type CategoryContextType = {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  addCategory: (input: { name: string }) => Promise<Category | null>;
  updateCategory: (id: number, updates: { name?: string }) => Promise<Category | null>;
  deleteCategory: (id: number) => Promise<boolean>;
};


const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_at: row.created_at,
  };
}


function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setCategories(data.map(rowToCategory));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (input: { name: string }) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: input.name,
        slug: slugify(input.name),
      })
      .select()
      .single();

    if (error || !data) return null;
    const c = rowToCategory(data);
    setCategories((prev) => [c, ...prev]);
    return c;
  };

  const updateCategory = async (id: number, updates: { name?: string }) => {
    const slug = updates.name !== undefined ? slugify(updates.name) : undefined;

    const { data, error } = await supabase
      .from('categories')
      .update({
        ...(updates.name !== undefined ? { name: updates.name, slug } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    const c = rowToCategory(data);
    setCategories((prev) => prev.map((x) => (x.id === id ? c : x)));
    return c;
  };

  const deleteCategory = async (id: number) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) setCategories((prev) => prev.filter((c) => c.id !== id));
    return !error;
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        fetchCategories,
        addCategory,
        updateCategory,
        deleteCategory,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error('useCategories must be used within CategoryProvider');
  return ctx;
}



