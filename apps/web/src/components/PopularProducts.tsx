import { useCart, useProducts } from '@lumoo/core';
import type { Product } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import ProductModal from './ProductModal';

export default function PopularProducts() {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { products } = useProducts();
  const [addedId, setAddedId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const autoSlideRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const popular = products.filter(p => p.is_popular === true);
  const formatPrice = (p: number) => p.toLocaleString('fr-FR');

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, popular.length]);

  // Auto-slide
  useEffect(() => {
    if (popular.length === 0) return;
    autoSlideRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = el.querySelector('div')?.clientWidth ?? 220;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 4000);

    return () => {
      if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    };
  }, [popular.length]);

  // Pause auto-slide on hover
  const pauseAutoSlide = () => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
  };
  const resumeAutoSlide = () => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    if (popular.length === 0) return;
    autoSlideRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = el.querySelector('div')?.clientWidth ?? 220;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 4000);
  };

  const scrollLeft = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('div')?.clientWidth ?? 220;
    el.scrollBy({ left: -(cardWidth + 16), behavior: 'smooth' });
  };

  const scrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('div')?.clientWidth ?? 220;
    el.scrollBy({ left: cardWidth + 16, behavior: 'smooth' });
  };

  const handleQuickAdd = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const product = products.find(p => p.id === id);
    if (!product) return;
    addToCart(product);
    setAddedId(id);
    showToast(`${product.name} ajouté au panier ✅`);
    setTimeout(() => setAddedId(null), 1200);
  };

  if (popular.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">🔥 Produits populaires</h2>
          <p className="text-sm text-gray-400">Les plus commandés par nos clients</p>
        </div>
        {/* Navigation arrows */}
        <div className="flex gap-2">
          <button
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              canScrollLeft
                ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:shadow-md'
                : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Défiler à gauche"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              canScrollRight
                ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:shadow-md'
                : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Défiler à droite"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseEnter={pauseAutoSlide}
        onMouseLeave={resumeAutoSlide}
        className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scroll-smooth hide-scrollbar"
      >
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