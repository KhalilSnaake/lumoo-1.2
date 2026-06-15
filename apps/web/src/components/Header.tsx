import { useState, useRef, useEffect } from 'react';
import { useCart, useAuth, useNotifications, useSearch } from '@lumoo/core';


import Logo from './Logo';
import NotificationMenu from './NotificationMenu';

export default function Header({ onOpenAdmin, onOpenTracker, onOpenDashboard, onOpenOrder, onOpenContact }: { onOpenAdmin: (orderId?: string) => void; onOpenTracker: () => void; onOpenDashboard: () => void; onOpenOrder?: (id: string) => void; onOpenContact?: () => void }) {
  const { totalItems, setIsCartOpen, setIsCartBuilderOpen } = useCart();
  const { user, isLoggedIn, logout, setShowAuth } = useAuth();
  const { unreadCount } = useNotifications();
  const { search, setSearch } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeAnd = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const roleColors: Record<string, string> = { admin: 'bg-red-100 text-red-700', client: 'bg-blue-100 text-blue-700', livreur: 'bg-orange-100 text-orange-700' };
  const roleNames: Record<string, string> = { admin: 'admin', client: 'Client', livreur: 'Livreur' };

  // Handle click outside user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSimpleUser = !isLoggedIn || user?.role === 'client';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Clickable to Home/Top */}
            <a 
              href="/" 
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity group"
            >
              <Logo size={170} />
            </a>

            {/* Desktop Search */}
            <div className="hidden md:block flex-1 max-w-xs mx-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
              <a href="#produits" className="hover:text-green-600 transition-colors text-xs font-bold uppercase tracking-wider">Nos Produits</a>
              <button onClick={onOpenContact} className="hover:text-green-600 transition-colors text-xs font-bold uppercase tracking-wider">Nous Contacter</button>
              
              {user?.role !== 'livreur' && (
                <button onClick={onOpenTracker} className="hover:text-green-600 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="text-sm">📍</span> Suivre ma commande
                </button>
              )}
            </nav>

              {/* Desktop: Utilities + Cart + Auth */}
              <div className="hidden md:flex items-center gap-3">
                {/* Notification Button */}
                {isLoggedIn && (
                  <button 
                    onClick={() => setShowNotifMenu(true)}
                    className="relative w-10 h-10 flex items-center justify-center text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-black ring-2 ring-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )}

              {/* Main CTA: Créer mon panier - Only for simple users/clients */}
              {isSimpleUser && (
                <div className="flex items-center gap-2 mr-1">
                  <button 
                    onClick={() => setIsCartBuilderOpen(true)} 
                    className="relative flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2.5 rounded-full text-sm font-black hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-105 active:scale-95 shadow-md uppercase tracking-tighter"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12m6-6H6" />
                    </svg>
                    <span>Créer mon panier</span>
                  </button>

                  <button 
                    onClick={() => setIsCartOpen(true)} 
                    className="relative flex items-center gap-2 bg-white border-2 border-green-500 text-green-600 px-4 py-2 rounded-full text-sm font-black hover:bg-green-50 transition-all active:scale-95 shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-bounce shadow-md">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Auth Button with Dropdown */}
              {isLoggedIn && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button 
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full pl-1.5 pr-2 py-1 hover:bg-gray-100 transition-all group shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-sm shrink-0 border border-gray-100">
                      {user.avatar.startsWith('http') ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.avatar
                      )}
                    </div>
                    <div className="flex flex-col items-start leading-none pr-1">
                      <span className="text-[11px] font-black text-gray-800 truncate max-w-[100px]">{user.name}</span>
                      <span className="text-[8px] font-bold text-gray-400 mt-0.5 tracking-tighter uppercase">{roleNames[user.role]}</span>
                    </div>
                    <svg className={`w-3 h-3 text-gray-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-50 animate-bounce-in origin-top-right overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-50 mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 text-lg shrink-0 border border-gray-100">
                          {user.avatar.startsWith('http') ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.avatar
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 truncate">{user.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      
                      <div className="px-2 space-y-1">
                        <button onClick={() => { setUserMenuOpen(false); onOpenDashboard(); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-3 transition-all rounded-2xl">
                          <span className="text-lg">🏡</span> Mon compte
                        </button>
                        
                        {user.role === 'admin' && (
                          <button onClick={() => { setUserMenuOpen(false); onOpenAdmin(); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all rounded-2xl">
                            <span className="text-lg">⚙️</span> Tableau de bord
                          </button>
                        )}
                      </div>

                      <div className="border-t border-gray-50 mt-2 pt-2 px-2">
                        <button onClick={() => { setUserMenuOpen(false); logout(); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-all rounded-2xl">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 border-green-500 text-green-600 hover:bg-green-500 hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Connexion
                </button>
              )}
            </div>

            {/* Mobile: Icons */}
            <div className="flex md:hidden items-center gap-1">
              {isLoggedIn && (
                <button onClick={() => setShowNotifMenu(true)} className="relative w-10 h-10 flex items-center justify-center text-gray-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold ring-2 ring-white">{unreadCount}</span>}
                </button>
              )}
              {isSimpleUser && (
                <button onClick={() => setIsCartOpen(true)} className="relative w-10 h-10 flex items-center justify-center text-gray-600 hover:text-green-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                  {totalItems > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{totalItems}</span>}
                </button>
              )}
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Menu">
                <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[4px]' : ''}`} />
                <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? 'opacity-0 scale-0' : ''}`} />
                <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[4px]' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========== NOTIFICATION MENU ========== */}
      {showNotifMenu && (
        <NotificationMenu 
          onClose={() => setShowNotifMenu(false)} 
          onNavigate={(orderId) => {
            setShowNotifMenu(false);
            if (user?.role === 'admin') {
              onOpenAdmin(orderId);
            } else if (onOpenOrder) {
              onOpenOrder(orderId);
            }
          }}
        />
      )}

      {/* ========== MOBILE MENU ========== */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-2xl animate-slide-in flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Logo size={200} />
              </div>

              <button onClick={() => setMenuOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <button onClick={() => { setMenuOpen(false); document.getElementById('produits')?.scrollIntoView({ behavior: 'smooth' }); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-sm font-medium text-left"><span className="text-lg">🏪</span>Nos Produits</button>
              {isSimpleUser && (
                <button onClick={() => closeAnd(() => setIsCartBuilderOpen(true))} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-sm font-medium text-left"><span className="text-lg">🛒</span>Créer mon panier</button>
              )}
              {user?.role !== 'livreur' && (
                <button onClick={() => closeAnd(onOpenTracker)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-sm font-medium text-left"><span className="text-lg">📍</span>Suivre ma commande</button>
              )}

              {isLoggedIn && (
                <button onClick={() => closeAnd(onOpenDashboard)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 text-green-700 transition-colors text-sm font-bold text-left">
                  <span className="text-lg">🏡</span> Mon compte
                </button>
              )}

              <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
                <button onClick={() => { setMenuOpen(false); onOpenContact?.(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-sm font-medium text-left">
                  <span className="text-lg">📧</span> Nous Contacter
                </button>

                {/* Auth in mobile menu */}
                {isLoggedIn && user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl" onClick={() => closeAnd(onOpenDashboard)}>
                      <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-xl shrink-0 border border-gray-100">
                        {user.avatar.startsWith('http') ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user.avatar
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{user.name}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleColors[user.role]}`}>{roleNames[user.role]}</span>
                      </div>
                    </div>
                    {user.role === 'admin' && <button onClick={() => closeAnd(onOpenAdmin)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold"><span className="text-lg">⚙️</span>Tableau de bord</button>}
                    <button onClick={() => { setMenuOpen(false); logout(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold"><span className="text-lg">🚪</span>Déconnexion</button>
                  </>
                ) : (
                  <button onClick={() => closeAnd(() => setShowAuth(true))} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Connexion / Inscription
                  </button>
                )}
              </div>
            </nav>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="space-y-2 text-xs text-gray-500">
                <p className="flex items-center gap-2"><span>📞</span> +223 77 99 68 58</p>
                <p className="flex items-center gap-2"><span>📧</span> contact@lumoo.ml</p>
                <p className="flex items-center gap-2"><span>📍</span> Bamako, Mali</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}