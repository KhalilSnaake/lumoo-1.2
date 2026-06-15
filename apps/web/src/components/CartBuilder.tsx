import { useState } from 'react';
import {
  useCart,
  useOrders,
  useAuth,
  useNotifications,
  useProducts,
  useCategories,
  getSupabase,
} from '@lumoo/core';
import type { PaymentMethod, Product } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import { OrangeMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import ProductModal from './ProductModal';
import MaliPhoneInput from './MaliPhoneInput';
import LocationPicker from './LocationPicker';

type CategoryFilter = 'all' | number;
type BuilderStep = 'compose' | 'livraison' | 'paiement' | 'confirmation';

export default function CartBuilder() {
  const {
    items, isCartBuilderOpen, setIsCartBuilderOpen,
    addToCart, updateQuantity, removeFromCart,
    clearCart, totalPrice, totalItems
  } = useCart();
  const { createOrder } = useOrders();
  const { user } = useAuth();
  const { createNotification } = useNotifications();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState<BuilderStep>('compose');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Checkout fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [gps, setGps] = useState<{lat?: number, lng?: number}>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdDeliveryCode, setCreatedDeliveryCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPrice = (p: number) => p.toLocaleString('fr-FR');
  const { products } = useProducts();
  const { categories } = useCategories();

  // Comptes par catégorie (par ID, depuis la base) - comme dans ProductGrid
  const categoryCounts = products.reduce<Record<number, number>>((acc, p) => {
    if (p.published === false) return acc;
    if (p.category_id == null) return acc;
    acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    return acc;
  }, {});

  const filteredProducts = products.filter((product: Product) => {
    // Filtre par catégorie : on compare par ID (plus fiable que le slug) - comme dans ProductGrid
    const matchesCategory = filter === 'all' ? true : product.category_id === filter;

    const matchesSearch = !search.toLowerCase().trim() ||
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.description.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch && product.published !== false;
  });

  const getQty = (id: number) => items.find(i => i.product.id === id)?.quantity || 0;

  // Boutons = catégories venant de Supabase (CategoryContext) - comme dans ProductGrid
  // On exclut les catégories qui n'ont aucun produit publié.
  const getCategoryFilterButtons = () => {
    const totalCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    const dynamicCategories = categories.filter((c) => (categoryCounts[c.id] ?? 0) > 0);

    const buttons: Array<{ key: CategoryFilter; label: string; count: number }> = [
      { key: 'all', label: 'Tous', count: totalCount },
      ...dynamicCategories.map((c) => {
        const label = c.name || c.slug || `Catégorie ${c.id}`;
        return { key: c.id, label, count: categoryCounts[c.id] ?? 0 };
      }),
    ];

    return buttons;
  };

  const handleClose = () => {
    setIsCartBuilderOpen(false);
    setTimeout(() => {
      setStep('compose');
      setFilter('all');
      setSearch('');
    }, 300);
  };

  const handleValidate = () => {
    if (items.length === 0) return;
    setStep('livraison');
  };

  const canProceedToPayment = name && phone && address && city;
  const canPay = paymentMethod && (paymentMethod === 'livraison' || paymentPhone);

  const handlePayment = async () => {
    const supabase = getSupabase();
    if (!paymentMethod) return;
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        userId: user?.id,
        items,
        customerName: name,
        customerPhone: phone,
        address,
        city,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentPhone,
      });

      // Notify Admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins) {
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            title: '📦 Nouvelle commande !',
            message: `Une commande de ${formatPrice(totalPrice)} F vient d'être passée par ${name}.`,
            type: 'new_order',
            orderId: order.id
          });
        }
      }

      setCreatedOrderId(order.id);
      setCreatedDeliveryCode(order.deliveryCode);
      clearCart();
      setStep('confirmation');
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setIsCartBuilderOpen(false);
    setTimeout(() => {
      setStep('compose');
      setName(''); setPhone(''); setAddress(''); setCity('');
      setPaymentMethod(''); setPaymentPhone('');
      setCreatedOrderId('');
    }, 300);
  };

  const paymentMethods = [
    { id: 'orange_money', name: 'Orange Money', icon: <OrangeMoneyLogo />, desc: 'Payez avec votre compte Orange Money' },
    { id: 'wave', name: 'Wave', icon: <WaveLogo />, desc: 'Payez avec votre compte Wave' },
    { id: 'livraison', name: 'Paiement à la livraison', icon: <CashLogo />, desc: 'Payez en espèces à la réception' },
  ];

  if (!isCartBuilderOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'compose' ? (
              <button
                onClick={() => setStep(step === 'paiement' ? 'livraison' : 'compose')}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                {step === 'compose' && '🛒 Créer mon panier'}
                {step === 'livraison' && '📋 Livraison'}
                {step === 'paiement' && '💳 Paiement'}
                {step === 'confirmation' && '✅ Confirmation'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress bar - moved back to right side */}
            <div className="hidden sm:flex items-center gap-2">
              {[
                { key: 'compose', label: '1. Panier', emoji: '🛒' },
                { key: 'livraison', label: '2. Livraison', emoji: '📋' },
                { key: 'paiement', label: '3. Paiement', emoji: '💳' },
                { key: 'confirmation', label: '4. Confirmation', emoji: '✅' },
              ].map((s, i) => {
                const stepOrder = ['compose', 'livraison', 'paiement', 'confirmation'];
                const currentIdx = stepOrder.indexOf(step);
                const isActive = step === s.key;
                const isDone = currentIdx > i;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isActive ? 'bg-green-500 text-white shadow-lg shadow-green-200' :
                      isDone ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      <span>{s.emoji}</span>
                      <span className="hidden md:inline">{s.label}</span>
                    </div>
                    {i < 3 && <div className={`w-6 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />}
                  </div>
                );
              })}
            </div>

            {/* Close button moved to far right */}
            {step === 'compose' && (
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 overflow-hidden">
        {/* ──── STEP: COMPOSE ──── */}
        {step === 'compose' && (
          <div className="h-full flex flex-col lg:flex-row">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex flex-col gap-3 mb-6">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getCategoryFilterButtons().map(f => (
                      <button key={String(f.key)} onClick={() => setFilter(f.key)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.key ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map(product => {
                    const qty = getQty(product.id);
                    return (
                      <div 
                        key={product.id} 
                        onClick={() => setSelectedProduct(product)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${qty > 0 ? 'border-green-400 bg-green-50/50 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                      >
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-50 overflow-hidden shadow-inner">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-800 truncate">{product.name}</h4>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-extrabold text-green-600">{formatPrice(product.price)}</span>
                            <span className="text-[10px] text-gray-400">F / {product.unit}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {qty === 0 ? (
                            <button onClick={() => addToCart(product)} className="w-9 h-9 rounded-xl bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12m6-6H6" /></svg></button>
                          ) : (
                            <>
                              <button onClick={() => updateQuantity(product.id, qty - 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 transition-colors hover:text-red-500">−</button>
                              <span className="w-6 text-center text-sm font-black text-green-600">{qty}</span>
                              <button onClick={() => updateQuantity(product.id, qty + 1)} className="w-7 h-7 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors">+</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedProduct && (
                  <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
                )}
                <div className="h-24 lg:h-6" />
              </div>
            </div>

            {/* Sidebar Desktop */}
            <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col border-l border-gray-100 bg-gray-50/50">
              <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800 text-sm">📦 Mon Panier {totalItems > 0 && <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{totalItems}</span>}</h3></div>
              {items.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-300">Panier vide</div> : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {items.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-gray-100">
                        <img src={item.product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-gray-700">{item.product.name}</p>
                          <p className="text-[10px] text-gray-400">{formatPrice(item.product.price)} × {item.quantity}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t bg-white space-y-3">
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-700">Total</span><span className="text-2xl font-black text-green-600">{formatPrice(totalPrice)} F</span></div>
                    <button onClick={handleValidate} className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-lg">Valider le panier →</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ──── STEP: LIVRAISON ──── */}
        {step === 'livraison' && (
          <div className="h-full overflow-y-auto p-6 max-w-xl mx-auto space-y-6">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex justify-between items-center">
              <span className="font-bold text-green-800">Total panier</span>
              <span className="text-xl font-black text-green-600">{formatPrice(totalPrice)} FCFA</span>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 underline underline-offset-4 decoration-green-500">📍 Informations de livraison</h3>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nom complet *" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
              <MaliPhoneInput value={phone} onChange={setPhone} required />
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse exacte (Ex: Badalabougou...) *" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none h-24 resize-none" />
              <select value={city} onChange={e => setCity(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                <option value="">-- Choisir la ville --</option>
                {['Bamako', 'Sikasso', 'Kayes', 'Ségou', 'Mopti', 'Gao', 'Tombouctou', 'Koulikoro'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Partager ma localisation (GPS)</label>
                <LocationPicker 
                  currentLat={gps.lat} 
                  currentLng={gps.lng} 
                  onLocationSelect={(lat, lng) => setGps({ lat, lng })} 
                />
              </div>

              <button onClick={() => setStep('paiement')} disabled={!canProceedToPayment} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-40 transition-all">Continuer vers le paiement</button>
            </div>
          </div>
        )}

        {/* ──── STEP: PAIEMENT ──── */}
        {step === 'paiement' && (
          <div className="h-full overflow-y-auto p-6 max-w-xl mx-auto space-y-6">
            <h3 className="font-bold text-gray-800 text-center text-lg">Choisissez votre mode de paiement</h3>
            <div className="space-y-3">
              {paymentMethods.map(method => (
                <button key={method.id} onClick={() => setPaymentMethod(method.id as PaymentMethod)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === method.id ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-100 bg-white'}`}>
                  {method.icon}
                  <div className="text-left flex-1"><p className="font-bold text-gray-800">{method.name}</p><p className="text-[10px] text-gray-400">{method.desc}</p></div>
                </button>
              ))}
            </div>
            {paymentMethod && paymentMethod !== 'livraison' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Numéro de paiement *</label>
                <MaliPhoneInput value={paymentPhone} onChange={setPaymentPhone} required />
              </div>
            )}
            <button onClick={handlePayment} disabled={!canPay || isSubmitting} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
              {isSubmitting ? 'Traitement...' : paymentMethod === 'livraison' ? 'Confirmer la commande' : `Payer ${formatPrice(totalPrice)} F`}
            </button>
          </div>
        )}

         {/* ──── STEP: CONFIRMATION ──── */}
         {step === 'confirmation' && (
           <div className="h-full flex items-center justify-center p-6">
             <div className="text-center space-y-6 max-w-md w-full">
              <span className="text-7xl block animate-bounce-in">🎉</span>
              <h3 className="text-2xl font-black text-gray-800">Commande réussie !</h3>
              <div className="bg-green-50 p-6 rounded-3xl border border-green-100 space-y-2">
                <p className="text-xs text-green-700 font-bold uppercase tracking-widest">Numéro de commande</p>
                <p className="text-xl font-black font-mono text-green-800">{createdOrderId}</p>
              </div>
              <div className="bg-emerald-600 text-white p-5 rounded-3xl space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">🔒 Code de livraison</p>
                <p className="text-3xl font-black font-mono tracking-[0.3em]">{createdDeliveryCode}</p>
                <p className="text-[11px] opacity-80">Gardez ce code : il sert à suivre votre commande et à confirmer la réception au livreur.</p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    const itemsList = items.map(i => `${i.product.name} x${i.quantity}`).join('\n');
                    const msg = encodeURIComponent(`Bonjour Lumoo ! Voici ma commande n° ${createdOrderId}\n\nArticles :\n${itemsList}\n\nTotal : ${formatPrice(totalPrice)} FCFA`);
                    window.open(`https://wa.me/22377996858?text=${msg}`, '_blank');
                  }}
                  className="w-full py-4 bg-[#25D366] text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Confirmer par WhatsApp
                </button>
                <button onClick={handleFinish} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Retour à la boutique</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM BAR */}
      {step === 'compose' && items.length > 0 && (
        <div className="lg:hidden border-t p-4 bg-white shadow-2xl flex items-center justify-between">
          <div><p className="text-xs text-gray-400">{totalItems} articles</p><p className="text-xl font-black text-green-600">{formatPrice(totalPrice)} F</p></div>
          <button onClick={handleValidate} className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl">Suivant →</button>
        </div>
      )}
    </div>
  );
}
