import { useState, useRef, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useProducts } from '../context/ProductContext';
import { useAds } from '../context/AdContext';
import { useNotifications } from '../context/NotificationContext';
import { useCategories } from '../context/CategoryContext';
import { useContactMessages } from '../context/ContactMessagesContext';
import { Order, OrderStatus, PaymentMethod, Product, Ad, AdPosition } from '../types';
import { User, UserRole } from '../types/auth';
import { ContactMessage } from '../types';
import Logo from './Logo';
import { OrangeMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';
import readXlsxFile from 'read-excel-file/browser';
import MaliPhoneInput from './MaliPhoneInput';

const paymentLogos: Record<PaymentMethod, React.ReactNode> = {
  orange_money: <OrangeMoneyLogo className="w-4 h-4" />,
  wave: <WaveLogo className="w-4 h-4" />,
  livraison: <CashLogo className="w-4 h-4" />,
};

const paymentNames: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  livraison: 'Paiement à la livraison',
};

// ──── Shared constants ────
const statusLabels: Record<OrderStatus, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '⏳' },
  confirmee: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-100', emoji: '✅' },
  en_preparation: { label: 'En préparation', color: 'text-purple-700', bg: 'bg-purple-100', emoji: '📦' },
  en_livraison: { label: 'En livraison', color: 'text-orange-700', bg: 'bg-orange-100', emoji: '🚚' },
  livree: { label: 'Livrée', color: 'text-green-700', bg: 'bg-green-100', emoji: '🎉' },
  annulee: { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-100', emoji: '❌' },
};

function DeliveryProofBadge({ code, receivedBy }: { code: string, receivedBy?: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">✅</div>
        <div>
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Preuve de livraison</p>
          <p className="text-xs font-bold text-gray-800">Reçu par : <span className="text-green-700">{receivedBy || 'Client'}</span></p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[8px] font-bold text-gray-400 uppercase">Code validé</p>
        <p className="text-sm font-black font-mono text-gray-600 tracking-widest">{code}</p>
      </div>
    </div>
  );
}

const statusFlow: OrderStatus[] = ['en_attente', 'confirmee', 'en_preparation', 'en_livraison', 'livree'];

const roleLabels: Record<UserRole, { label: string; emoji: string; color: string; bg: string }> = {
  admin: { label: 'admin', emoji: '👨‍💼', color: 'text-red-700', bg: 'bg-red-100' },
  client: { label: 'Client', emoji: '👤', color: 'text-blue-700', bg: 'bg-blue-100' },
  livreur: { label: 'Livreur', emoji: '🛵', color: 'text-orange-700', bg: 'bg-orange-100' },
};

// roleLabels is used in tabs to display user lists
void roleLabels;

type Tab = 'dashboard' | 'commandes' | 'produits' | 'utilisateurs' | 'livreurs' | 'publicites' | 'messages';

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { key: 'commandes', label: 'Commandes', emoji: '📦' },
  { key: 'produits', label: 'Produits', emoji: '🍎' },
  { key: 'publicites', label: 'Publicités', emoji: '📢' },
  { key: 'messages', label: 'Messages', emoji: '💬' },
  { key: 'utilisateurs', label: 'Utilisateurs', emoji: '👥' },
  { key: 'livreurs', label: 'Livreurs', emoji: '🛵' },
];

