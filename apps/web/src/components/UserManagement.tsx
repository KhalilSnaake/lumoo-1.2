import { useState } from 'react';
import { useAuth } from '@lumoo/core';
import type { User, UserRole } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import Logo from './Logo';

const roleLabels: Record<UserRole, { label: string; emoji: string; color: string; bg: string }> = {
  admin: { label: 'Admin', emoji: '👨‍💼', color: 'text-red-700', bg: 'bg-red-100' },
  client: { label: 'Client', emoji: '👤', color: 'text-blue-700', bg: 'bg-blue-100' },
  livreur: { label: 'Livreur', emoji: '🛵', color: 'text-orange-700', bg: 'bg-orange-100' },
};

export default function UserManagement({ onClose }: { onClose: () => void }) {
  const { users, updateUser } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filtered = users.filter(u => {
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q);
    return matchRole && matchSearch;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    clients: users.filter(u => u.role === 'client').length,
    livreurs: users.filter(u => u.role === 'livreur').length,
  };

  const handleSave = async () => {
    if (!editingUser) return;
    await updateUser(editingUser.id, {
      name: editingUser.name,
      phone: editingUser.phone,
      role: editingUser.role,
    });
    setEditingUser(null);
    showToast('Utilisateur modifié avec succès');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <h1 className="text-lg font-extrabold text-gray-800">👥 Gestion des utilisateurs</h1>
              <p className="text-xs text-gray-400">{stats.total} utilisateurs</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Stats */}
          <div className="flex gap-3 overflow-x-auto">
            {[
              { label: 'Total', value: stats.total, icon: '👥', color: 'bg-gray-100 text-gray-700' },
              { label: 'Admins', value: stats.admins, icon: '👨‍💼', color: 'bg-red-50 text-red-700' },
              { label: 'Clients', value: stats.clients, icon: '👤', color: 'bg-blue-50 text-blue-700' },
              { label: 'Livreurs', value: stats.livreurs, icon: '🛵', color: 'bg-orange-50 text-orange-700' },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl ${s.color} flex-shrink-0`}>
                <span>{s.icon}</span>
                <div><p className="text-xs opacity-75">{s.label}</p><p className="text-sm font-bold">{s.value}</p></div>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email, téléphone..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFilterRole('all')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${filterRole === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>Tous</button>
              {(Object.keys(roleLabels) as UserRole[]).map(r => (
                <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${filterRole === r ? 'bg-gray-800 text-white' : `${roleLabels[r].bg} ${roleLabels[r].color}`}`}>{roleLabels[r].emoji} {roleLabels[r].label}</button>
              ))}
            </div>
          </div>

          {/* Users list */}
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${roleLabels[u.role].bg} flex items-center justify-center text-xl`}>
                      {roleLabels[u.role].emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800">{u.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${roleLabels[u.role].bg} ${roleLabels[u.role].color}`}>
                          {roleLabels[u.role].label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{u.email} · {u.phone}</p>
                      <p className="text-[10px] text-gray-300">ID: {u.id} · Créé le {new Date(u.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingUser({ ...u })} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg transition-all">✏️ Modifier</button>
                    {u.role !== 'admin' && (
                      <button onClick={() => updateUser(u.id, { blocked: !u.blocked })} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${u.blocked ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}>{u.blocked ? '✅ Débloquer' : '🚫 Bloquer'}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400"><span className="text-4xl block mb-2">👥</span><p className="text-sm">Aucun utilisateur trouvé</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">✏️ Modifier l'utilisateur</h3>
              <button onClick={() => setEditingUser(null)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                <input type="text" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email (non modifiable)</label>
                <input type="email" value={editingUser.email} disabled className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={editingUser.phone} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rôle</label>
                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="admin">👨‍💼 Admin</option>
                  <option value="client">👤 Client</option>
                  <option value="livreur">🛵 Livreur</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-all">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-sm hover:shadow-lg transition-all">💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* (Suppression de compte remplacée par le blocage — option simple Supabase Auth) */}
    </div>
  );
}
