import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useState } from 'react';
import ProductModal from './ProductModal';
import { optimizeImageUrl } from '../utils/images';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const { showToast } = useToast();
  const [added, setAdded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const cartItem = items.find(item => item.product.id === product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product);
    setAdded(true);
    showToast(`${product.name} ajouté au panier ✅`);
    setTimeout(() => setAdded(false), 1500);
  };

  const formatPrice = (price: number) => price.toLocaleString('fr-FR');

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="group bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer"
      >
        {/* Product Image Area */}
        <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
          {/* Skeleton loader */}
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img 
            src={optimizeImageUrl(product.image_url, 'card')} 
            alt={product.name} 
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {/* Étiquettes dynamiques avec icônes et couleurs */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            {(typeof product.category === 'string'
              ? product.category === 'legumes'
              : product.category?.slug === 'legumes') && (
              <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1">
                <span>🥬</span> FRAIS
              </span>
            )}
            {product.labels?.split(',').map((label, idx) => {
              const text = label.trim().toLowerCase();
              if (!text) return null;

              // Styles par défaut
              let config = { bg: 'bg-green-500', icon: '✨' };

              if (text === 'top') config = { bg: 'bg-orange-500', icon: '🔥' };
              if (text === 'promo') config = { bg: 'bg-red-500', icon: '🏷️' };
              if (text === 'bio') config = { bg: 'bg-lime-600', icon: '🌿' };
              if (text === 'nouveau') config = { bg: 'bg-blue-600', icon: '💎' };
              if (text === 'saison') config = { bg: 'bg-amber-500', icon: '☀️' };
              if (text === 'local') config = { bg: 'bg-teal-600', icon: '🇲🇱' };

              return (
                <span key={idx} className={`${config.bg} text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1`}>
                  <span>{config.icon}</span> {label.trim().toUpperCase()}
                </span>
              );
            })}
          </div>
          
          {cartItem && (
            <span className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md animate-bounce-in">
              ×{cartItem.quantity}
            </span>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1 truncate">
            {product.name}
          </h3>
          <p className="text-xs text-gray-400 mb-3 line-clamp-2 flex-1 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-extrabold text-green-600">
                {formatPrice(product.price)}
              </span>
              <span className="text-[10px] text-gray-400 ml-1 font-bold">F / {product.unit}</span>
            </div>
            <button
              onClick={handleAdd}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                added
                  ? 'bg-green-100 text-green-600 scale-110'
                  : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:shadow-green-200 shadow-sm'
              }`}
            >
              {added ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {showModal && <ProductModal product={product} onClose={() => setShowModal(false)} />}
    </>
  );
}