export default function AdminPanel({ onClose, initialOrderId }: { onClose: () => void; initialOrderId?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialOrderId ? 'commandes' : 'dashboard');
  const [initialSearch] = useState(initialOrderId || '');

  useEffect(() => {
    if (initialOrderId) setActiveTab('commandes');
  }, [initialOrderId]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a 
            href="/"
            onClick={(e) => { e.preventDefault(); onClose(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <Logo size={200} />
            <div>
              <h1 className="text-lg font-extrabold text-gray-800 group-hover:text-green-600 transition-colors">Administration</h1>
              <p className="text-xs text-gray-400">Centre de gestion Lumoo</p>
            </div>
          </a>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${activeTab === t.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'commandes' && <CommandesTab initialSearch={initialSearch} />}
        {activeTab === 'produits' && <ProduitsTab />}
        {activeTab === 'publicites' && <AdsTab />}
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'utilisateurs' && <UtilisateursTab />}
        {activeTab === 'livreurs' && <LivreursTab />}
      </div>
    </div>
  );
}

function DashboardTab() {
  const { orders } = useOrders();
  const { users } = useAuth();
  const { products } = useProducts();
  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const totalRevenue = orders.filter(o => o.status !== 'annulee').reduce((s, o) => s + o.totalPrice, 0);
  
  const pendingOrders = orders.filter(o => o.status === 'en_attente');
  const deliveringOrders = orders.filter(o => o.status === 'en_livraison');
  const completedOrders = orders.filter(o => o.status === 'livree');
  const cancelledOrders = orders.filter(o => o.status === 'annulee');
  const clientsCount = users.filter(u => u.role === 'client').length;
  const livreursCount = users.filter(u => u.role === 'livreur').length;
  const publishedProducts = products.filter(p => p.published !== false).length;
  const todayStr = new Date().toDateString();
  const todayRevenue = orders
    .filter(o => o.status !== 'annulee' && new Date(o.createdAt).toDateString() === todayStr)
    .reduce((s, o) => s + o.totalPrice, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Revenus</span>
            <span className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg">💰</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{fmt(totalRevenue)} <span className="text-xs text-gray-400 font-bold">F</span></p>
          <p className="text-[10px] text-green-600 font-bold mt-1">+{fmt(todayRevenue)} F aujourd'hui</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Commandes</span>
            <span className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">📦</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{orders.length}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1">{pendingOrders.length} en attente</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Produits</span>
            <span className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-lg">🍎</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{publishedProducts}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1">{products.length - publishedProducts} masqués</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Clients</span>
            <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-lg">👥</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{clientsCount}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1">{livreursCount} livreurs</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Livraisons</span>
            <span className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-lg">🚚</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{deliveringOrders.length}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1">{completedOrders.length} terminées</p>
        </div>
      </div>

      {/* Progress bars & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-extrabold text-gray-800">État des commandes</h3>
            <span className="text-[10px] font-bold text-gray-400">{orders.length} total</span>
          </div>
          <div className="space-y-4">
            {[
              { label: 'En attente', value: pendingOrders.length, color: 'bg-yellow-400', max: orders.length || 1 },
              { label: 'Confirmée', value: orders.filter(o => o.status === 'confirmee').length, color: 'bg-blue-400', max: orders.length || 1 },
              { label: 'En préparation', value: orders.filter(o => o.status === 'en_preparation').length, color: 'bg-purple-400', max: orders.length || 1 },
              { label: 'En livraison', value: deliveringOrders.length, color: 'bg-orange-400', max: orders.length || 1 },
              { label: 'Livrée', value: completedOrders.length, color: 'bg-green-400', max: orders.length || 1 },
              { label: 'Annulée', value: cancelledOrders.length, color: 'bg-red-400', max: orders.length || 1 },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-gray-600">{item.label}</span>
                  <span className="font-extrabold text-gray-800">{item.value}</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                    style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-3xl p-6 border border-green-500 shadow-lg text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">Revenu total</span>
              <span className="text-2xl">📈</span>
            </div>
            <p className="text-4xl font-black">{fmt(totalRevenue)} <span className="text-lg opacity-80">FCFA</span></p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">Aujourd'hui</span>
              <span className="text-lg font-extrabold">+{fmt(todayRevenue)} F</span>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-white/20">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-2xl font-black">{completedOrders.length}</p>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">Livrées</p>
              </div>
              <div>
                <p className="text-2xl font-black">{pendingOrders.length}</p>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">En attente</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-gray-800">📋 Dernières commandes</h3>
          <span className="text-[10px] font-bold text-gray-400">Les 5 plus récentes</span>
        </div>
        <div className="divide-y divide-gray-50">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm shrink-0">
                  {statusLabels[order.status].emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{order.customerName}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{order.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold ${statusLabels[order.status].bg} ${statusLabels[order.status].color}`}>
                  {statusLabels[order.status].label}
                </span>
                <span className="text-sm font-extrabold text-gray-800">{fmt(order.totalPrice)} F</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Aucune commande pour le moment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommandesTab({ initialSearch = '' }: { initialSearch?: string }) {
  const { orders, refreshOrders, updateOrderStatus, updateOrder, deleteOrder } = useOrders();
  const { users } = useAuth();
  const { showToast } = useToast();
  const { createNotification } = useNotifications();
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const livreurs = users.filter(u => u.role === 'livreur' && !u.blocked);
  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const q = search.toLowerCase();
    return matchStatus && (!q || o.customerName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  });

  const notifyOnWhatsApp = (order: Order) => {
    const msg = encodeURIComponent(`Bonjour ${order.customerName}, votre commande ${order.id} sur Lumoo est passée au statut : ${statusLabels[order.status].label}. Suivez-la ici : ${window.location.origin}`);
    window.open(`https://wa.me/${order.customerPhone.replace(/[^\d]/g, '')}?text=${msg}`, '_blank');
  };

  const getNextStatusAction = (order: Order) => {
    const idx = statusFlow.indexOf(order.status);
    if (idx < statusFlow.length - 1) {
      const next = statusFlow[idx + 1];
      const label =
        order.status === 'en_attente' ? 'Confirmer' :
        order.status === 'confirmee' ? 'Préparer' :
        order.status === 'en_preparation' ? 'Livrer' :
        order.status === 'en_livraison' ? 'Terminer' : 'Suivant';

      return (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (next === 'en_livraison' && !order.livreurId) {
              showToast('⚠️ Veuillez assigner un livreur avant la livraison', 'error');
              return;
            }
            await updateOrderStatus(order.id, next);
            showToast(`Commande : ${statusLabels[next].label}`);
          }}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
            (order.status === 'en_preparation' && !order.livreurId)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
          }`}
        >
          {label}
        </button>
      );
    }
    return null;
  };

  // Payment proof upload functionality
  const paymentProofFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState(false);
  const [currentUploadOrder, setCurrentUploadOrder] = useState<Order | null>(null);

  const uploadPaymentProof = (order: Order) => {
    setCurrentUploadOrder(order);
    paymentProofFileInputRef.current?.click();
  };

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>, order: Order) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type - only images and PDFs allowed
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showToast('❌ Format de fichier non valide. Seuls les images (JPEG, PNG, JPG, GIF) et PDF sont acceptés.', 'error');
      return;
    }

    // Check file size - max 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast('❌ Fichier trop volumineux. La taille maximale est de 5 Mo.', 'error');
      return;
    }

    try {
      setIsUploadingPaymentProof(true);
      showToast('📄 Téléchargement de la preuve de paiement...');

      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `payment_proofs/${order.id}_${Date.now()}.${fileExt}`;
      const filePath = fileName;
      let publicUrl: string;

      // Upload to Supabase storage - use documents bucket for payment proofs
      // Note: The documents bucket needs to be created first
      // Run the create_documents_bucket.sql script to set up the bucket
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

      if (uploadError) {
        // If upload fails, try with a different file path format
        const alternateFilePath = `payment_proofs/${Date.now()}_${file.name}`;
        const alternateUpload = await supabase.storage.from('documents').upload(alternateFilePath, file, {
          contentType: file.type,
          upsert: false
        });

        if (alternateUpload.error) {
          throw alternateUpload.error;
        } else {
          // Get the public URL from the alternate path
          const { data: { publicUrl: alternatePublicUrl } } = supabase.storage.from('documents').getPublicUrl(alternateFilePath);
          publicUrl = alternatePublicUrl;
        }
      } else {
        // Get the public URL from the original path
        const { data: { publicUrl: originalPublicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
        publicUrl = originalPublicUrl;
      }

      // Update the order with the payment proof URL
      await updateOrder(order.id, {
        paymentProofUrl: publicUrl,
        paymentProofFileName: file.name,
        paymentProofUploadedAt: new Date().toISOString()
      });

      showToast('✅ Preuve de paiement téléchargée avec succès !');
      refreshOrders();

    } catch (err: any) {
      console.error('Erreur lors du téléchargement:', err);
      showToast(`❌ Erreur lors du téléchargement: ${err.message}`, 'error');
    } finally {
      setIsUploadingPaymentProof(false);
      // Reset file input
      if (paymentProofFileInputRef.current) {
        paymentProofFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Hidden file input for payment proof upload */}
      <input
        type="file"
        ref={paymentProofFileInputRef}
        onChange={(e) => currentUploadOrder && handlePaymentProofUpload(e, currentUploadOrder)}
        accept="image/*,application/pdf"
        className="hidden"
        disabled={isUploadingPaymentProof}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Rechercher par N°, client, téléphone..." 
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500 shadow-sm transition-all" 
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="min-w-[160px] px-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-green-500 shadow-sm">
          <option value="all">Tous les statuts</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => refreshOrders()} className="px-4 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm shrink-0">🔄</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(order => (
          <div key={order.id} className="bg-white rounded-2xl p-5 border-2 border-gray-100 shadow-sm space-y-4 transition-all cursor-pointer hover:shadow-md" onClick={() => setSelectedOrderDetails(order)}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono text-gray-400 font-bold">{order.id}</p>
                <h4 className="font-bold text-gray-800 text-base">{order.customerName}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500">{order.customerPhone} · {order.city}</p>
                  <span className="text-gray-200">|</span>
                  <div className="flex items-center gap-1">
                    {paymentLogos[order.paymentMethod]}
                    <span className="text-[10px] font-medium text-gray-400 italic">{paymentNames[order.paymentMethod]}</span>
                  </div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusLabels[order.status].bg} ${statusLabels[order.status].color}`}>
                {statusLabels[order.status].label}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">🛵 Assigner un livreur</label>
                {(order.status === 'en_livraison' || order.status === 'livree' || order.status === 'annulee') && (
                  <span className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    Verrouillé
                  </span>
                )}
              </div>
              <select
                value={order.livreurId || ''}
                disabled={order.status === 'en_livraison' || order.status === 'livree' || order.status === 'annulee'}
                onChange={async (e) => {
                  const livreurId = e.target.value;
                  await updateOrder(order.id, { livreurId: livreurId || undefined });
                  if (livreurId) {
                    await createNotification({ userId: livreurId, title: '🛵 Nouvelle mission !', message: `La commande ${order.id} vous a été assignée.`, type: 'assignment', orderId: order.id });
                  }
                  showToast(livreurId ? 'Livreur assigné ✅' : 'Livreur retiré ⚠️');
                }}
                className={`w-full border rounded-lg py-2 px-3 text-xs outline-none transition-all ${
                  (order.status === 'en_livraison' || order.status === 'livree' || order.status === 'annulee')
                  ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
                  : order.livreurId ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-gray-200'
                }`}
              >
                <option value="">-- Sélectionner un livreur --</option>
                {livreurs.map(l => <option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}
              </select>
            </div>

              <div className="border-t border-gray-50 pt-3 flex justify-between items-center">
                 <div className="flex flex-col">
                   <span className="text-lg font-extrabold text-green-600">{fmt(order.totalPrice)} F</span>
                 </div>
                 <div className="flex gap-2">
                   {getNextStatusAction(order)}
                   <button
                    onClick={(e) => { e.stopPropagation(); notifyOnWhatsApp(order); }}
                    className="px-2 py-1.5 bg-green-50 text-[#25D366] text-[10px] font-bold rounded-lg transition-all hover:bg-green-100 flex items-center gap-1"
                    title="Notifier le client sur WhatsApp"
                   >
                    📲 Notif
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); uploadPaymentProof(order); }} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg transition-all hover:bg-blue-100">📄 Preuve</button>
                   <button onClick={async (e) => { e.stopPropagation(); if(confirm('Supprimer cette commande ?')) { await deleteOrder(order.id); showToast('Commande supprimée', 'error'); } }} className="px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg transition-all hover:bg-red-100">🗑</button>
                 </div>
              </div>
          </div>
        ))}
      </div>

      {selectedOrderDetails && (
        <Modal title="📄 Détails de la commande" onClose={() => setSelectedOrderDetails(null)} size="xl">
          <div className="space-y-6 hide-scrollbar">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-mono font-bold text-gray-400 uppercase">Numéro de commande</p>
                <p className="text-sm font-bold text-gray-800">{selectedOrderDetails.id}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(selectedOrderDetails.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusLabels[selectedOrderDetails.status].bg} ${statusLabels[selectedOrderDetails.status].color}`}>
                {statusLabels[selectedOrderDetails.status].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">👤 Client</p>
                <p className="text-sm font-bold text-gray-800">{selectedOrderDetails.customerName}</p>
                <p className="text-xs text-gray-500">{selectedOrderDetails.customerPhone}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">📍 Livraison</p>
                <p className="text-sm font-bold text-gray-800">{selectedOrderDetails.city}</p>
                <p className="text-xs text-gray-500 truncate">{selectedOrderDetails.address}</p>
                {selectedOrderDetails.gps_lat && selectedOrderDetails.gps_lng && (
                  <a 
                    href={`https://www.google.com/maps?q=${selectedOrderDetails.gps_lat},${selectedOrderDetails.gps_lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-blue-500 text-white text-[10px] font-black rounded-lg hover:bg-blue-600 transition-all shadow-sm"
                  >
                    🛰️ VOIR SUR MAPS
                  </a>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-3 font-bold text-gray-600">Article</th><th className="text-center px-4 py-3 font-bold text-gray-600">Qté</th><th className="text-right px-4 py-3 font-bold text-gray-600">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrderDetails.items.map((item, i) => <tr key={i} className="bg-white"><td className="px-4 py-3 text-gray-700 font-medium">{item.name}</td><td className="px-4 py-3 text-center text-gray-600 font-bold">{item.quantity}</td><td className="px-4 py-3 text-right text-gray-800 font-bold">{fmt(item.price * item.quantity)} F</td></tr>)}
                </tbody>
                <tfoot><tr className="bg-green-50"><td className="px-4 py-3 font-bold text-green-700" colSpan={2}>Total à payer</td><td className="px-4 py-3 text-right font-black text-green-600 text-lg">{fmt(selectedOrderDetails.totalPrice)} FCFA</td></tr></tfoot>
              </table>
            </div>

            {selectedOrderDetails.status === 'livree' && (
              <DeliveryProofBadge 
                code={selectedOrderDetails.deliveryCode} 
                receivedBy={selectedOrderDetails.receivedBy} 
              />
            )}

            <div className="bg-gray-50 p-3 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">💳 Paiement</p>
              <div className="flex items-center gap-2">
                {paymentLogos[selectedOrderDetails.paymentMethod]}
                <span className="text-sm font-bold text-gray-800">{paymentNames[selectedOrderDetails.paymentMethod]}</span>
              </div>
            </div>

            {/* Payment Proof Section */}
            {selectedOrderDetails.paymentProofUrl && (
              <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                <p className="text-[10px] font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
                  <span>✅</span> Preuve de paiement
                </p>
                <div className="space-y-2">
                  <a
                    href={selectedOrderDetails.paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white p-3 rounded-xl border border-gray-200 hover:border-green-300 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📄</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{selectedOrderDetails.paymentProofFileName}</p>
                        <p className="text-[10px] text-gray-500">
                          Téléchargé le {new Date(selectedOrderDetails.paymentProofUploadedAt || '').toLocaleString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className="text-green-600 text-xs font-bold">🔗 Ouvrir</span>
                    </div>
                  </a>
                  <button
                    onClick={async () => {
                      if (confirm('Supprimer cette preuve de paiement ?')) {
                        await updateOrder(selectedOrderDetails.id, {
                          paymentProofUrl: null,
                          paymentProofFileName: null,
                          paymentProofUploadedAt: null
                        });
                        showToast('Preuve de paiement supprimée');
                        refreshOrders();
                      }
                    }}
                    className="w-full py-2 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all flex items-center justify-center gap-1"
                  >
                    <span>🗑</span> Supprimer la preuve
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProduitsTab() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { showToast } = useToast();
  const { categories, addCategory } = useCategories();

  // Infinite scroll
  const ITEMS_PER_PAGE = 15;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < products.length) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, products.length));
        }
      },
      { rootMargin: '200px' }
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [visibleCount, products.length]);

  // Reset visible count when products change (e.g. after add/delete)
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [products.length]);

  const displayedProducts = products.slice(0, visibleCount);

  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form states for adding
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState('kg');

  const defaultCategory = categories.find(
    (c) => c.slug === 'alimentaire' || c.name.toLowerCase().trim() === 'alimentaire'
  );

  const [categoryId, setCategoryId] = useState<number | null>(defaultCategory?.id ?? null);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (!categoryId) setCategoryId(defaultCategory?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Synchroniser isPopular quand on édite un produit
  useEffect(() => {
    setIsPopular(editingProduct?.is_popular ?? false);
  }, [editingProduct]);

  const [imageUrl, setImageUrl] = useState('');
  const [labels, setLabels] = useState('');
  const [isPopular, setIsPopular] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image trop lourde (max 2Mo)', 'error'); return; }
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `products/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
      if (isEdit && editingProduct) { setEditingProduct({ ...editingProduct, image_url: publicUrl }); } 
      else { setImageUrl(publicUrl); }
      showToast('Image téléchargée ✅');
    } catch (err: any) { showToast('Erreur : ' + err.message, 'error'); } finally { setIsUploading(false); }
  };

  const [stock, setStock] = useState(100);

  const ensureCategoryId = async (fallbackId: number | null | undefined) => {
    const trimmed = (newCategoryName || '').trim();

    if (trimmed) {
      const created = await addCategory({ name: trimmed });
      if (!created) throw new Error('Impossible de créer la catégorie');
      return created.id;
    }

    if (fallbackId) return fallbackId;

    // Aucun ID fourni : on prend la premi\u00e8re cat\u00e9gorie disponible, sinon la cat\u00e9gorie par d\u00e9faut
    if (categories.length > 0) return categories[0].id;

    // En dernier recours, on cr\u00e9e la cat\u00e9gorie par d\u00e9faut
    const created = await addCategory({ name: 'Alimentaire' });
    if (created) return created.id;
    throw new Error('Cat\u00e9gorie requise');
  };

  const handleCreate = async () => {
    if (!name || price <= 0 || !unit || !imageUrl) { showToast('Remplissez les champs obligatoires (*)', 'error'); return; }
    try {
      const resolvedCategoryId = await ensureCategoryId(categoryId);
      const p = await addProduct({
        name,
        description: desc || '',
        price,
        unit,
        category_id: resolvedCategoryId,
        image_url: imageUrl,
        labels: labels || '',
        stock_quantity: stock,
        bgColor: 'white',
        inStock: true,
        published: true,
        is_popular: isPopular,
      } as any);
      if (p) {
        showToast('Produit ajouté ✅');
        setShowAdd(false);
        setName('');
        setPrice(0);
        setDesc('');
        setImageUrl('');
        setLabels('');
        setNewCategoryName('');
        setStock(100);
        setIsPopular(false);
        setCategoryId(defaultCategory?.id ?? null);
      }
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;
    if (!editingProduct.name || editingProduct.price <= 0 || !editingProduct.unit) {
      showToast('Champs obligatoires manquants', 'error');
      return;
    }

    try {
      const resolvedCategoryId = await ensureCategoryId(editingProduct.category_id);
      const updates = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        unit: editingProduct.unit,
        category_id: resolvedCategoryId,
        image_url: editingProduct.image_url,
        labels: editingProduct.labels,
        stock_quantity: editingProduct.stock_quantity,
        published: editingProduct.published,
        inStock: editingProduct.inStock,
        is_popular: isPopular,
      } as any;

      const p = await updateProduct(editingProduct.id, updates);
      if (p) {
        showToast('Produit mis à jour ✅');
        setEditingProduct(null);
        setNewCategoryName('');
        setIsPopular(false);
      } else {
        showToast('Erreur lors de la mise à jour', 'error');
      }
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  const handleExcelExport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Produits');

      worksheet.columns = [
        { header: 'Nom', key: 'nom', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Prix', key: 'prix', width: 10 },
        { header: 'Unité', key: 'unite', width: 10 },
        { header: 'Catégorie', key: 'categorie', width: 15 },
        { header: 'Image URL', key: 'image_url', width: 30 },
        { header: 'Étiquettes', key: 'etiquettes', width: 20 },
      ];

      products.forEach(p => {
        worksheet.addRow({
          nom: p.name,
          description: p.description,
          prix: p.price,
          unite: p.unit,
          categorie: typeof p.category === 'string' ? p.category : (p.category?.name ?? p.category?.slug ?? ''),
          image_url: p.image_url,
          etiquettes: p.labels
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumoo_catalogue_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Export Excel réussi ! 📊');
    } catch (err) {
      showToast('Erreur lors de l\'export ❌', 'error');
    }
  };

  const normalizeCategoryNameFromExcel = (raw: any) => {
    const v = String(raw || '').toLowerCase().trim();
    if (!v) return 'alimentaire';
    if (v.includes('legume') || v.includes('légume') || v.includes('légumes') || v.includes('veget')) return 'legumes';
    if (v.includes('aliment') || v.includes('food') || v.includes('fruit')) return 'alimentaire';
    // fallback: use raw as-is (trim accents/spaces handled by backend slug generation)
    return (raw ? String(raw).trim() : 'alimentaire') || 'alimentaire';
  };

  const findOrCreateCategoryId = async (raw: any) => {
    const nameGuess = normalizeCategoryNameFromExcel(raw);
    const existing =
      categories.find((c) => c.slug === nameGuess) ||
      categories.find((c) => c.name.toLowerCase().trim() === nameGuess.toLowerCase().trim());

    if (existing) return existing.id;

    const created = await addCategory({ name: nameGuess });
    if (!created) throw new Error('Impossible de créer la catégorie depuis Excel');
    return created.id;
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await readXlsxFile(file) as any[];
      if (!rows || rows.length <= 1) {
        showToast('Fichier Excel vide ou invalide', 'error');
        return;
      }

      const dataRows = rows.slice(1);
      let count = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const name = row[0];
        const desc = row[1];
        const price = row[2];
        const unit = row[3];
        const excelCategory = row[4];
        const imageUrl = row[5];
        const labels = row[6];

        if (name && price) {
          const resolvedCategoryId = await findOrCreateCategoryId(excelCategory);

          await addProduct({
            name: String(name),
            description: desc ? String(desc) : '',
            price: Number(price),
            unit: unit ? String(unit) : 'kg',
            category_id: resolvedCategoryId,
            image_url: imageUrl
              ? String(imageUrl)
              : 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=300&h=300&fit=crop',
            labels: labels ? String(labels) : '',
            stock_quantity: 100,
            bgColor: 'white',
            inStock: true,
            published: true,
          } as any);

          count++;
        }
      }
      showToast(`${count} produits importés ! ✅`);
    } catch (err: any) {
      console.error(err);
      showToast('Erreur importation Excel ❌', 'error');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-800">🍎 {products.length} produits</h3>
          <button onClick={handleExcelExport} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-1">📊 Exporter Excel</button>
          
          <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx, .xls" className="hidden" />
          <button 
            onClick={() => excelInputRef.current?.click()} 
            className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1"
          >
            📥 Importer Excel
          </button>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>Nouveau produit</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayedProducts.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
            <div className="h-32 bg-gray-50 flex items-center justify-center relative overflow-hidden">
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                {p.labels?.split(',').map((label, idx) => {
                  const text = label.trim().toLowerCase();
                  if (!text) return null;
                  let icon = '✨';
                  if (text === 'top') icon = '🔥';
                  if (text === 'promo') icon = '🏷️';
                  if (text === 'bio') icon = '🌿';
                  if (text === 'local') icon = '🇲🇱';
                  return (
                    <span key={idx} className="bg-gray-900/70 text-white text-[7px] px-1.5 py-0.5 rounded uppercase font-black flex items-center gap-1">
                      <span>{icon}</span> {label.trim()}
                    </span>
                  );
                })}
              </div>
              {!p.published && <span className="absolute top-2 right-2 bg-red-600 text-white text-[8px] px-2 py-0.5 rounded-full uppercase font-bold">Masqué</span>}
              {p.is_popular && <span className="absolute top-2 right-2 bg-amber-500 text-white text-[8px] px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1"><span>⭐</span> Populaire</span>}
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-gray-800 text-sm truncate">{p.name}</h4>
                <p className="text-[10px] text-gray-400 line-clamp-2 mb-1 min-h-[2.5em]">{p.description}</p>
                <p className="text-xs text-gray-500 font-bold">{p.price.toLocaleString()} F / {p.unit}</p>
              </div>
              <div className="flex gap-1.5 pt-2 border-t border-gray-50">
                <button onClick={async () => {
                  try { await updateProduct(p.id, { published: !p.published }); }
                  catch (e: any) { showToast('Erreur : ' + (e?.message ?? e), 'error'); }
                }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${p.published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{p.published ? 'Public' : 'Masqué'}</button>
                <button onClick={async () => {
                  try { await updateProduct(p.id, { is_popular: !p.is_popular }); }
                  catch (e: any) { showToast('Erreur : ' + (e?.message ?? e), 'error'); }
                }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${p.is_popular ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>{p.is_popular ? '⭐ Populaire' : '☆ Populaire'}</button>
                <button onClick={() => setEditingProduct(p)} className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold transition-all hover:bg-blue-100">✏️</button>
                <button onClick={() => { if(confirm('Supprimer ce produit ?')) deleteProduct(p.id); }} className="px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-[10px] font-bold transition-all hover:bg-red-100">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {visibleCount < products.length && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {visibleCount >= products.length && products.length > 0 && (
        <p className="text-center text-[10px] text-gray-400 font-bold py-4">Tous les produits sont chargés ({products.length})</p>
      )}

      {showAdd && (
        <Modal title="📦 Ajouter un produit" onClose={() => setShowAdd(false)} size="xl">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonne gauche : image + infos de base */}
              <div className="space-y-4">
                 <div onClick={() => fileInputRef.current?.click()} className={`h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${imageUrl ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-green-400'}`}>
                   <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e)} accept="image/*" className="hidden" />
                   {isUploading ? <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /> :
                    imageUrl ? <img src={imageUrl} alt="" className="h-full object-contain p-2" /> : <p className="text-sm text-gray-400 text-center px-4">📸 Cliquez pour ajouter l'image *</p>}
                 </div>
                 <p className="text-[10px] text-gray-400 text-center leading-tight -mt-2">Recommandé : 300×300px (carré) • PNG, JPG, JPEG • Max 2Mo</p>
                 <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nom du produit *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Riz Premium 5kg" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Décrivez le produit..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm h-28 resize-none" />
                </div>
              </div>

              {/* Colonne droite : prix, unité, catégorie, étiquettes, bouton */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Prix (FCFA) *</label>
                    <input type="number" value={price === 0 ? '' : price} onChange={e => setPrice(Number(e.target.value))} onFocus={(e) => price === 0 && (e.target.value = '')} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unité *</label>
                    <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg, sac..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Catégorie *</label>
                  <select
                    value={categoryId ?? ''}
                    onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {categories.length === 0 && <option value="">-- Chargement catégories --</option>}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ou créer une nouvelle catégorie</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nom de la nouvelle catégorie"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Si rempli, ce nom sera utilisé à la place du select ci-dessus.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Stock initial</label>
                  <input type="number" value={stock} onChange={e => setStock(Number(e.target.value))} placeholder="100" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Étiquettes (séparées par des virgules)</label>
                  <input type="text" value={labels} onChange={e => setLabels(e.target.value)} placeholder="Ex: Top, Frais, Bio, Local" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <input
                    type="checkbox"
                    id="add-popular"
                    checked={isPopular}
                    onChange={e => setIsPopular(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <label htmlFor="add-popular" className="text-sm font-bold text-amber-800 cursor-pointer flex items-center gap-1.5">
                    <span>Rendre ce produit populaire</span>
                  </label>
                </div>

                <button onClick={handleCreate} disabled={!name || price <= 0 || !unit || !imageUrl || isUploading} className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 hover:bg-green-700 transition-all active:scale-[0.98]">Ajouter le produit</button>
              </div>
           </div>
        </Modal>
      )}

      {editingProduct && (
        <Modal title={`✏️ Modifier : ${editingProduct.name}`} onClose={() => setEditingProduct(null)} size="xl">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonne gauche : image + infos principales */}
              <div className="space-y-4">
                <div onClick={() => editFileInputRef.current?.click()} className="h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer border-blue-400 bg-blue-50/50 overflow-hidden relative group">
                  <input type="file" ref={editFileInputRef} onChange={(e) => handleFileUpload(e, true)} accept="image/*" className="hidden" />
                  {isUploading ? <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /> :
                   <img src={editingProduct.image_url} alt="" className="h-full object-contain p-2" />}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-2xl"><span className="text-white text-xs font-bold bg-gray-900/50 px-3 py-1 rounded-full">Changer l'image</span></div>
                </div>
                <p className="text-[10px] text-gray-400 text-center leading-tight -mt-2">Recommandé : 300×300px (carré) • PNG, JPG, JPEG • Max 2Mo</p>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nom du produit *</label>
                  <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="Nom *" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="Courte description" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm h-28 resize-none" />
                </div>
              </div>

              {/* Colonne droite : prix, unité, catégorie, stock, étiquettes, bouton */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Prix (FCFA) *</label>
                    <input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unité *</label>
                    <input type="text" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} placeholder="kg, sac..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Catégorie *</label>
                  <select
                    value={editingProduct.category_id ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.length === 0 && <option value="">-- Chargement catégories --</option>}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ou créer une nouvelle catégorie</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nom de la nouvelle catégorie"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Stock</label>
                  <input type="number" value={editingProduct.stock_quantity ?? 0} onChange={e => setEditingProduct({...editingProduct, stock_quantity: Number(e.target.value)})} placeholder="100" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Étiquettes (séparées par des virgules)</label>
                  <input type="text" value={editingProduct.labels || ''} onChange={e => setEditingProduct({ ...editingProduct, labels: e.target.value })} placeholder="Ex: Top, Frais, Bio" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <input
                    type="checkbox"
                    id="edit-published"
                    checked={editingProduct.published ?? false}
                    onChange={e => setEditingProduct({...editingProduct, published: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="edit-published" className="text-sm font-bold text-gray-700 cursor-pointer">Produit publié (visible sur le site)</label>
                </div>

                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <input
                    type="checkbox"
                    id="edit-popular"
                    checked={isPopular}
                    onChange={e => setIsPopular(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <label htmlFor="edit-popular" className="text-sm font-bold text-amber-800 cursor-pointer flex items-center gap-1.5">
                    <span>Rendre ce produit populaire</span>
                  </label>
                </div>

                <button onClick={handleUpdate} disabled={isUploading} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98]">Enregistrer les modifications</button>
              </div>
           </div>
        </Modal>
      )}
    </div>
  );
}

function UtilisateursTab() {
  const { users, updateUser } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filtered = users.filter(u => u.role !== 'livreur').filter(u => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleUpdate = async () => {
    if (!editingUser) return;
    const updates: any = {
      name: editingUser.name,
      phone: editingUser.phone.trim(),
      role: editingUser.role
    };
    try {
      const result = await updateUser(editingUser.id, updates);
      if (result) {
        showToast('Utilisateur mis à jour ✅');
        setEditingUser(null);
        setSelectedUserDetail(result);
      } else {
        showToast('Erreur lors de la mise à jour', 'error');
      }
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800">👥 {filtered.length} utilisateurs</h3><button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>Nouveau</button></div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full px-4 py-3 bg-white border rounded-xl outline-none text-sm" />
      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} onClick={() => setSelectedUserDetail(u)} className={`bg-white p-4 rounded-2xl border-2 transition-all cursor-pointer hover:border-blue-200 flex items-center justify-between ${u.blocked ? 'opacity-50 bg-red-50/20' : ''}`}>
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 text-lg shrink-0 border border-gray-50 font-bold text-gray-300">
                 {u.blocked ? '🔒' : u.avatar.startsWith('http') ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.avatar}
               </div>
               <div><p className="font-bold text-gray-800 text-sm">{u.name}</p><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{u.role === 'admin' ? 'admin' : u.role}</span></div>
             </div>
             <div className="flex gap-2" onClick={e => e.stopPropagation()}>
               <button onClick={() => setEditingUser({ ...u })} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[9px] font-bold rounded-lg transition-all">✏️ Modifier</button>
               <button onClick={() => updateUser(u.id, { blocked: !u.blocked })} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold ${u.blocked ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{u.blocked ? 'Débloquer' : 'Bloquer'}</button>
             </div>
          </div>
        ))}
      </div>

      {selectedUserDetail && (
        <Modal title="👤 Détails de l'utilisateur" onClose={() => setSelectedUserDetail(null)}>
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-lg bg-gray-100 flex items-center justify-center text-4xl">
                {selectedUserDetail.avatar.startsWith('http') ? <img src={selectedUserDetail.avatar} alt="" className="w-full h-full object-cover" /> : selectedUserDetail.avatar}
              </div>
              <div><h2 className="text-xl font-black text-gray-800">{selectedUserDetail.name}</h2><span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-blue-100 text-blue-700">{selectedUserDetail.role}</span></div>
            </div>
            <div className="bg-gray-50 rounded-3xl p-5 space-y-4">
              <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email</p><p className="text-sm font-bold text-gray-700">{selectedUserDetail.email}</p></div>
              <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Téléphone</p><p className="text-sm font-bold text-gray-700">{selectedUserDetail.phone}</p></div>
            </div>
            <div className="flex gap-2">
               <button onClick={() => { setEditingUser(selectedUserDetail); setSelectedUserDetail(null); }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm">✏️ Modifier le compte</button>
               <button onClick={() => setSelectedUserDetail(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm">Fermer</button>
            </div>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal title="✏️ Modifier l'utilisateur" onClose={() => setEditingUser(null)}>
           <div className="space-y-3">
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nom complet</label><input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none text-sm" /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email (non modifiable)</label><input type="email" value={editingUser.email} disabled className="w-full px-4 py-3 bg-gray-100 border rounded-xl outline-none text-sm text-gray-500" /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Téléphone</label><MaliPhoneInput value={editingUser.phone} onChange={(val) => setEditingUser({...editingUser, phone: val})} /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Rôle</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none text-sm"><option value="client">Client</option><option value="admin">admin</option><option value="livreur">Livreur</option></select>
              </div>
              <button onClick={handleUpdate} className="w-full py-3 mt-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Sauvegarder les modifications</button>
           </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="👤 Nouveau compte" onClose={() => setShowCreate(false)}>
           <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 leading-relaxed">
             ℹ️ La création de compte se fait désormais par <b>auto-inscription</b> : demandez à la personne
             de créer son compte depuis la page « Créer un compte », puis attribuez-lui le rôle souhaité
             (ex. « livreur ») via le bouton <b>Modifier</b>.
           </div>
        </Modal>
      )}
    </div>
  );
}

function LivreursTab() {
  const { users, updateUser } = useAuth();
  const { orders } = useOrders();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLivreur, setSelectedLivreur] = useState<User | null>(null);
  const [editingLivreur, setEditingLivreur] = useState<User | null>(null);

  const livreurs = users.filter(u => u.role === 'livreur');

  const handleUpdate = async () => {
    if (!editingLivreur) return;
    const updates: any = {
      name: editingLivreur.name,
      phone: editingLivreur.phone.trim()
    };
    try {
      const result = await updateUser(editingLivreur.id, updates);
      if (result) {
        showToast('Livreur mis à jour ✅');
        setEditingLivreur(null);
      } else {
        showToast('Erreur lors de la mise à jour', 'error');
      }
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800">🛵 {livreurs.length} livreurs</h3><button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>Nouveau livreur</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {livreurs.map(l => {
          const count = orders.filter(o => o.livreurId === l.id).length;
          return (
            <div key={l.id} onClick={() => setSelectedLivreur(l)} className={`bg-white p-5 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${l.blocked ? 'opacity-50 border-red-100 bg-red-50/20' : 'border-gray-100'}`}>
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-gray-100 border shrink-0">{l.avatar.startsWith('http') ? <img src={l.avatar} alt="" className="w-full h-full object-cover" /> : '🛵'}</div><div><p className="font-bold text-gray-800 text-sm">{l.name}</p><p className="text-xs text-gray-500">{l.phone}</p></div></div>
                 {count > 0 && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{count} cmd</span>}
               </div>
               <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                 <button onClick={() => updateUser(l.id, { blocked: !l.blocked })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${l.blocked ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{l.blocked ? 'Activer' : 'Bloquer'}</button>
                 <button onClick={() => setEditingLivreur(l)} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg transition-all hover:bg-blue-100">✏️</button>
               </div>
            </div>
          );
        })}
      </div>

      {editingLivreur && (
        <Modal title="✏️ Modifier le livreur" onClose={() => setEditingLivreur(null)}>
           <div className="space-y-3">
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nom complet</label><input type="text" value={editingLivreur.name} onChange={e => setEditingLivreur({...editingLivreur, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none text-sm" /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email (non modifiable)</label><input type="email" value={editingLivreur.email} disabled className="w-full px-4 py-3 bg-gray-100 border rounded-xl outline-none text-sm text-gray-500" /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Téléphone</label><MaliPhoneInput value={editingLivreur.phone} onChange={(val) => setEditingLivreur({...editingLivreur, phone: val})} /></div>
              <button onClick={handleUpdate} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg mt-4 transition-all active:scale-[0.98]">Sauvegarder</button>
           </div>
        </Modal>
      )}

      {selectedLivreur && <LivreurOrdersModal livreur={selectedLivreur} onClose={() => setSelectedLivreur(null)} />}
      {showAdd && (
        <Modal title="🛵 Nouveau livreur" onClose={() => setShowAdd(false)}>
           <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 leading-relaxed">
             ℹ️ Demandez au livreur de créer son compte via « Créer un compte », puis passez son rôle
             à <b>« livreur »</b> dans l'onglet <b>Utilisateurs → Modifier</b>.
           </div>
        </Modal>
      )}
    </div>
  );
}

function MessagesTab() {
  const {
    messages,
    loading,
    unreadCount,
    refreshMessages,
    markAsRead,
    markAsUnread,
    sendReply,
    deleteMessage,

  } = useContactMessages();

  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const { showToast } = useToast();

  // Filtering and search state
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter messages based on filter and search
  const filteredMessages = messages.filter(msg => {
    // Filter by read status
    if (filter === 'unread' && msg.is_read) return false;
    if (filter === 'read' && !msg.is_read) return false;
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        msg.name?.toLowerCase().includes(query) ||
        msg.email?.toLowerCase().includes(query) ||
        msg.subject?.toLowerCase().includes(query) ||
        msg.message?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Toggle all selection
  const toggleAllSelection = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} message(s) ?`)) return;
    for (const id of selectedIds) {
      await deleteMessage(id);
    }
    setSelectedIds(new Set());
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    for (const msg of filteredMessages.filter(m => !m.is_read)) {
      await markAsRead(msg.id);
    }
  };

  // Helper functions
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar - Modern Gmail style */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <input
          type="checkbox"
          checked={selectedIds.size === filteredMessages.length && filteredMessages.length > 0}
          onChange={toggleAllSelection}
          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <div className="flex items-center gap-1">
          <button onClick={refreshMessages} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Rafraîchir">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button onClick={handleMarkAllAsRead} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Tout marquer lu">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
          <button onClick={handleBulkDelete} disabled={selectedIds.size === 0} className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30" title="Supprimer">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher dans les messages" className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-full text-sm outline-none focus:bg-white focus:border-gray-300 transition-all" />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <div className="flex bg-gray-100 rounded-full p-1">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'all' ? 'Tous' : f === 'unread' ? `Non lus (${unreadCount})` : 'Lus'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full" /></div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="w-24 h-24 mb-4 rounded-full bg-gray-200 flex items-center justify-center"><svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
          <p className="text-lg font-medium">Aucun message</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Message List */}
          <div className={`${selectedMessage ? 'w-1/3' : 'w-full'} border-r border-gray-200 bg-white overflow-y-auto`}>
            {filteredMessages.map(message => (
              <div key={message.id} onClick={() => { setSelectedMessage(message); if (!message.is_read) markAsRead(message.id); }}
                className={`flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:bg-gray-50 ${selectedMessage?.id === message.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'} ${!message.is_read ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="shrink-0">{!message.is_read && <div className="w-3 h-3 bg-blue-500 rounded-full" />}</div>
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(message.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>{getInitials(message.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <p className={`truncate ${!message.is_read ? 'font-bold text-gray-900' : 'text-gray-700'} text-sm`}>{message.name}</p>
                    <p className="text-xs text-gray-400 shrink-0">{formatDate(message.created_at)}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{message.subject || 'Aucun sujet'}</p>
                  <p className="text-xs text-gray-400 truncate">{message.message?.slice(0, 60)}...</p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Detail */}
          {selectedMessage && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${getAvatarColor(selectedMessage.name)} flex items-center justify-center text-white font-bold`}>{getInitials(selectedMessage.name)}</div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedMessage.name}</h3>
                    <p className="text-sm text-gray-500">{selectedMessage.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 mr-2">{new Date(selectedMessage.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => selectedMessage.is_read ? markAsUnread(selectedMessage.id) : markAsRead(selectedMessage.id)} className={`p-2 rounded-full transition-colors ${selectedMessage.is_read ? 'hover:bg-gray-100' : 'bg-blue-50'}`} title={selectedMessage.is_read ? 'Marquer non lu' : 'Marquer lu'}>
                    <svg className={`w-5 h-5 ${selectedMessage.is_read ? 'text-gray-600' : 'text-blue-600'}`} fill={selectedMessage.is_read ? 'none' : 'currentColor'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(selectedMessage.email)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Copier email">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button onClick={() => deleteMessage(selectedMessage.id)} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500" title="Supprimer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
                  <p className="text-sm font-medium text-gray-400 mb-2">{selectedMessage.subject || 'Aucun sujet'}</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.message}</p>
                  {selectedMessage.phone && <p className="mt-4 pt-4 border-t text-sm text-gray-500">📞 {selectedMessage.phone}</p>}
                </div>
                {/* Reply */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Écrire une réponse..." rows={4} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
                  <div className="flex gap-2 mt-3">
                    <button onClick={async () => { if (selectedMessage) { await sendReply(selectedMessage.id, replyContent); setReplyContent(''); } }} disabled={!replyContent.trim()} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all">Envoyer</button>
                  </div>
                </div>
                {selectedMessage.response && <div className="bg-green-50 rounded-xl p-4 border border-green-200 mt-4"><p className="text-xs font-bold text-green-700 mb-2">Réponse envoyée</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.response}</p></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdsTab() {
  const { ads, addAd, updateAd, deleteAd, seedAds, loading } = useAds();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState<AdPosition>('middle');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fileName = `ads/${Date.now()}-${file.name}`;
    try {
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
      if (isEdit && editingAd) { setEditingAd({ ...editingAd, image_url: publicUrl }); } 
      else { setImageUrl(publicUrl); }
      showToast('Image chargée ✅');
    } catch (err: any) { showToast('Erreur : ' + err.message, 'error'); } finally { setIsUploading(false); }
  };

  const handleCreate = async () => {
    if (!title || !imageUrl) { showToast('Titre et Image requis', 'error'); return; }
    const res = await addAd({ title, image_url: imageUrl, link_url: linkUrl, position, active: true } as Omit<Ad, 'id' | 'created_at'>);
    if (res) { showToast('Publicité créée !'); setShowAdd(false); setTitle(''); setImageUrl(''); setLinkUrl(''); }
  };

  const handleUpdate = async () => {
    if (!editingAd) return;
    
    // Explicitly destructure only database-compliant fields
    const { title, image_url, link_url, position, active } = editingAd;
    
    if (!title || !image_url) { 
      showToast('Le titre et l\'image sont obligatoires', 'error'); 
      return; 
    }
    
    const updates = { title, image_url, link_url: link_url || '', position, active };

    try {
      const res = await updateAd(editingAd.id, updates);
      if (res) { 
        showToast('Publicité mise à jour ✅'); 
        setEditingAd(null); 
      } else { 
        showToast('Erreur lors de l\'enregistrement', 'error'); 
      }
    } catch (err: any) {
      showToast('Erreur technique : ' + err.message, 'error');
    }
  };

  const handleSeed = async () => {
    if (!confirm('Générer les publicités de test ?')) return;
    setIsSeeding(true);
    await seedAds();
    setIsSeeding(false);
    showToast('Publicités générées ✅');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-800">📢 {ads.length} publicités</h3>
          <button onClick={handleSeed} disabled={isSeeding} className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg disabled:opacity-50">{isSeeding ? 'Génération...' : '📥 Générer tests'}</button>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>Nouvelle campagne</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && ads.length === 0 ? <p className="text-center col-span-full py-10 text-gray-400">Chargement...</p> : 
          ads.map(ad => (
            <div key={ad.id} className={`bg-white rounded-3xl border-2 transition-all overflow-hidden flex flex-col ${ad.active ? 'border-gray-100 shadow-sm' : 'border-red-100 opacity-60 bg-red-50/10'}`}>
              <div className="h-48 bg-gray-100 relative">
                <img src={ad.image_url} alt="" className="w-full h-full object-contain bg-white p-2" />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{ad.position}</div>
                {!ad.active && <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center"><span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">DÉSACTIVÉE</span></div>}
              </div>
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{ad.title}</h4>
                <div className="flex gap-2">
                  <button onClick={() => updateAd(ad.id, { active: !ad.active })} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ad.active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{ad.active ? 'Active' : 'Désactivée'}</button>
                  <button onClick={() => setEditingAd(ad)} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black hover:bg-blue-100">✏️</button>
                  <button onClick={() => { if(confirm('Supprimer cette pub ?')) deleteAd(ad.id); }} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black hover:bg-red-100">🗑</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {showAdd && (
        <Modal title="📢 Nouvelle publicité" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 mb-2">ⓘ Informations importantes</h4>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Utilisez des images de haute qualité (format paysage recommandé)</li>
                <li>Taille optimale : 1200x628 pixels pour un affichage parfait</li>
                <li>Format d'image : JPEG, PNG ou WebP</li>
                <li>Taille maximale : 2 Mo</li>
                <li>Les publicités sont affichées en rotation sur la page d'accueil</li>
                <li>Évitez le texte dans l'image - utilisez plutôt le champ "Texte"</li>
              </ul>
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="group relative h-40 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-gray-50 hover:border-red-400 transition-all">
              <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e)} accept="image/*" className="hidden" />
              {isUploading ? <div className="animate-spin w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full" /> : 
               imageUrl ? <img src={imageUrl} alt="" className="h-full object-contain p-2" /> : <div className="text-center"><span className="text-3xl block mb-1">📸</span><p className="text-xs font-bold text-gray-400">Ajouter la bannière *</p></div>}
            </div>
            <p className="text-[10px] text-gray-400 text-center leading-tight">Recommandé : 1200x400px (Paysage)<br/>Format : PNG, JPG, JPEG (Max 2Mo)</p>
            <div className="space-y-3">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la campagne *" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm focus:ring-2 focus:ring-red-500" />
              <input type="text" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="Lien de redirection (ex: #produits)" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm focus:ring-2 focus:ring-red-500" />
              <select value={position} onChange={e => setPosition(e.target.value as AdPosition)} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm">
                <option value="top">Haut de page (Banner large)</option>
                <option value="middle">Milieu de page (Rotation)</option>
                <option value="footer">Bas de page (Avant le pied de page)</option>
              </select>
            </div>
            <button onClick={handleCreate} disabled={!title || !imageUrl || isUploading} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl hover:bg-red-700 disabled:opacity-40 transition-all">Lancer la campagne</button>
          </div>
        </Modal>
      )}

      {editingAd && (
        <Modal title="✏️ Modifier la publicité" onClose={() => setEditingAd(null)}>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 mb-2">ⓘ Informations importantes</h4>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Utilisez des images de haute qualité (format paysage recommandé)</li>
                <li>Taille optimale : 1200x628 pixels pour un affichage parfait</li>
                <li>Format d'image : JPEG, PNG ou WebP</li>
                <li>Taille maximale : 2 Mo</li>
                <li>Les publicités sont affichées en rotation sur la page d'accueil</li>
                <li>Évitez le texte dans l'image - utilisez plutôt le champ "Texte"</li>
              </ul>
            </div>
            <div onClick={() => editFileInputRef.current?.click()} className="group relative h-40 border-2 border-dashed border-blue-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-blue-50/30 overflow-hidden">
              <input type="file" ref={editFileInputRef} onChange={(e) => handleFileUpload(e, true)} accept="image/*" className="hidden" />
              {isUploading ? <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full" /> : 
               <img src={editingAd.image_url} alt="" className="h-full object-contain p-2" />}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><span className="text-white text-[10px] font-black bg-gray-900/50 px-3 py-1 rounded-full">Changer l'image</span></div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">⚙️ État : {editingAd.active ? <span className="text-green-600">Active</span> : <span className="text-red-500">Désactivée</span>}</span>
              <button onClick={() => setEditingAd({...editingAd, active: !editingAd.active})} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${editingAd.active ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-200 text-gray-500'}`}>{editingAd.active ? 'Activée' : 'Activer'}</button>
            </div>

            <div className="space-y-3">
              <input type="text" value={editingAd.title} onChange={e => setEditingAd({...editingAd, title: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={editingAd.link_url || ''} onChange={e => setEditingAd({...editingAd, link_url: e.target.value})} placeholder="Lien" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm focus:ring-2 focus:ring-blue-500" />
              <select value={editingAd.position} onChange={e => setEditingAd({...editingAd, position: e.target.value as AdPosition})} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none text-sm">
                <option value="top">Haut de page</option>
                <option value="middle">Milieu de page</option>
                <option value="footer">Bas de page</option>
              </select>
            </div>
            <button onClick={handleUpdate} disabled={isUploading} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-40 transition-all">Enregistrer les modifications</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
}) {
  const sizeClass: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${sizeClass[size]} max-h-[90vh] overflow-y-auto animate-slide-up`}>
        <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function LivreurOrdersModal({ livreur, onClose }: { livreur: User; onClose: () => void }) {
  const { orders } = useOrders();
  const livreurOrders = orders.filter(o => o.livreurId === livreur.id);
  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const grouped = livreurOrders.reduce((acc, o) => { if (!acc[o.status]) acc[o.status] = []; acc[o.status].push(o); return acc; }, {} as Record<OrderStatus, Order[]>);
  const displayStatuses: OrderStatus[] = ['en_livraison', 'en_preparation', 'confirmee', 'livree', 'annulee'];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-orange-100 flex items-center justify-center text-2xl border shadow-sm shrink-0">
              {livreur.avatar.startsWith('http') ? <img src={livreur.avatar} alt="" className="w-full h-full object-cover" /> : '🛵'}
            </div>
            <div><h3 className="font-bold text-xl text-gray-800">{livreur.name}</h3><p className="text-xs text-gray-400">{livreurOrders.length} commandes</p></div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {livreurOrders.length === 0 ? <div className="text-center py-12 text-gray-400"><p className="text-lg">Aucune commande</p></div> : 
            displayStatuses.map(status => {
              const list = grouped[status] || []; if (list.length === 0) return null;
              return (
                <div key={status} className="space-y-3">
                  <h4 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${statusLabels[status].color}`}><span className={`w-2 h-2 rounded-full`} style={{backgroundColor: 'currentColor'}} />{statusLabels[status].label} ({list.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {list.map(o => (
                      <div key={o.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-start"><span className="text-[10px] font-mono font-bold text-gray-400">{o.id}</span></div>
                        <p className="text-sm font-bold text-gray-800">{o.customerName}</p>
                        <div className="pt-2 flex justify-between items-center border-t border-gray-200/50"><span className="text-xs font-bold text-green-600">{fmt(o.totalPrice)} F</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
