import { useState, useRef, useEffect, useDeferredValue } from 'react';
import {
  useOrders,
  useAuth,
  useProducts,
  useAds,
  useNotifications,
  useCategories,
  getSupabase,
  apiGetPaymentMethods,
  apiUpdatePaymentMethod,
} from '@lumoo/core';
import type { Order, OrderStatus, PaymentMethod, PaymentMethodConfig, PaymentMethodType, Product, Ad, AdPosition, ContactMessage, User, UserRole, LivreurUpdateInput } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import { useContactMessages } from '../context/ContactMessagesContext';
import Logo from './Logo';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import readXlsxFile from 'read-excel-file/browser';
import writeExcelFile, { getSheetData, type Column } from 'write-excel-file/browser';
import MaliPhoneInput from './MaliPhoneInput';

const paymentLogos: Record<PaymentMethod, React.ReactNode> = {
  orange_money: <OrangeMoneyLogo className="w-4 h-4" />,
  moov_money: <MoovMoneyLogo className="w-4 h-4" />,
  wave: <WaveLogo className="w-4 h-4" />,
  livraison: <CashLogo className="w-4 h-4" />,
};

const paymentNames: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
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

type Tab = 'dashboard' | 'commandes' | 'produits' | 'utilisateurs' | 'livreurs' | 'publicites' | 'messages' | 'paiements';

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { key: 'commandes', label: 'Commandes', emoji: '📦' },
  { key: 'produits', label: 'Produits', emoji: '🍎' },
  { key: 'publicites', label: 'Publicités', emoji: '📢' },
  { key: 'messages', label: 'Messages', emoji: '💬' },
  { key: 'utilisateurs', label: 'Utilisateurs', emoji: '👥' },
  { key: 'livreurs', label: 'Livreurs', emoji: '🛵' },
  { key: 'paiements', label: 'Paiements', emoji: '💳' },
];

export default function AdminPanel({ onClose, initialOrderId }: { onClose: () => void; initialOrderId?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialOrderId ? 'commandes' : 'dashboard');
  const [initialSearch] = useState(initialOrderId || '');

  useEffect(() => {
    const body = document.body;
    const documentElement = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
    };
  }, []);

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
        {activeTab === 'paiements' && <PaiementsTab />}
      </div>
    </div>
  );
}

