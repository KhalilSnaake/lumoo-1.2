import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { PaymentMethod } from '../types';
import { useState } from 'react';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import MaliPhoneInput from './MaliPhoneInput';
import LocationPicker from './LocationPicker';

export default function CartSidebar() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);

  const formatPrice = (price: number) => price.toLocaleString('fr-FR');

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => { setIsCartOpen(false); setShowCheckout(false); }}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              🛒 Mon Panier
            </h2>
            <p className="text-xs text-gray-500">{totalItems} article{totalItems > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setIsCartOpen(false); setShowCheckout(false); }}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <span className="text-6xl block mb-4">🛒</span>
              <p className="font-medium text-gray-600">Votre panier est vide</p>
              <p className="text-sm mt-1">Ajoutez des produits pour commencer</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map(item => (
                <div key={item.product.id} className="flex gap-3 bg-gray-50 rounded-xl p-3 group hover:bg-green-50 transition-colors">
                  {/* Product image */}
                  <div className="w-14 h-14 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                    <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-gray-400">{item.product.unit}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold text-green-600">
                        {formatPrice(item.product.price * item.quantity)} FCFA
                      </span>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors text-xs"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-gray-700">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-300 hover:text-green-500 transition-colors text-xs"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="ml-1 w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Livraison</span>
                <span className="text-green-600 font-medium">Gratuite</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-xl font-extrabold text-green-600">
                  {formatPrice(totalPrice)} <span className="text-xs font-medium">FCFA</span>
                </span>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
              >
                Valider la commande →
              </button>
            </div>
          </>
        )}

        {/* Checkout Overlay */}
        {showCheckout && items.length > 0 && (
          <CheckoutOverlay onClose={() => setShowCheckout(false)} />
        )}
      </div>
    </>
  );
}

function CheckoutOverlay({ onClose }: { onClose: () => void }) {
  const { items, totalPrice, clearCart, setIsCartOpen } = useCart();
  const { createOrder } = useOrders();
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
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

  const formatPrice = (price: number) => price.toLocaleString('fr-FR');

  const paymentMethods = [
    { id: 'orange_money', name: 'Orange Money', icon: <OrangeMoneyLogo /> },
    { id: 'moov_money', name: 'Moov Money', icon: <MoovMoneyLogo /> },
    { id: 'wave', name: 'Wave', icon: <WaveLogo /> },
    { id: 'livraison', name: 'Paiement à la livraison', icon: <CashLogo /> },
  ];

  const canProceedToPayment = name && phone && address && city;
  const canPay = paymentMethod && (paymentMethod === 'livraison' || paymentPhone);

  const handlePayment = async () => {
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
      setCreatedOrderId(order.id);
      setCreatedDeliveryCode(order.deliveryCode);
      clearCart();
      setStep('success');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <button onClick={step === 'payment' ? () => setStep('form') : onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-bold text-gray-800">
          {step === 'form' ? '📋 Informations de livraison' : step === 'payment' ? '💳 Paiement' : '✅ Commande confirmée'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 'form' && (
          <div className="space-y-4">
            <div className="bg-green-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-green-700 font-medium mb-2">Récapitulatif ({items.length} article{items.length > 1 ? 's' : ''})</p>
              <div className="space-y-1">
                {items.map(item => (
                  <div key={item.product.id} className="flex justify-between text-xs text-gray-600 py-0.5">
                    <span>{item.product.name} ×{item.quantity}</span>
                    <span className="font-medium">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-green-200 mt-2 pt-2 flex justify-between text-sm font-bold text-green-700">
                <span>Total</span>
                <span>{formatPrice(totalPrice)} FCFA</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom complet *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Jean Dupont" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone *</label>
              <MaliPhoneInput value={phone} onChange={setPhone} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adresse de livraison *</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Ex: Badalabougou, près de la pharmacie..." rows={2} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ville *</label>
              <select value={city} onChange={e => setCity(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Sélectionner une ville</option>
                {['Bamako', 'Sikasso', 'Kayes', 'Ségou', 'Mopti', 'Gao', 'Tombouctou', 'Koulikoro'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="pt-1">
              <label className="block text-xs font-medium text-gray-600 mb-2">Localisation exacte (GPS)</label>
              <LocationPicker 
                currentLat={gps.lat} 
                currentLng={gps.lng} 
                onLocationSelect={(lat, lng) => setGps({ lat, lng })} 
              />
            </div>

            <button onClick={() => setStep('payment')} disabled={!canProceedToPayment} className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-green-200 transition-all text-sm disabled:opacity-50">Continuer vers le paiement →</button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"><p className="text-xs text-yellow-700">💡 Montant à payer : <strong>{formatPrice(totalPrice)} FCFA</strong></p></div>
            <p className="text-sm font-medium text-gray-700">Choisissez votre mode de paiement :</p>
            <div className="space-y-2.5">
              {paymentMethods.map(method => (
                <button key={method.id} onClick={() => setPaymentMethod(method.id as PaymentMethod)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${paymentMethod === method.id ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-100 bg-white'}`}>
                  {method.icon}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{method.name}</p>
                    {method.id === 'livraison' && <p className="text-[10px] text-gray-400">Payez en espèces à la réception</p>}
                  </div>
                </button>
              ))}
            </div>

            {paymentMethod && paymentMethod !== 'livraison' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Numéro de paiement *</label>
                <MaliPhoneInput value={paymentPhone} onChange={setPaymentPhone} required />
              </div>
            )}

            <button onClick={handlePayment} disabled={!canPay || isSubmitting} className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Traitement...</> : paymentMethod === 'livraison' ? '✅ Confirmer la commande' : `💳 Payer ${formatPrice(totalPrice)} FCFA`}
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce-in"><span className="text-4xl">✅</span></div>
            <h3 className="text-xl font-bold text-gray-800">Commande confirmée !</h3>
            <p className="text-sm text-gray-500 max-w-xs">Votre commande a été enregistrée avec succès.</p>
            <div className="bg-green-50 rounded-xl p-3 border border-green-200 w-full max-w-xs">
              <p className="text-[10px] text-green-700 font-medium">N° de commande</p>
              <p className="text-sm font-extrabold font-mono text-green-800 tracking-wider">{createdOrderId}</p>
            </div>
            <div className="bg-emerald-600 text-white rounded-xl p-3 w-full max-w-xs">
              <p className="text-[10px] font-medium opacity-80">🔒 Code de livraison</p>
              <p className="text-2xl font-black font-mono tracking-[0.3em]">{createdDeliveryCode}</p>
              <p className="text-[9px] opacity-80 mt-1">Gardez-le pour suivre votre commande.</p>
            </div>
            <button onClick={() => { setIsCartOpen(false); }} className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all text-sm">Continuer mes achats</button>
          </div>
        )}
      </div>
    </div>
  );
}
