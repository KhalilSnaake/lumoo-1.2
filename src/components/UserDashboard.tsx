import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { OrderStatus } from '../types';
import Logo from './Logo';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import { supabase } from '../lib/supabase';
import MaliPhoneInput from './MaliPhoneInput';

const statusLabels: Record<OrderStatus, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '⏳' },
  confirmee: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-100', emoji: '✅' },
  en_preparation: { label: 'En préparation', color: 'text-purple-700', bg: 'bg-purple-100', emoji: '📦' },
  en_livraison: { label: 'En livraison', color: 'text-orange-700', bg: 'bg-orange-100', emoji: '🚚' },
  livree: { label: 'Livrée', color: 'text-green-700', bg: 'bg-green-100', emoji: '🎉' },
  annulee: { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-100', emoji: '❌' },
};

const paymentLogos = {
  orange_money: <OrangeMoneyLogo className="w-4 h-4" />,
  moov_money: <MoovMoneyLogo className="w-4 h-4" />,
  wave: <WaveLogo className="w-4 h-4" />,
  livraison: <CashLogo className="w-4 h-4" />,
};

export default function UserDashboard({ onClose, initialOrderId }: { onClose: () => void; initialOrderId?: string }) {
  const { user, logout, updateUser } = useAuth();
  const { orders, refreshOrders } = useOrders();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('orders');
  const [editingProfile, setEditingProfile] = useState(false);
  
  // Profile edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    if (initialOrderId) setActiveTab('orders');
  }, [initialOrderId]);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone);
      setEditEmail(user.email);
      setEditAvatar(user.avatar);
    }
  }, [user, editingProfile]);

  if (!user) return null;

  const myOrders = user.role === 'client' 
    ? orders.filter(o => o.userId === user.id)
    : user.role === 'livreur'
    ? orders.filter(o => o.livreurId === user.id)
    : [];

  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image trop lourde (max 2Mo)', 'error'); return; }

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `avatars/${user.id}-${Math.random()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
      
      // Mettre à jour l'état local
      setEditAvatar(publicUrl);
      
      // Facultatif : Sauvegarder immédiatement dans la base pour plus de sécurité
      await updateUser(user.id, { avatar: publicUrl });
      
      showToast('Photo de profil mise à jour ✅');
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast('Erreur : ' + (err.message || 'Problème de connexion'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || !editPhone || !editEmail) return;
    
    if (editPassword && editPassword.length < 6) {
      showToast('Le mot de passe doit faire au moins 6 caractères', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = {
        name: editName,
        phone: editPhone,
        email: editEmail,
        avatar: editAvatar
      };
      
      if (editPassword) updates.password = editPassword;

      const result = await updateUser(user.id, updates);
      if (result) {
        showToast('Profil mis à jour ✅');
        setEditingProfile(false);
        setEditPassword('');
      }
    } catch (err) {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a 
            href="/"
            onClick={(e) => { e.preventDefault(); onClose(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <Logo size={36} />
            <div>
              <h1 className="text-lg font-extrabold text-gray-800 group-hover:text-green-600 transition-colors">Mon compte</h1>
              <p className="text-xs text-gray-400 capitalize">{user.role} Lumoo</p>
            </div>
          </a>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-6 -mb-px">
            <button onClick={() => { setActiveTab('orders'); setEditingProfile(false); }} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400'}`}>
              {user.role === 'livreur' ? '📦 Mes Livraisons' : '🛍 Mes Commandes'}
            </button>
            <button onClick={() => setActiveTab('profile')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'profile' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400'}`}>
              👤 Mon Profil
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {activeTab === 'profile' ? (
            <div className="space-y-6 animate-slide-up">
              {!editingProfile ? (
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-4 border-gray-50 overflow-hidden bg-gray-100 flex items-center justify-center text-3xl shadow-md shrink-0 text-gray-400 font-bold">
                      {user.avatar.startsWith('http') ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.avatar
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-800">{user.name}</h2>
                      <p className="text-gray-500 font-medium">{user.email}</p>
                      <p className="text-gray-500 font-medium">{user.phone}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">{user.role === 'admin' ? 'admin' : user.role}</span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full italic">Depuis {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setEditingProfile(true)}
                    className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    ✏️ Modifier mes informations
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-gray-800">Modifier mon profil</h2>
                    <button onClick={() => setEditingProfile(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Annuler</button>
                  </div>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Photo de profil</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-100 flex items-center justify-center bg-gray-50 text-2xl shrink-0 text-gray-300 font-bold">
                          {isUploading ? (
                            <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full" />
                          ) : editAvatar.startsWith('http') ? (
                            <img src={editAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            editAvatar
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                        >
                          {editAvatar.startsWith('http') ? 'Changer la photo' : 'Ajouter une photo'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nom complet</label>
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email</label>
                      <input 
                        type="email" 
                        value={editEmail} 
                        onChange={e => setEditEmail(e.target.value)} 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Téléphone</label>
                      <MaliPhoneInput 
                        value={editPhone} 
                        onChange={setEditPhone} 
                        required 
                      />
                    </div>

                    <div className="pt-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nouveau mot de passe (Facultatif)</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={editPassword} 
                          onChange={e => setEditPassword(e.target.value)} 
                          placeholder="Laisser vide pour garder l'actuel"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none pr-12"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.005 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.076m1.406-1.406A10.05 10.005 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      {isSaving ? 'Enregistrement...' : 'Sauvegarder les modifications'}
                    </button>
                  </form>
                </div>
              )}

              {user.role === 'admin' && (
                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 space-y-4">
                  <h3 className="font-bold text-blue-800 flex items-center gap-2">
                    <span>🛠</span> Accès rapide administration
                  </h3>
                  <p className="text-sm text-blue-600">En tant qu'administrateur, vous avez accès à tous les outils de gestion de la boutique.</p>
                  <button 
                    onClick={() => { onClose(); (window as any).openAdmin(); }}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200"
                  >
                    Ouvrir le panneau admin
                  </button>
                </div>
              )}

              <button 
                onClick={() => { logout(); onClose(); }}
                className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Déconnexion
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                  {user.role === 'livreur' ? '📦 Livraisons assignées' : '🛍 Historique de commandes'}
                </h2>
                <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-lg">{myOrders.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-mono font-bold text-gray-400">{order.id}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(order.createdAt)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusLabels[order.status].bg} ${statusLabels[order.status].color}`}>
                        {statusLabels[order.status].label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-800">{order.customerName}</p>
                      <p className="text-xs text-gray-500 italic">{order.address}, {order.city}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        {paymentLogos[order.paymentMethod as keyof typeof paymentLogos]}
                        <span className="text-lg font-black text-green-600">{fmt(order.totalPrice)} F</span>
                      </div>
                      
                      {user.role === 'livreur' && order.status === 'en_livraison' && (
                        <DeliveryValidationModal 
                          order={order} 
                          onValidate={(receivedBy: string) => {
                            refreshOrders();
                            showToast(`Commande livrée à ${receivedBy} ! 🎉`);
                          }} 
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {myOrders.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                  <span className="text-5xl block mb-3">📭</span>
                  <p className="text-gray-400 font-medium">Aucune commande trouvée</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryValidationModal({ order, onValidate }: { order: any; onValidate: (name: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [error, setError] = useState('');
  const { updateOrder } = useOrders();

  const handleValidate = async () => {
    if (code !== order.deliveryCode) {
      setError('Code incorrect. Demandez le code à 4 chiffres au client.');
      return;
    }
    if (!receivedBy.trim()) {
      setError('Veuillez saisir le nom de la personne qui reçoit le colis.');
      return;
    }

    await updateOrder(order.id, {
      status: 'livree',
      receivedBy: receivedBy.trim()
    });
    
    onValidate(receivedBy);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-600 transition-all"
      >
        ✅ Valider Livraison
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-slide-up space-y-4">
            <div className="text-center">
              <span className="text-4xl">🔐</span>
              <h3 className="text-lg font-black text-gray-800 mt-2">Validation de livraison</h3>
              <p className="text-xs text-gray-400 mt-1">Demandez au client le code de sécurité affiché dans son suivi de commande.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Code de livraison (4 chiffres)</label>
                <input 
                  type="text" 
                  maxLength={4}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 1234"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl font-black tracking-[1em] focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nom du réceptionnaire</label>
                <input 
                  type="text" 
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  placeholder="Ex: Mme Diallo"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600 font-bold leading-tight">
                  ⚠️ {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setIsOpen(false); setError(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm"
              >
                Annuler
              </button>
              <button 
                onClick={handleValidate}
                disabled={code.length < 4 || !receivedBy.trim()}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-green-200 disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
