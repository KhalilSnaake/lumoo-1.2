import { useCart } from '@lumoo/core';
import type { Product } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import { useState } from 'react';
import { optimizeImageUrl } from '../utils/images';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const { addToCart, items } = useCart();
  const { showToast } = useToast();
  const [qty, setQty] = useState(1);

  const cartItem = items.find(i => i.product.id === product.id);
  const formatPrice = (p: number) => p.toLocaleString('fr-FR');

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);
    showToast(`${qty}× ${product.name} ajouté au panier`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">
        {/* Image */}
        <div className="h-96 flex items-center justify-center relative bg-gray-50 overflow-hidden">
          <img src={optimizeImageUrl(product.image_url, 'modal')} alt={product.name} className="w-full h-full object-contain" />
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.category === 'legumes' && (
              <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-lg flex items-center gap-1.5">
                <span>🥬</span> FRAIS
              </span>
            )}
            {product.labels?.split(',').map((label, idx) => {
              const text = label.trim().toLowerCase();
              if (!text) return null;
              let bg = 'bg-green-500';
              let icon = '✨';
              if (text === 'top') { bg = 'bg-orange-500'; icon = '🔥'; }
              if (text === 'promo') { bg = 'bg-red-500'; icon = '🏷️'; }
              if (text === 'bio') { bg = 'bg-lime-600'; icon = '🌿'; }
              if (text === 'local') { bg = 'bg-teal-600'; icon = '🇲🇱'; }
              return (
                <span key={idx} className={`${bg} text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-lg flex items-center gap-1.5`}>
                  <span>{icon}</span> {label.trim().toUpperCase()}
                </span>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800">{product.name}</h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-green-600">{formatPrice(product.price)}</span>
            <span className="text-sm text-gray-400 font-medium">FCFA</span>
            <span className="text-xs text-gray-400 ml-1">/ {product.unit}</span>
          </div>

          {cartItem && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 font-medium flex items-center gap-2">
              <span className="animate-pulse">🛒</span> Déjà {cartItem.quantity} dans votre panier
            </div>
          )}

          {/* Quantity + Add */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-600 hover:text-red-500 transition-all font-bold text-lg shadow-sm"
              >
                −
              </button>
              <span className="w-10 text-center text-lg font-extrabold text-gray-800">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-600 hover:text-green-500 transition-all font-bold text-lg shadow-sm"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
            >
              <span className="text-xs uppercase opacity-80 font-black">Ajouter au panier</span>
              <span className="text-sm font-bold">{formatPrice(product.price * qty)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
