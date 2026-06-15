import { useState } from 'react';
import { useAuth } from '@lumoo/core';
import { useToast } from '../context/ToastContext';

export default function ResetPasswordModal() {
  const { updateOwnPassword, clearPasswordRecovery } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    if (password.length < 6 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('Au moins 6 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial');
      return;
    }
    setLoading(true);
    try {
      await updateOwnPassword(password);
      showToast('Mot de passe mis à jour. Vous pouvez vous connecter.');
      clearPasswordRecovery();
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <h3 className="text-lg font-extrabold text-gray-800 mb-1">🔒 Nouveau mot de passe</h3>
        <p className="text-xs text-gray-400 mb-4">Choisissez un nouveau mot de passe pour votre compte.</p>
        {error && <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm font-bold text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nouveau mot de passe"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmer"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">
            {loading ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </form>
      </div>
    </div>
  );
}
