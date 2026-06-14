import { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { useCategories } from '../context/CategoryContext';
import ProductCard from './ProductCard';

type CategoryFilter = 'all' | number;

export default function ProductGrid() {
  const { products, loading } = useProducts();
  const { categories } = useCategories();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const q = search.toLowerCase().trim();

  const filteredProducts = products
    // Tolérance : si `published` est `undefined` ou `null`, on l'affiche (pour ne pas casser l'affichage
    // si la colonne n'est pas encore renseignée en base)
    .filter((p) => p.published !== false)
    .filter((p) => {
      // Filtre par catégorie : on compare par ID (plus fiable que le slug)
      const matchesCategory = filter === 'all' ? true : p.category_id === filter;

      const matchesSearch =
        !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });

  // Comptes par catégorie (par ID, depuis la base)
  const categoryCounts = products.reduce<Record<number, number>>((acc, p) => {
    if (p.published === false) return acc;
    if (p.category_id == null) return acc;
    acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    return acc;
  }, {});


  // Boutons = catégories venant de Supabase (CategoryContext)
  // On exclut les catégories qui n'ont aucun produit publié.
  const dynamicCategories = categories.filter((c) => (categoryCounts[c.id] ?? 0) > 0);




      return (
        <section id="produits" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 scroll-mt-24">
          {/* Section Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Nos Produits</h2>
            <p className="text-gray-400 text-sm">Sélectionnés avec soin pour vous</p>
          </div>

      {/* Encart de diagnostic (uniquement en dev) */}
      {products.length === 0 && !loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800">
          <strong>Diagnostic :</strong> 0 produit chargé depuis Supabase.
          <ul className="list-disc ml-5 mt-1">
            <li>Vérifiez que la table <code>products</code> existe dans Supabase (Table Editor).</li>
            <li>Vérifiez la policy RLS : <code>SELECT USING (true)</code> sur <code>products</code>.</li>
            <li>Console navigateur (F12) : cherchez les messages <code>[fetchProducts]</code>.</li>
          </ul>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md mx-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap justify-center mb-8">
        {(() => {
          const totalCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
          const buttons: Array<{ key: CategoryFilter; label: string; count: number }> = [
            { key: 'all', label: 'Tous', count: totalCount },
            ...dynamicCategories.map((c) => {
              const label = c.name || c.slug || `Cat\u00e9gorie ${c.id}`;
              return { key: c.id, label, count: categoryCounts[c.id] ?? 0 };
            }),
          ];

          return buttons.map(({ key, label, count }) => (
            <button
              key={String(key)}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'
              }`}
            >
              {label} <span className="ml-1 text-xs opacity-75">({count})</span>
            </button>
          ));
        })()}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {!loading && filteredProducts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <span className="text-5xl block mb-4">🔍</span>
          <p className="text-lg font-medium">Aucun produit trouvé</p>
        </div>
      )}
    </section>
  );
}
