import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Product, ProductContextType } from '../types';
import { supabase } from '../lib/supabase';
import { products as initialProducts } from '../data/products';

const ProductContext = createContext<ProductContextType | undefined>(undefined);

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    unit: row.unit,
    category: row.category,
    image_url: row.image_url || '',
    labels: row.labels || '',
    stock_quantity: row.stock_quantity || 0,
    bgColor: row.bg_color,
    inStock: row.in_stock,
    published: row.published,
    createdAt: row.created_at,
  };
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!error && data) setProducts(data.map(rowToProduct));
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = async (p: Omit<Product, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase.from('products').insert({
      name: p.name,
      description: p.description,
      price: p.price,
      unit: p.unit,
      category: p.category,
      image_url: p.image_url,
      labels: p.labels,
      bg_color: p.bgColor,
      in_stock: p.inStock,
      published: p.published
    }).select().single();
    if (error || !data) return null;
    const newProd = rowToProduct(data);
    setProducts(prev => [newProd, ...prev]);
    return newProd;
  };

  const updateProduct = async (id: number, updates: Partial<Product>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;
    if (updates.labels !== undefined) dbUpdates.labels = updates.labels;
    if (updates.bgColor !== undefined) dbUpdates.bg_color = updates.bgColor;
    if (updates.inStock !== undefined) dbUpdates.in_stock = updates.inStock;
    if (updates.published !== undefined) dbUpdates.published = updates.published;

    const { data, error } = await supabase.from('products').update(dbUpdates).eq('id', id).select().single();
    if (error || !data) return null;
    const updated = rowToProduct(data);
    setProducts(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  };

  const deleteProduct = async (id: number) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) setProducts(prev => prev.filter(p => p.id !== id));
    return !error;
  };

  const seedProducts = async () => {
    setLoading(true);
    for (const p of initialProducts) {
      const { data } = await supabase.from('products').select('id').eq('name', p.name).single();
      if (!data) {
        await supabase.from('products').insert({
          name: p.name,
          description: p.description,
          price: p.price,
          unit: p.unit,
          category: p.category,
          image_url: p.image_url,
          labels: p.labels || '',
          stock_quantity: p.stock_quantity || 100,
          bg_color: p.bgColor,
          in_stock: p.inStock,
          published: p.published
        });
      }
    }
    await fetchProducts();
    setLoading(false);
  };

  return (
    <ProductContext.Provider value={{ products, loading, fetchProducts, addProduct, updateProduct, deleteProduct, seedProducts }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProducts must be used within ProductProvider');
  return ctx;
}
