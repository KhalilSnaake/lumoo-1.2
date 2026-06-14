import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Ad, AdContextType } from '../types';
import { getSupabase } from '../lib/supabaseClient';

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAds = useCallback(async () => {
    const supabase = getSupabase();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) setAds(data);
    } catch (err) {
      console.error('Fetch Ads Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const addAd = async (adData: Omit<Ad, 'id' | 'created_at'>) => {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('ads')
        .insert([adData])
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setAds(prev => [data, ...prev]);
        return data;
      }
      return null;
    } catch (err: any) {
      alert('Erreur Ajout : ' + err.message);
      return null;
    }
  };

  const updateAd = async (id: string, updates: Partial<Ad>) => {
    const supabase = getSupabase();
    try {
      // On ne garde que les champs autorisés pour éviter les erreurs de colonnes inconnues
      const cleanUpdates: any = {};
      if (updates.title !== undefined) cleanUpdates.title = updates.title;
      if (updates.image_url !== undefined) cleanUpdates.image_url = updates.image_url;
      if (updates.link_url !== undefined) cleanUpdates.link_url = updates.link_url;
      if (updates.position !== undefined) cleanUpdates.position = updates.position;
      if (updates.active !== undefined) cleanUpdates.active = updates.active;

      const { data, error } = await supabase
        .from('ads')
        .update(cleanUpdates)
        .eq('id', id)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedRow = data[0];
        setAds(prev => prev.map(a => a.id === id ? updatedRow : a));
        return updatedRow;
      } else {
        // Si Supabase ne renvoie rien, on rafraîchit tout pour être sûr
        await fetchAds();
        return { id, ...updates } as Ad;
      }
    } catch (err: any) {
      alert('Détail de l\'erreur Supabase : ' + err.message);
      return null;
    }
  };

  const deleteAd = async (id: string) => {
    const supabase = getSupabase();
    try {
      const { error } = await supabase.from('ads').delete().eq('id', id);
      if (error) throw error;
      setAds(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err: any) {
      alert('Erreur Suppression : ' + err.message);
      return false;
    }
  };

  const seedAds = async () => {
    const supabase = getSupabase();
    try {
      const sample = [
        { title: 'Promo Riz Premium', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=1200&h=400&fit=crop', position: 'top', active: true },
        { title: 'Légumes du jour', image_url: 'https://images.unsplash.com/photo-1518977676601-b53f02bad6d5?q=80&w=1200&h=400&fit=crop', position: 'middle', active: true },
        { title: 'Livraison Rapide', image_url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?q=80&w=1200&h=400&fit=crop', position: 'footer', active: true }
      ];
      await supabase.from('ads').insert(sample);
      await fetchAds();
    } catch (err: any) {
      console.error('Seed Ads Error:', err);
    }
  };

  return (
    <AdContext.Provider value={{ ads, loading, fetchAds, addAd, updateAd, deleteAd, seedAds }}>
      {children}
    </AdContext.Provider>
  );
}

export function useAds() {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAds must be used within AdProvider');
  return ctx;
}
