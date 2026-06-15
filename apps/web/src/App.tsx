import { useState } from 'react';
import {
  CartProvider, useCart,
  OrderProvider,
  ProductProvider, useProducts,
  CategoryProvider, useCategories,
  AdProvider,
  AuthProvider, useAuth,
  NotificationProvider,
  SearchProvider,
} from '@lumoo/core';
import { ToastProvider } from './context/ToastContext';
import { ContactMessagesProvider } from './context/ContactMessagesContext';

import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import CartBuilder from './components/CartBuilder';
import FloatingCartButton from './components/FloatingCartButton';
import AdminPanel from './components/AdminPanel';
import UserManagement from './components/UserManagement';
import UserDashboard from './components/UserDashboard';
import WhatsAppButton from './components/WhatsAppButton';
import PopularProducts from './components/PopularProducts';
import Testimonials from './components/Testimonials';
import AuthPage from './components/AuthPage';
import Footer from './components/Footer';
import OrderTracker from './components/OrderTracker';
import AdBanner from './components/AdBanner';
import ContactForm from './components/ContactForm';
import ResetPasswordModal from './components/ResetPasswordModal';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <CategoryProvider>
            <ProductProvider>
              <SearchProvider>
                <AdProvider>
                  <CartProvider>
                    <OrderProvider>
                      <ContactMessagesProvider>
                        <MainApp />
                      </ContactMessagesProvider>
                    </OrderProvider>
                  </CartProvider>
                </AdProvider>
              </SearchProvider>
            </ProductProvider>
          </CategoryProvider>
        </NotificationProvider>
      </AuthProvider>

    </ToastProvider>
  );
}

function MainApp() {
  const { user, showAuth, setShowAuth, passwordRecovery } = useAuth();
  const { products } = useProducts();
  const { categories } = useCategories();
  const [showAdmin, setShowAdmin] = useState<string | boolean>(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showDashboard, setShowDashboard] = useState<string | boolean>(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);

  // Expose admin open to window for quick access from dashboard
  (window as any).openAdmin = () => setShowAdmin(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TEMP — repère de vérification du déploiement monorepo. À RETIRER après confirmation. */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
        ✅ Nouvelle version en ligne (monorepo)
      </div>
      <Header
        onOpenAdmin={(orderId) => user?.role === 'admin' && setShowAdmin(orderId || true)} 
        onOpenTracker={() => setShowTracker(true)}
        onOpenDashboard={() => setShowDashboard(true)}
        onOpenOrder={(id) => setShowDashboard(id)}
        onOpenContact={() => setShowContactForm(true)}
      />
      <HeroSection />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdBanner position="top" />
      </div>

      <PopularProducts />
      
      <ProductGrid />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdBanner position="middle" />
      </div>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-y border-green-100">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <span className="text-4xl block mb-3">🛒</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Composez votre panier</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">Sélectionnez les produits alimentaires et légumes frais de votre choix, puis validez votre commande en un clic.</p>
          <CreateCartButton />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '🚚', title: 'Livraison Rapide', description: 'Recevez vos produits en moins de 24h à domicile.' },
            { icon: '✅', title: 'Produits Frais', description: 'Légumes sélectionnés et contrôlés chaque jour.' },
            { icon: '💳', title: 'Paiement Mobile', description: 'Orange Money, Moov Money, Wave ou à la livraison.' },
            { icon: '💰', title: 'Meilleurs Prix', description: 'Des prix compétitifs et des promotions régulières.' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1">
              <span className="text-3xl block mb-3">{f.icon}</span>
              <h3 className="font-bold text-gray-800 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Testimonials />

      <Footer
        onOpenTracker={() => setShowTracker(true)}
        products={products}
        categories={categories}
      />

      {showTracker && <OrderTracker onClose={() => setShowTracker(false)} />}

      <CartSidebar />
      <CartBuilder />
      <FloatingCartButton />
      <WhatsAppButton />

      {showAdmin && <AdminPanel initialOrderId={typeof showAdmin === 'string' ? showAdmin : undefined} onClose={() => setShowAdmin(false)} />}
      {showUsers && <UserManagement onClose={() => setShowUsers(false)} />}
      {showDashboard && <UserDashboard initialOrderId={typeof showDashboard === 'string' ? showDashboard : undefined} onClose={() => setShowDashboard(false)} />}

      {/* Contact Form Modal */}
      {showContactForm && <ContactForm onClose={() => setShowContactForm(false)} />}

      {/* Reset password (après clic sur le lien email) */}
      {passwordRecovery && <ResetPasswordModal />}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAuth(false)} />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-slide-up">
            <button onClick={() => setShowAuth(false)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <AuthPage />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateCartButton() {
  const { setIsCartBuilderOpen, totalItems, totalPrice } = useCart();
  const formatPrice = (p: number) => p.toLocaleString('fr-FR');
  return (
    <button onClick={() => setIsCartBuilderOpen(true)} className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold rounded-full hover:shadow-2xl hover:shadow-green-200 transition-all hover:scale-105 active:scale-95 text-base">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
      Créer mon panier
      {totalItems > 0 && (
        <span className="flex items-center gap-2 ml-2 pl-3 border-l border-white/30">
          <span className="w-6 h-6 bg-white text-green-600 text-xs rounded-full flex items-center justify-center font-bold">{totalItems}</span>
          <span className="text-sm font-bold">{formatPrice(totalPrice)} FCFA</span>
        </span>
      )}
    </button>
  );
}
