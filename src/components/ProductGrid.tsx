import { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import ProductCard from './ProductCard';

type CategoryFilter = 'all' | 'alimentaire' | 'legumes';

export default function ProductGrid() {
  const { products, loading } = useProducts();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const filteredProducts = products
    .filter(p => p.published) // Only show published products to customers
    .filter(p => {
      const matchesCategory = filter === 'all' || p.category === filter;
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });

  const alimentaireCount = products.filter(p => p.category === 'alimentaire' && p.published).length;
  const legumeCount = products.filter(p => p.category === 'legumes' && p.published).length;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Section Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Nos Produits</h2>
        <p className="text-gray-400 text-sm">Sélectionnés avec soin pour vous</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center justify-between">
        <div className="relative w-full sm:w-80">
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

        <div className="flex gap-2">
          {[
            { key: 'all' as CategoryFilter, label: 'Tous', count: alimentaireCount + legumeCount, icon: '🏪' },
            { key: 'alimentaire' as CategoryFilter, label: 'Alimentaires', count: alimentaireCount, icon: '📦' },
            { key: 'legumes' as CategoryFilter, label: 'Légumes', count: legumeCount, icon: '🥬' },
          ].map(({ key, label, count, icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'
              }`}
            >
              {icon} {label} <span className="ml-1 text-xs opacity-75">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div id={filter === 'legumes' ? 'legumes' : 'produits'} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
