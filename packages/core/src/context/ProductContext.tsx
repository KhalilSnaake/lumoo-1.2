import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Product, ProductContextType } from '../types';
import { getSupabase } from '../lib/supabaseClient';
import { products as initialProducts } from '../data/products';

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// Jointure PostgREST : la FK `category_id` hydrate `row.categories` (singulier car 1-N inversé : N produits → 1 cat)
function rowToProduct(row: any): Product {
  // row.categories peut être un objet (single) ou un tableau (multi). On normalise.
  const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;

  // Cas 1 : on a un category_id ET la jointure a remonté la catégorie
  // Cas 2 : fallback local : `row.category` est déjà un objet {name, slug}
  let categoryObj: Product['category'] = null;
  if (row.category_id) {
    categoryObj = {
      id: row.category_id,
      name: cat?.name ?? row.category_name ?? '',
      slug: cat?.slug ?? row.category_slug ?? null,
      createdAt: cat?.created_at ?? undefined,
    };
  } else if (row.category && typeof row.category === 'object') {
    // Fallback local : `row.category` peut être 'alimentaire' (string) ou un objet Category
    if (typeof row.category === 'string') {
      categoryObj = { id: 0, name: row.category, slug: row.category, createdAt: undefined };
    } else {
      categoryObj = {
        id: row.category.id ?? 0,
        name: row.category.name ?? '',
        slug: row.category.slug ?? null,
        createdAt: row.category.createdAt ?? row.category.created_at ?? undefined,
      };
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    unit: row.unit,
    category_id: row.category_id ?? null,
    category: categoryObj,
    image_url: row.image_url || '',
    labels: row.labels || '',
    stock_quantity: row.stock_quantity || 0,
    bgColor: row.bg_color,
    inStock: row.in_stock,
    published: row.published,
    is_popular: row.is_popular ?? false,
    createdAt: row.created_at,
  };
}

export type ProductsPageOpts = { page: number; pageSize: number; categoryId?: number | null; search?: string };

// Pagination SERVEUR du catalogue : ne charge qu'une page (~20) à la fois via .range().
// Additif — ne remplace pas le chargement complet du ProductContext (utilisé par l'admin/web).
// Filtres (catégorie/recherche/published) faits côté serveur pour rester cohérents page à page.
export async function apiGetProductsPage(opts: ProductsPageOpts): Promise<{ products: Product[]; hasMore: boolean }> {
  const supabase = getSupabase();
  const { page, pageSize, categoryId, search } = opts;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select('*, categories(id, name, slug, created_at)')
    .or('published.is.null,published.eq.true')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (categoryId != null) query = query.eq('category_id', categoryId);
  const s = (search ?? '').trim();
  if (s) {
    // Recherche nom OU description. On nettoie le terme (lettres/chiffres/espaces/tirets
    // uniquement) pour qu'aucun caractère ne casse/injecte la syntaxe du filtre `.or`.
    const safe = s.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error || !data) return { products: [], hasMore: false };
  return { products: data.map(rowToProduct), hasMore: data.length === pageSize };
}




export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    const supabase = getSupabase();
    setLoading(true);
    try {
      // 1. Récupérer les produits (sans jointure)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('[fetchProducts] supabase products error', productsError);
        setProducts([]);
        return;
      }

      console.info('[fetchProducts] products count =', productsData?.length ?? 0);

      if (!productsData || productsData.length === 0) {
        setProducts([]);
        return;
      }

      // 2. Récupérer toutes les catégories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug, created_at');

      if (categoriesError) {
        console.warn('[fetchProducts] categories error (on continue sans catégories)', categoriesError);
      }

      // 3. Merger les catégories dans les produits
      const categoriesById = new Map<number, any>();
      (categoriesData ?? []).forEach((c) => categoriesById.set(c.id, c));

      const merged = productsData.map((p) => ({
        ...p,
        categories: p.category_id ? categoriesById.get(p.category_id) ?? null : null,
      }));

      setProducts(merged.map(rowToProduct));
    } catch (err) {
      console.error('[fetchProducts] exception', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = async (p: Omit<Product, 'id' | 'createdAt'>) => {
    const supabase = getSupabase();
    // Résoudre le category_id depuis toutes les sources possibles
    const categoryId =
      p.category_id ??
      (typeof p.category === 'object' && p.category !== null ? p.category.id : null) ??
      null;

    if (!categoryId) {
      console.error('[addProduct] category_id manquant', p);
      return null;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: p.name,
        description: p.description,
        price: p.price,
        unit: p.unit,
        category_id: categoryId,
        image_url: p.image_url,
        labels: p.labels,
        stock_quantity: p.stock_quantity,
        bg_color: p.bgColor,
        in_stock: p.inStock,
        published: p.published,
        is_popular: p.is_popular ?? false,
      })
      .select('*, categories(id, name, slug, created_at)')
      .single();


    if (error || !data) return null;
    const newProd = rowToProduct(data);
    setProducts((prev) => [newProd, ...prev]);
    return newProd;
  };


  const updateProduct = async (id: number, updates: Partial<Product>) => {
    const supabase = getSupabase();
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.category_id !== undefined) {
      dbUpdates.category_id = updates.category_id;
    }
    if (updates.category !== undefined && updates.category && typeof updates.category === 'object') {
      dbUpdates.category_id = updates.category.id;
    }


    if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;
    if (updates.labels !== undefined) dbUpdates.labels = updates.labels;
    if (updates.stock_quantity !== undefined) dbUpdates.stock_quantity = updates.stock_quantity;
    if (updates.bgColor !== undefined) dbUpdates.bg_color = updates.bgColor;
    if (updates.inStock !== undefined) dbUpdates.in_stock = updates.inStock;
    if (updates.published !== undefined) dbUpdates.published = updates.published;
    if (updates.is_popular !== undefined) dbUpdates.is_popular = updates.is_popular;

    // ⚠️ Tentative 1 : update avec TOUS les champs (incluant is_popular)
    let { data, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id)
      .select('*, categories(id, name, slug, created_at)')
      .single();

    // ⚠️ Si une colonne manque en base (ex: is_popular), on identifie laquelle et on retry sans
    if (error && /column .* does not exist/i.test(error.message ?? '')) {
      const m = error.message?.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
      const missingCol = m?.[1];
      if (missingCol && (missingCol in dbUpdates)) {
        console.warn(`[updateProduct] Colonne "${missingCol}" absente en base — retry sans ce champ. Lancez add_popular_column.sql pour corriger.`);
        const { [missingCol]: _omit, ...dbUpdatesFixed } = dbUpdates;
        const retry = await supabase
          .from('products')
          .update(dbUpdatesFixed)
          .eq('id', id)
          .select('*, categories(id, name, slug, created_at)')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[updateProduct] supabase error', error);
      throw error; // Propager l'erreur pour que l'UI affiche le vrai message
    }
    if (!data) {
      throw new Error('Aucune donnée retournée par Supabase');
    }
    const updated = rowToProduct(data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };


  const deleteProduct = async (id: number) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) setProducts(prev => prev.filter(p => p.id !== id));
    return !error;
  };

  const seedProducts = async () => {
    const supabase = getSupabase();
    setLoading(true);

    // seed: map initialProducts.category (alimentaire|legumes) vers categories
    for (const p of initialProducts as any[]) {
      const { data: existing } = await supabase.from('products').select('id').eq('name', p.name).single();
      if (existing) continue;

      // Ensure category exists (slug = 'alimentaire' ou 'legumes')
      const catSlug: string = p.category === 'alimentaire' ? 'alimentaire' : 'legumes';

      const { data: catRow } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', catSlug)
        .single();

      let categoryId: number | null = catRow?.id ?? null;

      if (!categoryId) {
        const { data: created } = await supabase
          .from('categories')
          .insert({ name: catSlug, slug: catSlug })
          .select('id')
          .single();
        categoryId = created?.id ?? null;
      }

      if (!categoryId) {
        console.error('[seedProducts] Impossible de résoudre la catégorie pour', p.name);
        continue;
      }

      await supabase.from('products').insert({
        name: p.name,
        description: p.description,
        price: p.price,
        unit: p.unit,
        category_id: categoryId,
        image_url: p.image_url,
        labels: p.labels || '',
        stock_quantity: p.stock_quantity || 100,
        bg_color: p.bgColor,
        in_stock: p.inStock,
        published: p.published,
      });
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
