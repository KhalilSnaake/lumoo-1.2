import { useCart } from '@lumoo/core';
import { useState, useEffect } from 'react';

export default function FloatingCartButton() {
  const { setIsCartBuilderOpen, totalItems, totalPrice } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const formatPrice = (p: number) => p.toLocaleString('fr-FR');

  return (
    <button
      onClick={() => setIsCartBuilderOpen(true)}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white pl-5 pr-6 py-3.5 rounded-full shadow-2xl shadow-green-300/40 hover:shadow-green-400/50 transition-all hover:scale-105 active:scale-95 animate-slide-up"
    >
      <div className="relative">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-3 w-5 h-5 bg-red-500 text-[10px] rounded-full flex items-center justify-center font-bold animate-bounce">
            {totalItems}
          </span>
        )}
      </div>
      <div className="text-left hidden sm:block">
        <p className="text-xs font-bold leading-tight">Créer mon panier</p>
        {totalItems > 0 && (
          <p className="text-[10px] text-green-200">{formatPrice(totalPrice)} FCFA</p>
        )}
      </div>
    </button>
  );
}
