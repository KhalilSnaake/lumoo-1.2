import { useCart } from '../context/CartContext';

export default function HeroSection() {
  const { setIsCartBuilderOpen, totalItems } = useCart();
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-500 to-teal-600 text-white">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-6xl animate-float">🥬</div>
        <div className="absolute top-20 right-20 text-5xl animate-float-delayed">🍅</div>
        <div className="absolute bottom-10 left-1/4 text-4xl animate-float">🥕</div>
        <div className="absolute bottom-20 right-1/3 text-6xl animate-float-delayed">🌾</div>
        <div className="absolute top-1/2 left-1/2 text-5xl animate-float">🍚</div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            Livraison rapide à domicile
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Vos courses en ligne,
            <br />
            <span className="text-yellow-300">livrées chez vous</span>
          </h2>
          <p className="text-lg sm:text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Produits alimentaires de qualité et légumes frais sélectionnés avec soin.
            Commandez et payez facilement par Mobile Money.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* MAIN CTA: Créer mon panier */}
            <button
              onClick={() => setIsCartBuilderOpen(true)}
              className="group relative px-8 py-4 bg-white text-green-700 font-extrabold rounded-full hover:shadow-2xl hover:shadow-white/30 transition-all hover:scale-105 active:scale-95 text-base"
            >
              <span className="flex items-center gap-2 justify-center">
                🛒
                Créer mon panier
                {totalItems > 0 && (
                  <span className="ml-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={() => scrollTo('produits')}
              className="px-8 py-3.5 bg-white/20 backdrop-blur-sm text-white font-bold rounded-full hover:bg-white/30 transition-all hover:scale-105 active:scale-95 border border-white/30 text-sm"
            >
              🥬 Voir les Produits
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold">200+</div>
            <div className="text-green-200 text-xs sm:text-sm">Produits</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold">24h</div>
            <div className="text-green-200 text-xs sm:text-sm">Livraison</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold">100%</div>
            <div className="text-green-200 text-xs sm:text-sm">Frais</div>
          </div>
        </div>
      </div>

      {/* Wave shape */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 40L48 35C96 30 192 20 288 22C384 24 480 38 576 44C672 50 768 48 864 42C960 36 1056 26 1152 24C1248 22 1344 28 1392 31L1440 34V80H0V40Z" fill="white"/>
        </svg>
      </div>
    </section>
  );
}
