import { useState } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { Order, OrderStatus, PaymentMethod } from '../types';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';

const paymentLogos: Record<PaymentMethod, React.ReactNode> = {
  orange_money: <OrangeMoneyLogo className="w-6 h-6 shadow-sm border border-gray-100" />,
  moov_money: <MoovMoneyLogo className="w-6 h-6 shadow-sm border border-gray-100" />,
  wave: <WaveLogo className="w-6 h-6 shadow-sm border border-gray-100" />,
  livraison: <CashLogo className="w-6 h-6 shadow-sm border border-gray-100" />,
};

const paymentNames: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  livraison: 'Livraison',
};

const statusLabels: Record<OrderStatus, { label: string; emoji: string; color: string; bg: string; desc: string }> = {
  en_attente: { label: 'En attente', emoji: '⏳', color: 'text-yellow-700', bg: 'bg-yellow-100', desc: 'Votre commande a été reçue et est en attente de confirmation.' },
  confirmee: { label: 'Confirmée', emoji: '✅', color: 'text-blue-700', bg: 'bg-blue-100', desc: 'Votre commande a été confirmée par notre équipe.' },
  en_preparation: { label: 'En préparation', emoji: '📦', color: 'text-purple-700', bg: 'bg-purple-100', desc: 'Votre commande est en cours de préparation.' },
  en_livraison: { label: 'En livraison', emoji: '🚚', color: 'text-orange-700', bg: 'bg-orange-100', desc: 'Votre commande est en route vers vous !' },
  livree: { label: 'Livrée', emoji: '🎉', color: 'text-green-700', bg: 'bg-green-100', desc: 'Votre commande a été livrée avec succès.' },
  annulee: { label: 'Annulée', emoji: '❌', color: 'text-red-700', bg: 'bg-red-100', desc: 'Cette commande a été annulée.' },
};

const statusOrder: OrderStatus[] = ['en_attente', 'confirmee', 'en_preparation', 'en_livraison', 'livree'];

export default function OrderTracker({ onClose }: { onClose: () => void }) {
  const { getOrder } = useOrders();
  const { users } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const formatPrice = (p: number) => p.toLocaleString('fr-FR');

  const assignedLivreur = order?.livreurId ? users.find(u => u.id === order.livreurId) : null;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const handleSearch = async () => {
    if (!orderId.trim()) return;
    setSearching(true);
    setError('');
    setOrder(null);

    // Simulate search delay
    await new Promise(r => setTimeout(r, 600));

    const found = getOrder(orderId.trim().toUpperCase());
    if (found) {
      setOrder(found);
    } else {
      setError('Commande introuvable. Vérifiez le numéro et réessayez.');
    }
    setSearching(false);
  };

  const currentStepIndex = order ? statusOrder.indexOf(order.status) : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-800">📍 Suivi de commande</h2>
            <p className="text-xs text-gray-400">Entrez votre numéro de commande</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: LUM-M5X7KQ-A2B4"
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !orderId.trim()}
              className="px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {searching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                '🔍'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Order Result */}
        {order && (
          <div className="px-5 pb-6 space-y-5">
            {/* Status badge */}
            <div className={`${statusLabels[order.status].bg} rounded-2xl p-4 text-center`}>
              <span className="text-4xl block mb-2">{statusLabels[order.status].emoji}</span>
              <p className={`text-lg font-extrabold ${statusLabels[order.status].color}`}>
                {statusLabels[order.status].label}
              </p>
              <p className={`text-xs mt-1 ${statusLabels[order.status].color} opacity-75`}>
                {statusLabels[order.status].desc}
              </p>
            </div>

            {/* Progress bar */}
            {order.status !== 'annulee' && (
              <div className="flex items-center justify-between gap-1">
                {statusOrder.map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full transition-all ${
                      i <= currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                    <span className={`text-[9px] font-medium ${i <= currentStepIndex ? 'text-green-600' : 'text-gray-300'}`}>
                      {statusLabels[s].label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Order details */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0">
                <div className="bg-green-600 text-white px-3 py-1.5 rounded-bl-2xl shadow-lg animate-pulse">
                  <p className="text-[8px] font-black uppercase tracking-tighter opacity-80">Code Livraison</p>
                  <p className="text-lg font-black font-mono leading-none tracking-widest">{order.deliveryCode}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">N° Commande</span>
                <span className="font-mono font-bold text-gray-700">{order.id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Date</span>
                <span className="text-gray-700">{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Client</span>
                <span className="text-gray-700">{order.customerName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Adresse</span>
                <div className="text-right">
                  <span className="text-gray-700 block">{order.address}, {order.city}</span>
                  {order.gps_lat && order.gps_lng && (
                    <a 
                      href={`https://www.google.com/maps?q=${order.gps_lat},${order.gps_lng}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 font-bold hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      📍 Voir sur la carte
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Paiement</span>
                <div className="flex items-center gap-1.5 font-medium text-gray-700">
                  {paymentLogos[order.paymentMethod]}
                  <span>{paymentNames[order.paymentMethod]}</span>
                </div>
              </div>

              {assignedLivreur && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">🛵 Livreur assigné</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">{assignedLivreur.name}</span>
                    <a href={`tel:${assignedLivreur.phone}`} className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
                      📞 {assignedLivreur.phone}
                    </a>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-2 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{item.emoji} {item.name} ×{item.quantity}</span>
                    <span className="font-medium text-gray-700">{formatPrice(item.price * item.quantity)} F</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-700">Total</span>
                <span className="text-lg font-extrabold text-green-600">{formatPrice(order.totalPrice)} FCFA</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
