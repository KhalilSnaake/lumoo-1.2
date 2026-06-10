import { products } from '../data/products';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useState } from 'react';
import ProductModal from './ProductModal';
import { Product } from '../types';

const popularIds = [1, 4, 5, 13, 15, 22]; // Top sellers

export default function PopularProducts() {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [addedId, setAddedId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const popular = products.filter(p => popularIds.includes(p.id));
  const formatPrice = (p: number) => p.toLocaleString('fr-FR');

  const handleQuickAdd = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const product = products.find(p => p.id === id);
    if (!product) return;
    addToCart(product);
    setAddedId(id);
    showToast(`${product.name} ajouté au panier ✅`);
    setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">🔥 Produits populaires</h2>
          <p className="text-sm text-gray-400">Les plus commandés par nos clients</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {popular.map(product => (
          <div
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            className="flex-shrink-0 w-52 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 snap-start cursor-pointer"
          >
            <div className="h-36 bg-gray-50 flex items-center justify-center relative overflow-hidden">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
              {product.category === 'legumes' && (
                <span className="absolute top-2 left-2 bg-green-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Frais
                </span>
              )}
              <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
                🔥 TOP
              </span>
            </div>

            <div className="p-3">
              <h4 className="text-sm font-bold text-gray-800 truncate">{product.name}</h4>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="text-base font-extrabold text-green-600">{formatPrice(product.price)}</span>
                  <span className="text-[10px] text-gray-400 ml-0.5 font-bold">F</span>
                </div>
                <button
                  onClick={(e) => handleQuickAdd(e, product.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                    addedId === product.id
                      ? 'bg-green-100 text-green-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {addedId === product.id ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </section>
  );
}
