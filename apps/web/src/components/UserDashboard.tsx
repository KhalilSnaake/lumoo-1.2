import { useState, useEffect, useRef } from 'react';
import { useAuth, useOrders, getSupabase, apiGetLivreurOrders, apiConfirmDelivery, apiDeleteOwnAccount } from '@lumoo/core';
import type { Order, OrderStatus } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import Logo from './Logo';
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from './PaymentLogos';
import MaliPhoneInput from './MaliPhoneInput';
import LocationPicker from './LocationPicker';

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
  const { user, logout, updateUser, updateOwnPassword } = useAuth();
  const { orders, refreshOrders } = useOrders();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('orders');
  const [editingProfile, setEditingProfile] = useState(false);
  const [livreurOrders, setLivreurOrders] = useState<Order[]>([]);
  const [deleting, setDeleting] = useState(false);
  
  // Profile edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGps, setEditGps] = useState<{ lat?: number | null; lng?: number | null }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // Livreur : ses livraisons proviennent de get_livreur_orders (sans le code de
  // livraison), pas de la table orders (la RLS ne l'autorise plus au livreur).
  const reloadLivreurOrders = () => apiGetLivreurOrders().then(setLivreurOrders);
  useEffect(() => {
    if (user?.role === 'livreur') reloadLivreurOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    if (initialOrderId) setActiveTab('orders');
  }, [initialOrderId]);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone);
      setEditAvatar(user.avatar);
      setEditAddress(user.address || '');
      setEditCity(user.city || '');
      setEditGps({ lat: user.gps_lat, lng: user.gps_lng });
    }
  }, [user, editingProfile]);

  if (!user) return null;

  const myOrders = user.role === 'client'
    ? orders.filter(o => o.userId === user.id)
    : user.role === 'livreur'
    ? livreurOrders
    : [];

  const handleDeleteAccount = async () => {
    if (!window.confirm("Supprimer définitivement votre compte ? Votre profil et votre compte de connexion seront supprimés. Vos commandes passées seront dissociées de votre compte.")) return;
    setDeleting(true);
    try {
      await apiDeleteOwnAccount();
      showToast('Compte supprimé.');
      logout();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "La suppression a échoué. Réessayez ou écrivez à contact@lumoo.ml.", 'error');
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (p: number) => p.toLocaleString('fr-FR');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const supabase = getSupabase();
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
    if (!editName.trim() || !editPhone) return;
    
    if (editPassword && editPassword.length < 6) {
      showToast('Le mot de passe doit faire au moins 6 caractères', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUser(user.id, {
        name: editName.trim(),
        phone: editPhone,
        avatar: editAvatar,
        address: editAddress.trim(),
        city: editCity,
        gps_lat: editGps.lat,
        gps_lng: editGps.lng,
      });
      if (!result) throw new Error('Les informations du profil n’ont pas pu être enregistrées.');

      if (editPassword) {
        try {
          await updateOwnPassword(editPassword);
        } catch (error) {
          showToast(
            'Profil enregistré, mais le mot de passe n’a pas pu être modifié : '
              + (error instanceof Error ? error.message : 'réessayez.'),
            'error',
          );
          return;
        }
      }
      showToast('Profil mis à jour ✅');
      setEditingProfile(false);
      setEditPassword('');
    } catch (error) {
      showToast('Erreur : ' + (error instanceof Error ? error.message : 'Impossible de mettre à jour le profil.'), 'error');
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
            <Logo size={200} />
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
                      <p className="mt-1 break-all text-sm font-medium text-gray-700">{user.email}</p>
                      <p className="mt-1 text-sm font-medium text-gray-700">{user.phone}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-900">{user.role === 'admin' ? 'Administrateur' : user.role === 'livreur' ? 'Livreur' : 'Client'}</span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">Adresse de livraison</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-gray-900">{user.address || 'À renseigner dans votre profil'}</dd>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">Ville</dt>
                      <dd className="mt-1 text-sm font-medium text-gray-900">{user.city || 'Non renseignée'}</dd>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                      <dt className="text-xs font-bold uppercase tracking-wide text-gray-700">Localisation GPS</dt>
                      <dd className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-gray-900">
                        {user.gps_lat != null && user.gps_lng != null
                          ? <span>{user.gps_lat.toFixed(5)}, {user.gps_lng.toFixed(5)}</span>
                          : <span>Non renseignée</span>}
                        {user.gps_lat != null && user.gps_lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${user.gps_lat},${user.gps_lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-lg px-3 font-bold text-green-800 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700"
                          >
                            Voir sur la carte
                          </a>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 text-base font-bold text-white shadow-lg transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 2.651 2.651M8 16l8.862-8.862a1.875 1.875 0 112.652 2.652L10.652 18.65a4 4 0 01-1.697 1.01L5 21l1.34-3.955A4 4 0 017.35 15.35z" />
                    </svg>
                    Modifier mes informations
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">Modifier mon profil</h2>
                      <p className="mt-1 text-sm text-gray-700">Mettez à jour vos coordonnées et votre adresse de livraison.</p>
                    </div>
                    <button type="button" onClick={() => setEditingProfile(false)} className="min-h-11 rounded-lg px-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500">Annuler</button>
                  </div>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="mb-2 ml-1 block text-sm font-bold text-gray-800">Photo de profil</label>
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
                          className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-700"
                        >
                          {editAvatar.startsWith('http') ? 'Changer la photo' : 'Ajouter une photo'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-name" className="mb-1 block text-sm font-semibold text-gray-800">Nom complet</label>
                      <input 
                        id="profile-name"
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        maxLength={120}
                        autoComplete="name"
                        className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-email" className="mb-1 block text-sm font-semibold text-gray-800">Adresse e-mail (non modifiable)</label>
                      <input 
                        id="profile-email"
                        type="email" 
                        value={user.email}
                        readOnly
                        autoComplete="email"
                        className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-base text-gray-700"
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-phone" className="mb-1 block text-sm font-semibold text-gray-800">Téléphone</label>
                      <MaliPhoneInput 
                        id="profile-phone"
                        value={editPhone} 
                        onChange={setEditPhone} 
                        required 
                      />
                    </div>

                    <div>
                      <label htmlFor="profile-address" className="mb-1 block text-sm font-semibold text-gray-800">Adresse de livraison par défaut</label>
                      <textarea
                        id="profile-address"
                        value={editAddress}
                        onChange={e => setEditAddress(e.target.value)}
                        autoComplete="street-address"
                        maxLength={500}
                        minLength={5}
                        rows={2}
                        placeholder="Ex: Badalabougou, près de la pharmacie..."
                        className="w-full resize-y rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-city" className="mb-1 block text-sm font-semibold text-gray-800">Ville</label>
                      <select
                        id="profile-city"
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                      >
                        <option value="">Sélectionner une ville</option>
                        {['Bamako', 'Sikasso', 'Kayes', 'Ségou', 'Mopti', 'Gao', 'Tombouctou', 'Koulikoro'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <section className="space-y-3 rounded-2xl border border-green-100 bg-green-50/60 p-4" aria-labelledby="profile-gps-title">
                      <div>
                        <h3 id="profile-gps-title" className="text-base font-bold text-gray-900">Localisation GPS (facultatif)</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-700">
                          Partagez votre position pour aider le livreur à trouver votre adresse. Votre navigateur vous demandera l’autorisation ; la position ne sera enregistrée qu’après avoir sauvegardé le profil.
                        </p>
                      </div>
                      <LocationPicker
                        currentLat={editGps.lat ?? undefined}
                        currentLng={editGps.lng ?? undefined}
                        onLocationSelect={(lat, lng) => setEditGps({ lat, lng })}
                      />
                      {editGps.lat != null && editGps.lng != null && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800">
                            Position sélectionnée : {editGps.lat.toFixed(5)}, {editGps.lng.toFixed(5)}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditGps({ lat: null, lng: null })}
                            className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-800 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700"
                          >
                            Retirer la position
                          </button>
                        </div>
                      )}
                    </section>

                    <div className="pt-2">
                      <label htmlFor="profile-password" className="mb-1 block text-sm font-semibold text-gray-800">Nouveau mot de passe (facultatif)</label>
                      <div className="relative">
                        <input 
                          id="profile-password"
                          type={showPassword ? "text" : "password"} 
                          value={editPassword} 
                          onChange={e => setEditPassword(e.target.value)} 
                          placeholder="Laisser vide pour garder l'actuel"
                          autoComplete="new-password"
                          minLength={6}
                          maxLength={128}
                          className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-base text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-700"
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
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green-700 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
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

              {user.role !== 'admin' && (
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="w-full py-3 text-gray-400 text-sm font-semibold hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Suppression…' : 'Supprimer mon compte'}
                </button>
              )}
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

                    {user.role !== 'livreur' && order.deliveryCode && (
                      <div className="rounded-2xl bg-green-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-green-700">Code de retrait</span>
                          <span className="font-mono text-base font-black tracking-widest text-green-800">{order.deliveryCode}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-700">⚠️ À communiquer au livreur uniquement à la réception du colis.</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        {paymentLogos[order.paymentMethod as keyof typeof paymentLogos]}
                        <span className="text-lg font-black text-green-600">{fmt(order.totalPrice)} F</span>
                      </div>
                      
                      {user.role === 'livreur' && order.status === 'en_livraison' && (
                        <DeliveryValidationModal 
                          order={order} 
                          onValidate={(receivedBy: string) => {
                            reloadLivreurOrders();
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
  const handleValidate = async () => {
    if (code.length < 4) {
      setError('Saisissez le code à 4 chiffres du client.');
      return;
    }
    if (!receivedBy.trim()) {
      setError('Veuillez saisir le nom de la personne qui reçoit le colis.');
      return;
    }

    // Validation côté serveur : le code est vérifié dans confirm_delivery,
    // jamais comparé ici (l'app livreur ne reçoit plus le code).
    const ok = await apiConfirmDelivery(order.id, code, receivedBy);
    if (!ok) {
      setError('Code incorrect. Demandez le code à 4 chiffres au client.');
      return;
    }

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
