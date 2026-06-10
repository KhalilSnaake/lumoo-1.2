import Logo from './Logo';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';

export default function Footer({ onOpenTracker }: { onOpenTracker: () => void }) {
  return (
    <footer id="apropos" className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <a 
              href="/" 
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity inline-flex group"
            >
              <Logo size={44} />
              <span className="text-xl font-bold text-white group-hover:scale-105 transition-transform">Lumoo</span>
            </a>
            <p className="text-sm text-gray-400">
              Votre marché en ligne pour des produits alimentaires de qualité et des légumes frais livrés chez vous.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">Produits</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-green-400 transition-colors">Riz & Céréales</a></li>
              <li><a href="#" className="hover:text-green-400 transition-colors">Huiles & Graisses</a></li>
              <li><a href="#" className="hover:text-green-400 transition-colors">Sucre & Douceurs</a></li>
              <li><a href="#" className="hover:text-green-400 transition-colors">Légumes Frais</a></li>
            </ul>
          </div>

          {/* Payment */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">Paiement</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-3">
                  <OrangeMoneyLogo className="w-7 h-7 shadow-sm border border-gray-700" />
                  Orange Money
                </li>
                <li className="flex items-center gap-3">
                  <MoovMoneyLogo className="w-7 h-7 shadow-sm border border-gray-700" />
                  Moov Money
                </li>
                <li className="flex items-center gap-3">
                  <WaveLogo className="w-7 h-7 shadow-sm border border-gray-700" />
                  Wave
                </li>
                <li className="flex items-center gap-3">
                  <CashLogo className="w-7 h-7 shadow-sm border border-gray-700" />
                  À la livraison
                </li>
              </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span>📞</span> +223 77 99 68 58
              </li>
              <li className="flex items-center gap-2">
                <span>📧</span> contact@lumoo.ml
              </li>
              <li className="flex items-center gap-2">
                <span>📍</span> Bamako, Mali
              </li>
              <li className="flex items-center gap-2">
                <span>🕐</span> Lun - Sam : 7h - 20h
              </li>
            </ul>

            {/* Suivi commande */}
            <button
              onClick={onOpenTracker}
              className="mt-4 w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              📍 Suivre ma commande
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500">
          <p>© 2025 Lumoo. Tous droits réservés.</p>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <p>Fait avec 💚 au Mali</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