function PaiementsTab() {
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiGetPaymentMethods().then((m) => { setMethods(m); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">Méthodes de paiement</h2>
        <p className="text-sm text-gray-400 mt-1">Active/désactive et configure ce qui s'affiche au checkout (web + mobile). Effet immédiat, sans redéploiement.</p>
      </div>
      {loading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : methods.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          La table <code className="font-mono">payment_methods</code> n'existe pas encore. Lance le SQL fourni, puis reviens ici.
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => <PaymentRow key={m.id} method={m} onChanged={load} />)}
          {methods.filter(m => m.enabled).length === 0 && (
            <p className="text-sm text-red-600 font-semibold">⚠️ Aucune méthode active : le checkout n'affichera aucune option de paiement.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ method, onChanged }: { method: PaymentMethodConfig; onChanged: () => void }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(method.label);
  const [description, setDescription] = useState(method.description);
  const [type, setType] = useState<PaymentMethodType>(method.type);
  const [payUrl, setPayUrl] = useState(method.payUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(method.sortOrder));

  const typeLabel = method.type === 'link' ? '🔗 Paiement en ligne' : method.type === 'cash' ? '💵 À la livraison' : '📱 Numéro + WhatsApp';
  const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none';

  const toggle = async () => {
    const ok = await apiUpdatePaymentMethod(method.id, { enabled: !method.enabled });
    if (!ok) showToast('Échec de la mise à jour.', 'error');
    else { showToast(`${method.label} ${!method.enabled ? 'activée' : 'désactivée'}`); onChanged(); }
  };

  const save = async () => {
    setSaving(true);
    const ok = await apiUpdatePaymentMethod(method.id, {
      label: label.trim() || method.label,
      description: description.trim(),
      type,
      payUrl: payUrl.trim() || null,
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
    if (!ok) { showToast("Échec de l'enregistrement.", 'error'); return; }
    showToast('Enregistré ✅'); setEditing(false); onChanged();
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">{paymentLogos[method.id]}</div>
          <div className="min-w-0">
            <p className="font-bold text-gray-800 truncate">{method.label}</p>
            <p className="text-xs text-gray-400 truncate">{typeLabel}{method.description ? ` · ${method.description}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setEditing(e => !e)} className="text-xs font-bold text-gray-500 hover:text-green-600 transition-colors">{editing ? 'Fermer' : 'Éditer'}</button>
          <button onClick={toggle} role="switch" aria-checked={method.enabled} aria-label={`${method.enabled ? 'Désactiver' : 'Activer'} ${method.label}`} className={`relative w-12 h-7 rounded-full transition-colors ${method.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${method.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nom affiché</label>
            <input value={label} onChange={e => setLabel(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as PaymentMethodType)} className={inputCls}>
              <option value="cash">À la livraison (espèces)</option>
              <option value="manual">Numéro + WhatsApp</option>
              <option value="link">Page de paiement en ligne</option>
            </select>
          </div>
          {type === 'link' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">URL de paiement (pay_url)</label>
              <input value={payUrl} onChange={e => setPayUrl(e.target.value)} placeholder="https://…" className={inputCls} />
              <p className="text-[10px] text-amber-600 mt-1">⚠️ Page de paiement hébergée que tu contrôles. Le mobile l'ouvre dans un navigateur sécurisé. À renseigner seulement quand tu as un vrai fournisseur.</p>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ordre d'affichage</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">Annuler</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}
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
    const supabase = getSupabase();
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
                  // Notif livreur "nouvelle mission" : gérée côté serveur (trigger Postgres sur livreur_id).
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
  const [promoPrice, setPromoPrice] = useState<number | null>(null);
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
    const supabase = getSupabase();
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
    if (promoPrice !== null && (promoPrice <= 0 || promoPrice >= price)) {
      showToast('Le prix promo doit être supérieur à 0 et inférieur au prix normal.', 'error');
      return;
    }
    try {
      const resolvedCategoryId = await ensureCategoryId(categoryId);
      const p = await addProduct({
        name,
        description: desc || '',
        price,
        promo_price: promoPrice,
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
        setPromoPrice(null);
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
    if (editingProduct.promo_price != null && (editingProduct.promo_price <= 0 || editingProduct.promo_price >= editingProduct.price)) {
      showToast('Le prix promo doit être supérieur à 0 et inférieur au prix normal.', 'error');
      return;
    }

    try {
      const resolvedCategoryId = await ensureCategoryId(editingProduct.category_id);
      const updates = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        promo_price: editingProduct.promo_price ?? null,
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
      const columns: Column<Product>[] = [
        { header: { value: 'Nom', fontWeight: 'bold' }, cell: product => ({ value: product.name }), width: 20 },
        { header: { value: 'Description', fontWeight: 'bold' }, cell: product => ({ value: product.description }), width: 30 },
        { header: { value: 'Prix', fontWeight: 'bold' }, cell: product => ({ value: product.price }), width: 10 },
        { header: { value: 'Unité', fontWeight: 'bold' }, cell: product => ({ value: product.unit }), width: 10 },
        {
          header: { value: 'Catégorie', fontWeight: 'bold' },
          cell: product => ({ value: typeof product.category === 'string' ? product.category : (product.category?.name ?? product.category?.slug ?? '') }),
          width: 15,
        },
        { header: { value: 'Image URL', fontWeight: 'bold' }, cell: product => ({ value: product.image_url }), width: 30 },
        { header: { value: 'Étiquettes', fontWeight: 'bold' }, cell: product => ({ value: product.labels }), width: 20 },
        { header: { value: 'Prix promo', fontWeight: 'bold' }, cell: product => ({ value: product.promo_price ?? '' }), width: 12 },
      ];

      const sheetData = getSheetData(products, columns);
      await writeExcelFile(sheetData, { sheet: 'Produits', columns }).toFile(
        `lumoo_catalogue_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      
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
        const promoPrice = row[7] === null || row[7] === undefined || row[7] === '' ? null : Number(row[7]);

        if (name && price) {
          if (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice <= 0 || promoPrice >= Number(price))) {
            throw new Error(`Prix promo invalide à la ligne ${i + 2} : il doit être supérieur à 0 et inférieur au prix.`);
          }
          const resolvedCategoryId = await findOrCreateCategoryId(excelCategory);

          await addProduct({
            name: String(name),
            description: desc ? String(desc) : '',
            price: Number(price),
            promo_price: promoPrice,
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
                <p className="text-xs text-gray-500 font-bold">
                  {p.promo_price != null && p.promo_price > 0 && p.promo_price < p.price
                    ? <><span className="text-red-600">{p.promo_price.toLocaleString()} F</span> <span className="text-gray-400 line-through">{p.price.toLocaleString()} F</span></>
                    : `${p.price.toLocaleString()} F`} / {p.unit}
                </p>
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
                 <div onClick={() => fileInputRef.current?.click()} className={`relative h-48 overflow-hidden border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${imageUrl ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-green-400'}`}>
                   <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e)} accept="image/*" className="hidden" />
                   {isUploading ? <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /> :
                    imageUrl ? <img src={imageUrl} alt="" className="h-full object-contain p-2" /> : <p className="text-sm text-gray-400 text-center px-4">📸 Cliquez pour ajouter l'image *</p>}
                   {promoPrice !== null && promoPrice > 0 && promoPrice < price && (
                     <span className="absolute left-3 top-3 rounded-lg bg-red-700 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow">
                       Promo
                     </span>
                   )}
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
                    <input type="number" min="1" step="1" value={price === 0 ? '' : price} onChange={e => setPrice(Number(e.target.value))} onFocus={(e) => price === 0 && (e.target.value = '')} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unité *</label>
                    <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg, sac..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                  </div>
                </div>

                <div>
                  <label htmlFor="add-promo-price" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Prix promo (FCFA)</label>
                  <input
                    id="add-promo-price"
                    type="number"
                    min="1"
                    max={price > 1 ? price - 1 : undefined}
                    step="1"
                    value={promoPrice ?? ''}
                    onChange={e => setPromoPrice(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Laisser vide sans promotion"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                  />
                  <p className="mt-1 text-xs text-gray-500">Doit être inférieur au prix normal. Une étiquette rouge « Promo » s’affichera automatiquement.</p>
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
                  {editingProduct.promo_price != null && editingProduct.promo_price > 0 && editingProduct.promo_price < editingProduct.price && (
                    <span className="absolute left-3 top-3 rounded-lg bg-red-700 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow">
                      Promo
                    </span>
                  )}
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
                    <input type="number" min="1" step="1" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unité *</label>
                    <input type="text" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} placeholder="kg, sac..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-promo-price" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Prix promo (FCFA)</label>
                  <input
                    id="edit-promo-price"
                    type="number"
                    min="1"
                    max={editingProduct.price > 1 ? editingProduct.price - 1 : undefined}
                    step="1"
                    value={editingProduct.promo_price ?? ''}
                    onChange={e => setEditingProduct({
                      ...editingProduct,
                      promo_price: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    placeholder="Laisser vide sans promotion"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  />
                  <p className="mt-1 text-xs text-gray-500">Doit être inférieur au prix normal. Laissez vide pour retirer la promotion.</p>
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
  const { users, updateUser, deleteUser, isAdmin, user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState<'tous' | 'client' | 'admin'>('tous');
  const [statusFilter, setStatusFilter] = useState<'tous' | 'actifs' | 'bloques'>('tous');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const visibleUsers = users.filter(user => user.role !== 'livreur');
  const normalizedSearch = deferredSearch.trim().toLocaleLowerCase();
  const filtered = visibleUsers.filter(user => {
    const matchesSearch = !normalizedSearch || [
      user.name,
      user.email,
      user.phone,
      user.city,
    ].some(value => value?.toLocaleLowerCase().includes(normalizedSearch));
    const matchesRole = roleFilter === 'tous' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'tous'
      || (statusFilter === 'bloques' ? user.blocked : !user.blocked);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleToggleBlocked = async (user: User) => {
    if (pendingUserId) return;
    setPendingUserId(user.id);
    try {
      const updated = await updateUser(user.id, { blocked: !user.blocked });
      if (!updated) throw new Error('Le statut du compte n’a pas pu être modifié.');
      if (selectedUserDetail?.id === user.id) setSelectedUserDetail(updated);
      showToast(user.blocked ? 'Compte réactivé.' : 'Compte bloqué.');
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de modifier le statut du compte.'), 'error');
    } finally {
      setPendingUserId(null);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser || pendingUserId) return;
    if ((editingUser.gps_lat == null) !== (editingUser.gps_lng == null)) {
      showToast('Renseignez les deux coordonnées GPS ou laissez-les vides.', 'error');
      return;
    }
    if (
      (editingUser.gps_lat != null && (editingUser.gps_lat < -90 || editingUser.gps_lat > 90))
      || (editingUser.gps_lng != null && (editingUser.gps_lng < -180 || editingUser.gps_lng > 180))
    ) {
      showToast('Les coordonnées GPS sont hors limites.', 'error');
      return;
    }

    setPendingUserId(editingUser.id);
    const updates: Partial<User> = {
      name: editingUser.name.trim(),
      phone: editingUser.phone.trim(),
      role: editingUser.role,
      address: editingUser.address?.trim() ?? '',
      city: editingUser.city?.trim() ?? '',
      gps_lat: editingUser.gps_lat ?? null,
      gps_lng: editingUser.gps_lng ?? null,
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
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de modifier l’utilisateur.'), 'error');
    } finally {
      setPendingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || !isAdmin || isDeletingUser) return;
    setIsDeletingUser(true);
    try {
      const warning = await deleteUser(deletingUser.id);
      setEditingUser(null);
      setSelectedUserDetail(null);
      setDeletingUser(null);
      showToast(warning ?? `Le compte de ${deletingUser.name} a été supprimé.`);
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de supprimer cet utilisateur.'), 'error');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-green-100 bg-gradient-to-br from-white via-white to-green-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-green-800">Espace administration</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">Gestion des utilisateurs</h3>
          <p className="mt-1 text-sm text-gray-700">Retrouvez les comptes clients et administrateurs.</p>
        </div>
      </header>

      <section aria-label="Résumé des utilisateurs" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Comptes affichés', value: visibleUsers.length, color: 'text-gray-900', icon: 'M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M12 7a4 4 0 11-8 0 4 4 0 018 0zm8 4a4 4 0 10-3-6.87' },
          { label: 'Clients', value: visibleUsers.filter(user => user.role === 'client').length, color: 'text-green-800', icon: 'M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M12 7a4 4 0 11-8 0 4 4 0 018 0zm8 4a4 4 0 10-3-6.87' },
          { label: 'Comptes bloqués', value: visibleUsers.filter(user => user.blocked).length, color: 'text-red-800', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
        ].map(metric => (
          <div key={metric.label} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 ${metric.color}`}>
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={metric.icon} />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{metric.value}</p>
              <p className="text-sm font-medium text-gray-700">{metric.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Rechercher et filtrer les utilisateurs" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="relative">
          <label htmlFor="users-search" className="sr-only">Rechercher un utilisateur</label>
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="m20 20-4-4" />
          </svg>
          <input
            id="users-search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Rechercher par nom, e-mail, téléphone ou ville"
            className="min-h-12 w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-12 pr-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-600 focus:border-green-700 focus:bg-white focus:ring-2 focus:ring-green-100"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">Type de compte</legend>
            <div className="flex flex-wrap gap-2">
              {([
                ['tous', 'Tous'],
                ['client', 'Clients'],
                ['admin', 'Administrateurs'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={roleFilter === value}
                  onClick={() => setRoleFilter(value)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1 ${roleFilter === value ? 'border-green-800 bg-green-800 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">Statut</legend>
            <div className="flex flex-wrap gap-2">
              {([
                ['tous', 'Tous'],
                ['actifs', 'Actifs'],
                ['bloques', 'Bloqués'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1 ${statusFilter === value ? 'border-green-800 bg-green-800 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="text-sm text-gray-700" role="status" aria-live="polite">
          {filtered.length} résultat{filtered.length === 1 ? '' : 's'} sur {visibleUsers.length} compte{visibleUsers.length === 1 ? '' : 's'}
        </p>
      </section>

      {filtered.length ? (
        <section aria-label="Liste des utilisateurs" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(user => {
            const isImageAvatar = user.avatar?.startsWith('http');
            const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase() || '?';
            return (
              <article key={user.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${user.blocked ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}>
                <div className="flex min-w-0 items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-lg font-black ${user.blocked ? 'border-red-200 bg-red-100 text-red-900' : user.role === 'admin' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-900'}`}>
                    {isImageAvatar
                      ? <img src={user.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="break-words text-base font-bold text-gray-900">{user.name || 'Nom non renseigné'}</h4>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.role === 'admin' ? 'bg-amber-100 text-amber-950' : 'bg-green-100 text-green-900'}`}>
                        {user.role === 'admin' ? 'Administrateur' : 'Client'}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-sm text-gray-800">{user.email || 'E-mail non renseigné'}</p>
                    <p className="mt-1 text-sm text-gray-700">{user.phone || 'Téléphone non renseigné'}</p>
                    {user.city && <p className="mt-1 text-sm text-gray-700">{user.city}</p>}
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex ${user.blocked ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`}>
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${user.blocked ? 'bg-red-700' : 'bg-green-700'}`} />
                    {user.blocked ? 'Bloqué' : 'Actif'}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className={`inline-flex min-h-8 items-center gap-2 text-sm font-semibold sm:hidden ${user.blocked ? 'text-red-900' : 'text-green-900'}`}>
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${user.blocked ? 'bg-red-700' : 'bg-green-700'}`} />
                    {user.blocked ? 'Compte bloqué' : 'Compte actif'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedUserDetail(user)}
                    className="min-h-11 rounded-xl px-3 text-left text-sm font-bold text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700 sm:mr-auto"
                  >
                    Voir le profil
                  </button>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...user })}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1"
                    >
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 2.651 2.651M8 16l8.862-8.862a1.875 1.875 0 112.652 2.652L10.652 18.65a4 4 0 01-1.697 1.01L5 21l1.34-3.955A4 4 0 017.35 15.35z" />
                      </svg>
                      Modifier
                    </button>
                    {isAdmin && user.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => setDeletingUser(user)}
                        disabled={isDeletingUser}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-2 text-sm font-bold text-red-900 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 sm:px-3"
                      >
                        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3m-12 0h18" />
                        </svg>
                        Supprimer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleBlocked(user)}
                      disabled={pendingUserId === user.id}
                      className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${user.blocked ? 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100 focus:ring-green-700' : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 focus:ring-amber-700'}`}
                    >
                      {pendingUserId === user.id ? 'Mise à jour…' : user.blocked ? 'Réactiver' : 'Bloquer'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="m20 20-4-4" />
            </svg>
          </div>
          <h4 className="mt-4 text-base font-bold text-gray-900">Aucun utilisateur trouvé</h4>
          <p className="mt-1 text-sm text-gray-700">Essayez un autre terme ou modifiez les filtres.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setRoleFilter('tous');
              setStatusFilter('tous');
            }}
            className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-green-800 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700"
          >
            Effacer les filtres
          </button>
        </div>
      )}

      {selectedUserDetail && (
        <Modal title="Profil utilisateur" onClose={() => setSelectedUserDetail(null)}>
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-gray-200 bg-green-50 text-3xl font-black text-green-900">
                {selectedUserDetail.avatar?.startsWith('http')
                  ? <img src={selectedUserDetail.avatar} alt="" className="h-full w-full object-cover" />
                  : selectedUserDetail.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">{selectedUserDetail.name}</h2>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold ${selectedUserDetail.role === 'admin' ? 'bg-amber-100 text-amber-950' : 'bg-green-100 text-green-900'}`}>
                  {selectedUserDetail.role === 'admin' ? 'Administrateur' : 'Client'}
                </span>
              </div>
            </div>
            <dl className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">E-mail</dt>
                <dd className="mt-1 break-all text-base font-semibold text-gray-900">{selectedUserDetail.email || 'Non renseigné'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">Téléphone</dt>
                <dd className="mt-1 text-base font-semibold text-gray-900">{selectedUserDetail.phone || 'Non renseigné'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">Statut du compte</dt>
                <dd className={`mt-1 text-base font-bold ${selectedUserDetail.blocked ? 'text-red-800' : 'text-green-800'}`}>
                  {selectedUserDetail.blocked ? 'Bloqué' : 'Actif'}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setEditingUser({ ...selectedUserDetail });
                  setSelectedUserDetail(null);
                }}
                className="min-h-11 flex-1 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
              >
                Modifier le compte
              </button>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="min-h-11 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal
          title="Modifier l’utilisateur"
          onClose={() => {
            if (pendingUserId !== editingUser.id) setEditingUser(null);
          }}
          size="lg"
        >
          <form onSubmit={handleUpdate} className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
              <div>
                <h4 className="font-bold text-gray-900">Informations du compte</h4>
                <p className="mt-1 text-sm text-gray-700">Modifiez les coordonnées et le rôle de cet utilisateur.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-user-name" className="mb-1 block text-sm font-semibold text-gray-800">Nom complet</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editingUser.name}
                    onChange={event => setEditingUser({ ...editingUser, name: event.target.value })}
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    required
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-email" className="mb-1 block text-sm font-semibold text-gray-800">Adresse e-mail</label>
                  <input
                    id="edit-user-email"
                    type="email"
                    value={editingUser.email}
                    readOnly
                    autoComplete="email"
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-base text-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-600">L’adresse e-mail ne peut pas être modifiée ici.</p>
                </div>
                <div>
                  <label htmlFor="edit-user-phone" className="mb-1 block text-sm font-semibold text-gray-800">Téléphone</label>
                  <MaliPhoneInput
                    id="edit-user-phone"
                    value={editingUser.phone}
                    onChange={phone => setEditingUser({ ...editingUser, phone })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-role" className="mb-1 block text-sm font-semibold text-gray-800">Rôle</label>
                  <select
                    id="edit-user-role"
                    value={editingUser.role}
                    onChange={event => setEditingUser({ ...editingUser, role: event.target.value as UserRole })}
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Administrateur</option>
                    <option value="livreur">Livreur</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
              <div>
                <h4 className="font-bold text-gray-900">Adresse de livraison</h4>
                <p className="mt-1 text-sm text-gray-700">Ces informations peuvent être utilisées pour faciliter les livraisons.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-user-address" className="mb-1 block text-sm font-semibold text-gray-800">Adresse complète</label>
                  <textarea
                    id="edit-user-address"
                    value={editingUser.address ?? ''}
                    onChange={event => setEditingUser({ ...editingUser, address: event.target.value })}
                    autoComplete="street-address"
                    minLength={editingUser.address?.trim() ? 5 : undefined}
                    maxLength={500}
                    rows={2}
                    placeholder="Quartier, rue et point de repère"
                    className="w-full resize-y rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-city" className="mb-1 block text-sm font-semibold text-gray-800">Ville</label>
                  <select
                    id="edit-user-city"
                    value={editingUser.city ?? ''}
                    onChange={event => setEditingUser({ ...editingUser, city: event.target.value })}
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Sélectionner une ville</option>
                    {['Bamako', 'Sikasso', 'Kayes', 'Ségou', 'Mopti', 'Gao', 'Tombouctou', 'Koulikoro'].map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
              <div>
                <h4 className="font-bold text-gray-900">Position GPS (facultative)</h4>
                <p className="mt-1 text-sm text-gray-700">Renseignez les coordonnées ensemble ou laissez les deux champs vides.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-user-gps-lat" className="mb-1 block text-sm font-semibold text-gray-800">Latitude</label>
                  <input
                    id="edit-user-gps-lat"
                    type="number"
                    inputMode="decimal"
                    min={-90}
                    max={90}
                    step="any"
                    value={editingUser.gps_lat ?? ''}
                    onChange={event => setEditingUser({ ...editingUser, gps_lat: event.target.value === '' ? null : Number(event.target.value) })}
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-gps-lng" className="mb-1 block text-sm font-semibold text-gray-800">Longitude</label>
                  <input
                    id="edit-user-gps-lng"
                    type="number"
                    inputMode="decimal"
                    min={-180}
                    max={180}
                    step="any"
                    value={editingUser.gps_lng ?? ''}
                    onChange={event => setEditingUser({ ...editingUser, gps_lng: event.target.value === '' ? null : Number(event.target.value) })}
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={pendingUserId === editingUser.id}
                className="min-h-11 rounded-xl border border-gray-300 px-5 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pendingUserId === editingUser.id}
                className="min-h-11 rounded-xl bg-green-700 px-5 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {pendingUserId === editingUser.id ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isAdmin && deletingUser && (
        <Modal
          title="Confirmer la suppression"
          onClose={() => {
            if (!isDeletingUser) setDeletingUser(null);
          }}
          size="sm"
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-description">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-800">
              <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86l-8.2 14.2A2 2 0 003.82 21h16.36a2 2 0 001.73-2.94l-8.2-14.2a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h4 id="delete-user-title" className="mt-4 text-center text-lg font-bold text-gray-900">
              Supprimer le compte de {deletingUser.name} ?
            </h4>
            <p id="delete-user-description" className="mt-2 text-center text-sm leading-6 text-gray-700">
              Le compte et le profil seront supprimés. Ses commandes seront conservées, mais dissociées de cet utilisateur. Cette action est irréversible.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isDeletingUser}
                autoFocus
                className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {isDeletingUser ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

function IdentityDocumentField({
  id,
  label,
  file,
  onChange,
}: {
  id: string;
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
        required
        onChange={event => onChange(event.target.files?.[0] ?? null)}
        className="block min-h-11 w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 file:mr-3 file:min-h-11 file:border-0 file:bg-green-50 file:px-3 file:font-semibold file:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <p className="mt-1 truncate text-xs text-gray-600">{file ? file.name : 'PDF, JPEG ou PNG — 5 Mo maximum'}</p>
    </div>
  );
}

function LivreurPhotoField({
  file,
  onChange,
  currentPhoto,
  id = 'new-livreur-photo',
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  currentPhoto?: string;
  id?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">Photo de profil</label>
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white text-2xl font-black text-green-700">
          {previewUrl
            ? <img src={previewUrl} alt="Aperçu de la nouvelle photo de profil" className="h-full w-full object-cover" />
            : currentPhoto
              ? <img src={currentPhoto} alt="Photo de profil actuelle" className="h-full w-full object-cover" />
              : 'L'}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            onChange={event => onChange(event.target.files?.[0] ?? null)}
            className="block min-h-11 w-full cursor-pointer rounded-xl border border-gray-200 bg-white text-sm text-gray-700 file:mr-3 file:min-h-11 file:border-0 file:bg-green-50 file:px-3 file:font-semibold file:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="mt-1 truncate text-xs text-gray-600">{file ? file.name : currentPhoto ? 'Laisser vide pour conserver la photo actuelle · JPEG ou PNG · 2 Mo maximum' : 'Facultatif · JPEG ou PNG · 2 Mo maximum'}</p>
        </div>
        {file && (
          <button type="button" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500">
            Retirer la photo
          </button>
        )}
      </div>
    </div>
  );
}

function IdentityDocumentPreview({
  url,
  label,
  isPdf,
}: {
  url: string;
  label: string;
  isPdf: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {isPdf
        ? <iframe title={`Aperçu : ${label}`} src={url} loading="lazy" className="h-56 w-full" />
        : <img src={url} alt={`Aperçu : ${label}`} loading="lazy" className="max-h-56 w-full object-contain" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center border-t border-gray-100 px-3 text-sm font-semibold text-green-800 underline decoration-green-300 underline-offset-2 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600">
        Ouvrir le justificatif
      </a>
    </div>
  );
}

function ReplaceIdentityDocumentField({
  id,
  label,
  file,
  hasCurrentDocument,
  required = false,
  previewUrl,
  isPdf,
  onChange,
}: {
  id: string;
  label: string;
  file: File | null;
  hasCurrentDocument: boolean;
  required?: boolean;
  previewUrl?: string;
  isPdf?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      {previewUrl && (
        <div className="mb-2"><IdentityDocumentPreview url={previewUrl} label={label} isPdf={Boolean(isPdf)} /></div>
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
        required={required && !hasCurrentDocument}
        onChange={event => onChange(event.target.files?.[0] ?? null)}
        className="block min-h-11 w-full cursor-pointer rounded-xl border border-gray-200 bg-white text-sm text-gray-700 file:mr-3 file:min-h-11 file:border-0 file:bg-green-50 file:px-3 file:font-semibold file:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <p className="mt-1 text-xs text-gray-600">
        {file ? file.name : hasCurrentDocument ? 'Document actuel conservé si aucun nouveau fichier n’est choisi.' : 'Aucun document actuellement enregistré.'}
        {' '}PDF, JPEG ou PNG · 5 Mo maximum
      </p>
    </div>
  );
}

function LivreurEditModal({
  livreur,
  onClose,
  onSave,
}: {
  livreur: User;
  onClose: () => void;
  onSave: (input: LivreurUpdateInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: livreur.name,
    email: livreur.email,
    phone: livreur.phone,
    address: livreur.address ?? '',
    password: '',
    profilePhoto: null as File | null,
    identityDocument: null as File | null,
    guarantorName: '',
    guarantorAddress: '',
    guarantorPhone: '',
    guarantorIdentityDocument: null as File | null,
    guarantorConsent: false,
  });
  const [hasCourierDocument, setHasCourierDocument] = useState(false);
  const [hasGuarantorDocument, setHasGuarantorDocument] = useState(false);
  const [hasVerificationRecord, setHasVerificationRecord] = useState(false);
  const [documentPreviews, setDocumentPreviews] = useState<{
    courier: { url: string; isPdf: boolean } | null;
    guarantor: { url: string; isPdf: boolean } | null;
  }>({ courier: null, guarantor: null });
  const [documentPreviewError, setDocumentPreviewError] = useState('');
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [verificationError, setVerificationError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadVerification = async () => {
      setLoadingVerification(true);
      setVerificationError('');
      const { data, error } = await getSupabase()
        .from('livreur_verifications')
        .select('guarantor_name, guarantor_address, guarantor_phone, identity_document_path, guarantor_identity_document_path')
        .eq('courier_id', livreur.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Unable to load livreur verification details for editing.', error.code);
        setVerificationError('Le dossier d’identité ne peut pas être chargé. Réessayez avant de modifier le livreur.');
      } else if (!data) {
        setForm(current => ({
          ...current,
          guarantorName: '',
          guarantorAddress: '',
          guarantorPhone: '',
          guarantorConsent: false,
        }));
        setHasCourierDocument(false);
        setHasGuarantorDocument(false);
        setHasVerificationRecord(false);
      } else {
        setHasVerificationRecord(true);
        setForm(current => ({
          ...current,
          guarantorName: data.guarantor_name,
          guarantorAddress: data.guarantor_address,
          guarantorPhone: data.guarantor_phone,
        }));
        setHasCourierDocument(Boolean(data.identity_document_path));
        setHasGuarantorDocument(Boolean(data.guarantor_identity_document_path));
        const supabase = getSupabase();
        const [courierPreview, guarantorPreview] = await Promise.all([
          supabase.storage.from('livreur-identities').createSignedUrl(data.identity_document_path, 300),
          supabase.storage.from('livreur-identities').createSignedUrl(data.guarantor_identity_document_path, 300),
        ]);
        if (cancelled) return;
        if (courierPreview.error || guarantorPreview.error || !courierPreview.data || !guarantorPreview.data) {
          console.error('Unable to create temporary preview links for livreur identity documents.');
          setDocumentPreviewError('Les aperçus ne sont pas disponibles pour le moment. Vous pouvez toujours remplacer les documents.');
        } else {
          setDocumentPreviews({
            courier: { url: courierPreview.data.signedUrl, isPdf: data.identity_document_path.toLowerCase().endsWith('.pdf') },
            guarantor: { url: guarantorPreview.data.signedUrl, isPdf: data.guarantor_identity_document_path.toLowerCase().endsWith('.pdf') },
          });
        }
      }
      setLoadingVerification(false);
    };
    void loadVerification().catch(error => {
      if (cancelled) return;
      console.error('Unexpected error while loading livreur details for editing.', error);
      setVerificationError('Une erreur empêche le chargement du dossier d’identité.');
      setLoadingVerification(false);
    });
    return () => { cancelled = true; };
  }, [livreur.id]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || loadingVerification || verificationError) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        phone: form.phone.trim(),
        password: form.password || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Modifier les informations du livreur" onClose={saving ? () => undefined : onClose} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 px-1">
        <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
          <div>
            <h4 className="font-bold text-gray-900">Coordonnées et compte</h4>
            <p className="mt-1 text-sm text-gray-600">Modifiez les informations utilisées pour contacter et connecter le livreur.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-livreur-name" className="mb-1 block text-sm font-semibold text-gray-700">Nom complet</label>
              <input id="edit-livreur-name" type="text" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} autoComplete="name" minLength={2} maxLength={120} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            </div>
            <div>
              <label htmlFor="edit-livreur-email" className="mb-1 block text-sm font-semibold text-gray-700">Adresse e-mail</label>
              <input id="edit-livreur-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} autoComplete="email" maxLength={254} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            </div>
            <div>
              <label htmlFor="edit-livreur-phone" className="mb-1 block text-sm font-semibold text-gray-700">Téléphone</label>
              <MaliPhoneInput id="edit-livreur-phone" value={form.phone} onChange={phone => setForm({ ...form, phone })} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-livreur-address" className="mb-1 block text-sm font-semibold text-gray-700">Adresse complète</label>
              <textarea id="edit-livreur-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} autoComplete="street-address" minLength={5} maxLength={500} rows={2} required className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-livreur-password" className="mb-1 block text-sm font-semibold text-gray-700">Nouveau mot de passe <span className="font-normal text-gray-600">(facultatif)</span></label>
              <input id="edit-livreur-password" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="new-password" minLength={8} maxLength={128} placeholder="Laisser vide pour ne pas le modifier" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
              <p className="mt-1 text-xs text-gray-600">8 caractères minimum. Le mot de passe actuel n’est jamais affiché.</p>
            </div>
            <LivreurPhotoField
              id="edit-livreur-photo"
              file={form.profilePhoto}
              currentPhoto={livreur.avatar.startsWith('http') ? livreur.avatar : undefined}
              onChange={profilePhoto => setForm({ ...form, profilePhoto })}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
          <div>
            <h4 className="font-bold text-gray-900">{hasVerificationRecord ? 'Garant et justificatifs d’identité' : 'Ajouter le dossier d’identité'}</h4>
            <p className="mt-1 text-sm text-gray-600">
              {hasVerificationRecord
                ? 'Les administrateurs autorisés peuvent consulter ces justificatifs. Choisissez un nouveau fichier pour remplacer le document enregistré.'
                : 'Aucun dossier n’est enregistré pour ce livreur. Complétez les informations du garant et ajoutez les deux justificatifs pour créer son dossier.'}
            </p>
          </div>
          {loadingVerification ? (
            <p className="text-sm text-gray-600" role="status">Chargement du dossier…</p>
          ) : verificationError ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{verificationError}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-guarantor-name" className="mb-1 block text-sm font-semibold text-gray-700">Nom complet du garant</label>
                  <input id="edit-guarantor-name" type="text" value={form.guarantorName} onChange={event => setForm({ ...form, guarantorName: event.target.value })} minLength={2} maxLength={120} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <div>
                  <label htmlFor="edit-guarantor-phone" className="mb-1 block text-sm font-semibold text-gray-700">Téléphone du garant</label>
                  <MaliPhoneInput id="edit-guarantor-phone" value={form.guarantorPhone} onChange={guarantorPhone => setForm({ ...form, guarantorPhone })} required />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-guarantor-address" className="mb-1 block text-sm font-semibold text-gray-700">Adresse complète du garant</label>
                  <textarea id="edit-guarantor-address" value={form.guarantorAddress} onChange={event => setForm({ ...form, guarantorAddress: event.target.value })} minLength={5} maxLength={500} rows={2} required className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <ReplaceIdentityDocumentField id="edit-livreur-identity" label="Pièce d’identité du livreur" file={form.identityDocument} hasCurrentDocument={hasCourierDocument} required={!hasVerificationRecord} previewUrl={documentPreviews.courier?.url} isPdf={documentPreviews.courier?.isPdf} onChange={identityDocument => setForm({ ...form, identityDocument })} />
                <ReplaceIdentityDocumentField id="edit-guarantor-identity" label="Pièce d’identité du garant" file={form.guarantorIdentityDocument} hasCurrentDocument={hasGuarantorDocument} required={!hasVerificationRecord} previewUrl={documentPreviews.guarantor?.url} isPdf={documentPreviews.guarantor?.isPdf} onChange={guarantorIdentityDocument => setForm({ ...form, guarantorIdentityDocument })} />
              </div>
              {documentPreviewError && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{documentPreviewError}</p>}
              <label className="flex min-h-11 items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                <input type="checkbox" checked={form.guarantorConsent} onChange={event => setForm({ ...form, guarantorConsent: event.target.checked })} required className="mt-1 h-4 w-4 accent-green-600 focus:ring-2 focus:ring-green-600" />
                <span>Je confirme que le garant a été informé de l’utilisation de ses données personnelles.</span>
              </label>
            </>
          )}
        </section>

        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-gray-200 bg-white py-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-gray-300 px-5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-60">Annuler</button>
          <button type="submit" disabled={saving || loadingVerification || Boolean(verificationError)} className="min-h-11 rounded-xl bg-green-700 px-5 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LivreursTab() {
  const { users, updateUser, createUser, updateLivreur, deleteLivreur, isAdmin } = useAuth();
  const { orders } = useOrders();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLivreur, setNewLivreur] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    profilePhoto: null as File | null,
    identityDocument: null as File | null,
    guarantorName: '',
    guarantorAddress: '',
    guarantorPhone: '',
    guarantorIdentityDocument: null as File | null,
    guarantorConsent: false,
  });
  const [selectedLivreur, setSelectedLivreur] = useState<User | null>(null);
  const [editingLivreur, setEditingLivreur] = useState<User | null>(null);
  const [deletingLivreur, setDeletingLivreur] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const livreurs = users.filter(u => u.role === 'livreur');

  const closeAdd = () => {
    setShowAdd(false);
    setNewLivreur({
      name: '',
      email: '',
      phone: '',
      address: '',
      password: '',
      profilePhoto: null,
      identityDocument: null,
      guarantorName: '',
      guarantorAddress: '',
      guarantorPhone: '',
      guarantorIdentityDocument: null,
      guarantorConsent: false,
    });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || isCreating) return;
    if (!newLivreur.identityDocument || !newLivreur.guarantorIdentityDocument) {
      showToast('Ajoutez les pièces d’identité du livreur et du garant.', 'error');
      return;
    }
    if (!newLivreur.guarantorConsent) {
      showToast('Confirmez que le garant a été informé de l’utilisation de ses données.', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createUser(
        {
          name: newLivreur.name,
          email: newLivreur.email,
          phone: newLivreur.phone,
          password: newLivreur.password,
          role: 'livreur',
          address: newLivreur.address,
        },
        {
          profilePhoto: newLivreur.profilePhoto,
          identityDocument: newLivreur.identityDocument,
          guarantorName: newLivreur.guarantorName,
          guarantorAddress: newLivreur.guarantorAddress,
          guarantorPhone: newLivreur.guarantorPhone,
          guarantorIdentityDocument: newLivreur.guarantorIdentityDocument,
          guarantorConsent: newLivreur.guarantorConsent,
        },
      );
      if (!created) throw new Error('Impossible de créer le compte livreur.');
      showToast('Compte livreur créé ✅');
      closeAdd();
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de créer le compte livreur.'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (input: LivreurUpdateInput) => {
    if (!editingLivreur || !isAdmin) return;
    try {
      await updateLivreur(editingLivreur.id, input);
      showToast('Livreur mis à jour ✅');
      setEditingLivreur(null);
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de modifier le livreur.'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingLivreur || !isAdmin || isDeleting) return;
    setIsDeleting(true);
    try {
      const warning = await deleteLivreur(deletingLivreur.id);
      showToast(warning ?? `Le compte de ${deletingLivreur.name} a été supprimé.`, warning ? 'error' : undefined);
      if (selectedLivreur?.id === deletingLivreur.id) setSelectedLivreur(null);
      setDeletingLivreur(null);
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de supprimer le livreur.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800">🛵 {livreurs.length} livreurs</h3>{isAdmin && <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>Nouveau livreur</button>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {livreurs.map(l => {
          const count = orders.filter(o => o.livreurId === l.id).length;
          return (
            <article key={l.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${l.blocked ? 'border-red-200' : 'border-gray-200'}`}>
              <div className={`h-2 ${l.blocked ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-emerald-600'}`} />
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => setSelectedLivreur(l)}
                  aria-label={`Afficher les informations de ${l.name} et de son garant`}
                  aria-haspopup="dialog"
                  className="w-full rounded-xl text-left transition-colors hover:bg-green-50/70 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                >
                  <div className="flex items-start gap-4 p-1">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-green-50 text-xl font-black text-green-800">
                      {l.avatar.startsWith('http')
                        ? <img src={l.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
                        : l.name.trim().charAt(0).toLocaleUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="truncate font-bold text-gray-900">{l.name}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {l.blocked ? 'Bloqué' : 'Actif'}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-sm text-gray-700">{l.phone}</p>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-gray-600">{l.address || 'Adresse non renseignée'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex min-h-11 items-center justify-between border-t border-gray-100 px-1 pt-2">
                    <span className="text-sm font-semibold text-gray-700">{count} livraison{count === 1 ? '' : 's'}</span>
                    <span className="text-sm font-bold text-green-800">Voir le dossier</span>
                  </div>
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => updateUser(l.id, { blocked: !l.blocked })} className={`min-h-11 rounded-xl px-3 text-sm font-bold transition-colors focus:outline-none focus:ring-2 ${l.blocked ? 'bg-green-50 text-green-800 hover:bg-green-100 focus:ring-green-600' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 focus:ring-amber-600'}`}>
                    {l.blocked ? 'Réactiver' : 'Bloquer'}
                  </button>
                  <button type="button" onClick={() => setEditingLivreur(l)} className="min-h-11 rounded-xl bg-gray-100 px-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500">
                    Modifier
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeletingLivreur(l)}
                      className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-800 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                    >
                      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3m-12 0h18" />
                      </svg>
                      Supprimer le livreur
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editingLivreur && (
        <LivreurEditModal livreur={editingLivreur} onClose={() => setEditingLivreur(null)} onSave={handleUpdate} />
      )}

      {selectedLivreur && (
        <LivreurOrdersModal
          livreur={selectedLivreur}
          onClose={() => setSelectedLivreur(null)}
          onEdit={() => {
            setEditingLivreur(selectedLivreur);
            setSelectedLivreur(null);
          }}
        />
      )}
      {isAdmin && deletingLivreur && (
        <Modal
          title="Confirmer la suppression"
          onClose={() => {
            if (!isDeleting) setDeletingLivreur(null);
          }}
          size="sm"
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-livreur-title" aria-describedby="delete-livreur-description">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86l-8.2 14.2A2 2 0 003.82 21h16.36a2 2 0 001.73-2.94l-8.2-14.2a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h4 id="delete-livreur-title" className="mt-4 text-center text-lg font-bold text-gray-900">
              Supprimer {deletingLivreur.name} ?
            </h4>
            <p id="delete-livreur-description" className="mt-2 text-center text-sm leading-6 text-gray-700">
              Son compte et ses justificatifs d’identité seront supprimés. Ses commandes seront conservées, mais ne seront plus attribuées à un livreur. Cette action est irréversible.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeletingLivreur(null)}
                disabled={isDeleting}
                className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {isAdmin && showAdd && (
        <Modal title="Nouveau livreur" onClose={closeAdd} size="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800">Informations du livreur</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-livreur-name" className="mb-1 block text-sm font-semibold text-gray-700">Nom complet</label>
                  <input id="new-livreur-name" type="text" value={newLivreur.name} onChange={e => setNewLivreur({ ...newLivreur, name: e.target.value })} autoComplete="name" minLength={2} maxLength={120} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <div>
                  <label htmlFor="new-livreur-email" className="mb-1 block text-sm font-semibold text-gray-700">Adresse e-mail</label>
                  <input id="new-livreur-email" type="email" value={newLivreur.email} onChange={e => setNewLivreur({ ...newLivreur, email: e.target.value })} autoComplete="email" maxLength={254} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <div>
                  <label htmlFor="new-livreur-phone" className="mb-1 block text-sm font-semibold text-gray-700">Téléphone</label>
                  <MaliPhoneInput id="new-livreur-phone" value={newLivreur.phone} onChange={phone => setNewLivreur({ ...newLivreur, phone })} required />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-livreur-address" className="mb-1 block text-sm font-semibold text-gray-700">Adresse complète du livreur</label>
                  <textarea id="new-livreur-address" value={newLivreur.address} onChange={e => setNewLivreur({ ...newLivreur, address: e.target.value })} autoComplete="street-address" minLength={5} maxLength={500} rows={2} required className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <LivreurPhotoField
                  file={newLivreur.profilePhoto}
                  onChange={profilePhoto => setNewLivreur({ ...newLivreur, profilePhoto })}
                />
                <div>
                  <label htmlFor="new-livreur-password" className="mb-1 block text-sm font-semibold text-gray-700">Mot de passe initial</label>
                  <input id="new-livreur-password" type="password" value={newLivreur.password} onChange={e => setNewLivreur({ ...newLivreur, password: e.target.value })} autoComplete="new-password" minLength={8} maxLength={128} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                  <p className="mt-1 text-xs text-gray-600">8 caractères minimum.</p>
                </div>
                <IdentityDocumentField
                  id="new-livreur-identity"
                  label="Pièce d’identité du livreur"
                  file={newLivreur.identityDocument}
                  onChange={identityDocument => setNewLivreur({ ...newLivreur, identityDocument })}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800">Informations du garant</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-guarantor-name" className="mb-1 block text-sm font-semibold text-gray-700">Nom complet</label>
                  <input id="new-guarantor-name" type="text" value={newLivreur.guarantorName} onChange={e => setNewLivreur({ ...newLivreur, guarantorName: e.target.value })} autoComplete="name" minLength={2} maxLength={120} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <div>
                  <label htmlFor="new-guarantor-phone" className="mb-1 block text-sm font-semibold text-gray-700">Téléphone</label>
                  <MaliPhoneInput id="new-guarantor-phone" value={newLivreur.guarantorPhone} onChange={guarantorPhone => setNewLivreur({ ...newLivreur, guarantorPhone })} required />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-guarantor-address" className="mb-1 block text-sm font-semibold text-gray-700">Adresse complète</label>
                  <textarea id="new-guarantor-address" value={newLivreur.guarantorAddress} onChange={e => setNewLivreur({ ...newLivreur, guarantorAddress: e.target.value })} autoComplete="street-address" minLength={5} maxLength={500} rows={2} required className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                </div>
                <IdentityDocumentField
                  id="new-guarantor-identity"
                  label="Pièce d’identité du garant"
                  file={newLivreur.guarantorIdentityDocument}
                  onChange={guarantorIdentityDocument => setNewLivreur({ ...newLivreur, guarantorIdentityDocument })}
                />
              </div>
            </section>

            <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-gray-700">
              <input type="checkbox" checked={newLivreur.guarantorConsent} onChange={e => setNewLivreur({ ...newLivreur, guarantorConsent: e.target.checked })} required className="mt-1 h-4 w-4 accent-green-600" />
              <span>Je confirme avoir informé le garant de la collecte et de l’utilisation de ses coordonnées et de sa pièce d’identité pour le dossier du livreur.</span>
            </label>
            <p className="text-xs text-gray-600">Les justificatifs sont privés, limités à 5 Mo chacun et accessibles uniquement aux administrateurs autorisés. Formats acceptés : PDF, JPEG ou PNG.</p>

            <button type="submit" disabled={isCreating} className="w-full rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isCreating ? 'Création en cours…' : 'Créer le compte livreur'}
            </button>
          </form>
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
  const { showToast } = useToast();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const selectedMessage = messages.find(message => message.id === selectedMessageId) ?? null;
  const unreadMessages = messages.filter(message => !message.is_read);
  const readCount = messages.length - unreadMessages.length;

  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread' && msg.is_read) return false;
    if (filter === 'read' && !msg.is_read) return false;
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return true;
    return [msg.name, msg.email, msg.phone, msg.subject, msg.message]
      .some(value => value?.toLocaleLowerCase().includes(query));
  });

  const visibleSelectedCount = filteredMessages.filter(message => selectedIds.has(message.id)).length;
  const allVisibleSelected = filteredMessages.length > 0 && visibleSelectedCount === filteredMessages.length;

  const toggleAllSelection = () => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (allVisibleSelected) filteredMessages.forEach(message => next.delete(message.id));
      else filteredMessages.forEach(message => next.add(message.id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = filteredMessages.filter(message => selectedIds.has(message.id)).map(message => message.id);
    if (!ids.length || isDeleting) return;
    if (!confirm(`Supprimer définitivement ${ids.length} message${ids.length > 1 ? 's' : ''} ?`)) return;

    setIsDeleting(true);
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await deleteMessage(id);
        if (selectedMessageId === id) setSelectedMessageId(null);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Une erreur est survenue.');
      }
    }
    setSelectedIds(previous => {
      const next = new Set(previous);
      ids.forEach(id => next.delete(id));
      return next;
    });
    if (failures.length) {
      showToast(`${ids.length - failures.length} message(s) supprimé(s). ${failures[0]}`, 'error');
      await refreshMessages();
    } else {
      showToast(`${ids.length} message${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}.`);
    }
    setIsDeleting(false);
  };

  const handleMarkAllAsRead = async () => {
    const unread = filteredMessages.filter(message => !message.is_read);
    if (!unread.length || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      for (const message of unread) await markAsRead(message.id);
      showToast(`${unread.length} message${unread.length > 1 ? 's' : ''} marqué${unread.length > 1 ? 's' : ''} comme lu${unread.length > 1 ? 's' : ''}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de mettre à jour les messages.', 'error');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleSelectMessage = (message: ContactMessage) => {
    setSelectedMessageId(message.id);
    setReplyContent('');
    if (!message.is_read) {
      void markAsRead(message.id).catch(error => {
        showToast(error instanceof Error ? error.message : 'Impossible de marquer le message comme lu.', 'error');
      });
    }
  };

  const handleToggleRead = async () => {
    if (!selectedMessage) return;
    try {
      if (selectedMessage.is_read) await markAsUnread(selectedMessage.id);
      else await markAsRead(selectedMessage.id);
      showToast(selectedMessage.is_read ? 'Message marqué comme non lu.' : 'Message marqué comme lu.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de mettre à jour le message.', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedMessage || isDeleting) return;
    if (!confirm('Supprimer définitivement ce message ?')) return;
    setIsDeleting(true);
    try {
      await deleteMessage(selectedMessage.id);
      setSelectedMessageId(null);
      setSelectedIds(previous => {
        const next = new Set(previous);
        next.delete(selectedMessage.id);
        return next;
      });
      showToast('Message supprimé.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de supprimer le message.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshMessages();
    setIsRefreshing(false);
  };

  const handleSendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = replyContent.trim();
    if (!selectedMessage || !response || isSendingReply) return;
    setIsSendingReply(true);
    try {
      await sendReply(selectedMessage.id, response);
      setReplyContent('');
      showToast('Réponse enregistrée dans le dossier.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible d’enregistrer la réponse.', 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!selectedMessage) return;
    try {
      await navigator.clipboard.writeText(selectedMessage.email);
      showToast('Adresse e-mail copiée.');
    } catch {
      showToast('Impossible de copier l’adresse e-mail.', 'error');
    }
  };

  const getInitials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).join('').toLocaleUpperCase().slice(0, 2) || '?';
  const getAvatarColor = (name: string) => {
    const colors = ['bg-emerald-700', 'bg-teal-700', 'bg-cyan-800', 'bg-blue-800', 'bg-indigo-800', 'bg-violet-800', 'bg-purple-800', 'bg-fuchsia-800'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  const formatDate = (date: string) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'Date inconnue';
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `Aujourd’hui, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-green-800">Espace administration</p>
          <h2 className="mt-1 text-2xl font-black text-gray-950">Boîte de réception</h2>
          <p className="mt-1 text-sm text-gray-700">Retrouvez les demandes et messages envoyés depuis le site.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-800">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-green-900">{unreadCount} non lu{unreadCount === 1 ? '' : 's'}</span>
        </div>
      </header>
      <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-50">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllSelection} disabled={!filteredMessages.length} aria-label="Sélectionner tous les messages affichés" className="h-5 w-5 rounded border-gray-400 accent-green-700 focus:ring-green-700" />
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleRefresh} disabled={isRefreshing} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700 disabled:opacity-60" title="Actualiser les messages">
            <svg aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M4.582 9H9m11 11v-5h-.581m-15.357-2A8.003 8.003 0 0019.418 15M19.418 15H15" /></svg>
            Actualiser
          </button>
          <button type="button" onClick={handleMarkAllAsRead} disabled={!filteredMessages.some(message => !message.is_read) || isMarkingAll} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700 disabled:opacity-50" title="Tout marquer comme lu">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 6" /></svg>
            {isMarkingAll ? 'Mise à jour…' : 'Tout marquer lu'}
          </button>
          {visibleSelectedCount > 0 && (
            <button type="button" onClick={handleBulkDelete} disabled={isDeleting} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-red-800 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:opacity-60" title="Supprimer les messages sélectionnés">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3m-12 0h18" /></svg>
              {isDeleting ? 'Suppression…' : `Supprimer (${visibleSelectedCount})`}
            </button>
          )}
        </div>
        <div className="flex-1 max-w-md">
          <div className="relative">
            <label htmlFor="messages-search" className="sr-only">Rechercher un message</label>
            <input id="messages-search" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nom, e-mail, téléphone ou contenu" className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-base text-gray-950 outline-none transition-colors placeholder:text-gray-600 focus:border-green-700 focus:bg-white focus:ring-2 focus:ring-green-100" />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <div className="flex bg-gray-100 rounded-full p-1">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`min-h-10 px-4 py-1.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-green-700 ${filter === f ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-700 hover:text-gray-950'}`}>
              {f === 'all' ? `Tous (${messages.length})` : f === 'unread' ? `Non lus (${unreadCount})` : `Lus (${readCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full" /></div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="w-24 h-24 mb-4 rounded-full bg-gray-200 flex items-center justify-center"><svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
          <p className="text-lg font-medium">Aucun message</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Message List */}
          <div className={`${selectedMessage ? 'hidden md:block md:w-[340px]' : 'block w-full md:w-[340px]'} shrink-0 border-r border-gray-200 bg-white overflow-y-auto lg:w-[390px]`}>
            <div className="flex min-h-12 items-center justify-between border-b border-gray-200 px-4">
              <h3 className="text-sm font-bold text-gray-900">Messages reçus</h3>
              <span className="text-xs font-medium text-gray-700">{filteredMessages.length} affiché{filteredMessages.length === 1 ? '' : 's'}</span>
            </div>
            {filteredMessages.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="font-bold text-gray-900">Aucun résultat</p>
                <p className="mt-1 text-sm text-gray-700">Essayez une autre recherche ou un autre filtre.</p>
                <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); }} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-bold text-green-800 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700">Effacer les filtres</button>
              </div>
            )}
            {filteredMessages.map(message => (
              <div key={message.id} className={`flex items-center gap-3 border-b px-3 py-3 ${selectedMessage?.id === message.id ? 'border-l-4 border-l-green-700 bg-green-50' : 'border-l-4 border-l-transparent hover:bg-gray-50'} ${!message.is_read ? 'bg-gray-50' : 'bg-white'}`}>
                <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-white/80">
                  <input type="checkbox" checked={selectedIds.has(message.id)} onChange={() => setSelectedIds(previous => {
                    const next = new Set(previous);
                    if (next.has(message.id)) next.delete(message.id);
                    else next.add(message.id);
                    return next;
                  })} aria-label={`Sélectionner le message de ${message.name}`} className="h-5 w-5 rounded border-gray-400 accent-green-700 focus:ring-green-700" />
                </label>
                <button type="button" onClick={() => handleSelectMessage(message)} aria-current={selectedMessage?.id === message.id ? 'true' : undefined}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2">
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
                  </button>
              </div>
            ))}
          </div>

          {/* Message Detail */}
          {selectedMessage ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <button type="button" onClick={() => setSelectedMessageId(null)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700 md:hidden">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 18-6-6 6-6" /></svg>
                  Retour
                </button>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${getAvatarColor(selectedMessage.name)} flex items-center justify-center text-white font-bold`}>{getInitials(selectedMessage.name)}</div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedMessage.name}</h3>
                    <p className="text-sm text-gray-500">{selectedMessage.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 mr-2">{new Date(selectedMessage.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  <button type="button" onClick={handleToggleRead} aria-label={selectedMessage.is_read ? 'Marquer comme non lu' : 'Marquer comme lu'} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700" title={selectedMessage.is_read ? 'Marquer non lu' : 'Marquer lu'}>
                    <svg className={`w-5 h-5 ${selectedMessage.is_read ? 'text-gray-600' : 'text-blue-600'}`} fill={selectedMessage.is_read ? 'none' : 'currentColor'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <button type="button" onClick={handleCopyEmail} aria-label="Copier l’adresse e-mail" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700" title="Copier l’adresse e-mail">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button type="button" onClick={handleDeleteSelected} disabled={isDeleting} aria-label="Supprimer le message" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-800 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:opacity-60" title="Supprimer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-950">{selectedMessage.subject || 'Sans objet'}</p>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800">Message reçu</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-gray-900">{selectedMessage.message}</p>
                  {selectedMessage.phone && <a href={`tel:${selectedMessage.phone}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-700">{selectedMessage.phone}</a>}
                </div>
                {/* Reply */}
                {selectedMessage.response && <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-sm font-bold text-green-950">Réponse enregistrée</p><p className="mt-2 text-sm leading-6 text-gray-900 whitespace-pre-wrap">{selectedMessage.response}</p><p className="mt-3 text-xs font-medium text-green-950">Cette réponse est enregistrée dans le dossier ; elle n’est pas envoyée par e-mail.</p></div>}
                <form onSubmit={handleSendReply} className="rounded-xl border border-gray-200 bg-white p-4">
                  <label htmlFor="message-reply" className="block text-sm font-bold text-gray-950">{selectedMessage.response ? 'Remplacer la réponse enregistrée' : 'Ajouter une réponse au dossier'}</label>
                  <textarea id="message-reply" value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Saisissez votre réponse…" rows={4} maxLength={5000} disabled={isSendingReply} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-3 text-base leading-6 text-gray-950 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100" />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-gray-700">La réponse est sauvegardée ici ; l’envoi d’e-mail n’est pas configuré.</p>
                    <button type="submit" disabled={!replyContent.trim() || isSendingReply} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-green-700 px-5 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400">
                      {isSendingReply ? 'Enregistrement…' : 'Enregistrer la réponse'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex">
              <h3 className="text-lg font-bold text-gray-950">Choisissez un message</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-gray-700">Sélectionnez une demande dans la liste pour lire son contenu et gérer sa réponse.</p>
            </div>
          )}
        </div>
      )}
    </section>
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
    const supabase = getSupabase();
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

function LivreurOrdersModal({ livreur, onClose, onEdit }: { livreur: User; onClose: () => void; onEdit: () => void }) {
  const { orders } = useOrders();
  const { isAdmin } = useAuth();
  const livreurOrders = orders.filter(o => o.livreurId === livreur.id);
  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const grouped = livreurOrders.reduce((acc, o) => { if (!acc[o.status]) acc[o.status] = []; acc[o.status].push(o); return acc; }, {} as Record<OrderStatus, Order[]>);
  const displayStatuses: OrderStatus[] = ['en_livraison', 'en_preparation', 'confirmee', 'livree', 'annulee'];
  const courierDetails = [
    { label: 'E-mail', value: livreur.email || 'Non renseigné' },
    { label: 'Téléphone', value: livreur.phone || 'Non renseigné' },
    { label: 'Adresse', value: livreur.address || 'Non renseignée' },
    { label: 'Statut', value: livreur.blocked ? 'Bloqué' : 'Actif' },
  ];
  const [verification, setVerification] = useState<{
    guarantor_name: string;
    guarantor_address: string;
    guarantor_phone: string;
    identity_document_path: string;
    guarantor_identity_document_path: string;
  } | null>(null);
  const [verificationDocuments, setVerificationDocuments] = useState<{
    courier: { url: string; isPdf: boolean };
    guarantor: { url: string; isPdf: boolean };
  } | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const loadVerification = async () => {
      setVerificationLoading(true);
      setVerificationError('');
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('livreur_verifications')
        .select('guarantor_name, guarantor_address, guarantor_phone, identity_document_path, guarantor_identity_document_path')
        .eq('courier_id', livreur.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('Unable to load authorized livreur verification data.', error.code);
        setVerificationError('Les informations de vérification ne sont pas disponibles.');
        setVerificationLoading(false);
        return;
      }
      if (!data) {
        setVerification(null);
        setVerificationDocuments(null);
        setVerificationLoading(false);
        return;
      }

      setVerification(data);
      const [courierDocument, guarantorDocument] = await Promise.all([
        supabase.storage.from('livreur-identities').createSignedUrl(data.identity_document_path, 300),
        supabase.storage.from('livreur-identities').createSignedUrl(data.guarantor_identity_document_path, 300),
      ]);
      if (cancelled) return;
      if (courierDocument.error || guarantorDocument.error || !courierDocument.data || !guarantorDocument.data) {
        console.error('Unable to create temporary links for authorized identity documents.');
        setVerificationError('Les justificatifs ne peuvent pas être ouverts pour le moment.');
      } else {
        setVerificationDocuments({
          courier: {
            url: courierDocument.data.signedUrl,
            isPdf: data.identity_document_path.toLowerCase().endsWith('.pdf'),
          },
          guarantor: {
            url: guarantorDocument.data.signedUrl,
            isPdf: data.guarantor_identity_document_path.toLowerCase().endsWith('.pdf'),
          },
        });
      }
      setVerificationLoading(false);
    };

    void loadVerification().catch(error => {
      if (cancelled) return;
      console.error('Unexpected error while loading livreur verification data.', error);
      setVerificationError('Une erreur empêche le chargement du dossier de vérification.');
      setVerificationLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAdmin, livreur.id]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="livreur-dossier-title" className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-orange-100 flex items-center justify-center text-2xl border shadow-sm shrink-0">
              {livreur.avatar.startsWith('http')
                ? <img src={livreur.avatar} alt={`Photo de ${livreur.name}`} className="w-full h-full object-cover" />
                : <span className="text-lg font-black text-orange-800">{livreur.name.trim().charAt(0).toLocaleUpperCase()}</span>}
            </div>
            <div><h3 id="livreur-dossier-title" className="font-bold text-xl text-gray-800">Dossier de {livreur.name}</h3><p className="text-xs text-gray-600">{livreurOrders.length} commandes</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer le dossier du livreur" className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-600 flex items-center justify-center transition-colors"><svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h4 className="font-bold text-gray-900">Informations du livreur</h4>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {courierDetails.map(detail => (
                <div key={detail.label} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{detail.label}</dt>
                  <dd className="mt-1 break-words text-sm text-gray-900">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {isAdmin && (
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h4 className="font-bold text-gray-800">Dossier d’identité et garant</h4>
              {verificationLoading ? (
                <p className="mt-3 text-sm text-gray-600" role="status">Chargement du dossier…</p>
              ) : verificationError ? (
                <p className="mt-3 text-sm text-red-700" role="alert">{verificationError}</p>
              ) : verification ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Garant : {verification.guarantor_name}</p>
                    <p className="text-gray-600">{verification.guarantor_address}</p>
                    <p className="text-gray-600">{verification.guarantor_phone}</p>
                  </div>
                  <button type="button" onClick={onEdit} className="min-h-11 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
                    Modifier le livreur et son dossier
                  </button>
                  <div className="flex flex-wrap gap-3">
                    {verificationDocuments && (
                      <>
                        <a href={verificationDocuments.courier.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-semibold text-green-800 underline decoration-green-300 underline-offset-2 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600">
                          Ouvrir la pièce du livreur
                        </a>
                        <a href={verificationDocuments.guarantor.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-semibold text-green-800 underline decoration-green-300 underline-offset-2 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600">
                          Ouvrir la pièce du garant
                        </a>
                      </>
                    )}
                  </div>
                  {verificationDocuments && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <IdentityDocumentPreview url={verificationDocuments.courier.url} label="Pièce du livreur" isPdf={verificationDocuments.courier.isPdf} />
                      <IdentityDocumentPreview url={verificationDocuments.guarantor.url} label="Pièce du garant" isPdf={verificationDocuments.guarantor.isPdf} />
                    </div>
                  )}
                  <p className="text-xs text-gray-600">Consultation réservée aux administrateurs ; liens temporaires valables 5 minutes. Pour remplacer une pièce, utilisez « Modifier ».</p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-gray-700">Aucun dossier d’identité n’est enregistré pour ce livreur.</p>
                  <button type="button" onClick={onEdit} className="min-h-11 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
                    Ajouter son dossier d’identité
                  </button>
                </div>
              )}
            </section>
          )}
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
