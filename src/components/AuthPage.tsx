import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Logo from './Logo';
import MaliPhoneInput from './MaliPhoneInput';
import { supabase } from '../lib/supabase';


export default function AuthPage() {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset password
  const [resetEmailOrPhone, setResetEmailOrPhone] = useState('');
  const [resetLoading, setResetLoading] = useState(false);


  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const regRole = 'client' as const;

  const handleTabChange = (newMode: 'login' | 'register' | 'reset') => {
    setMode(newMode);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      if (user) {
        showToast(`Bienvenue ${user.name} !`);
      } else {
        setError('Email/Téléphone ou mot de passe incorrect');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmailOrPhone) return;

    setResetLoading(true);
    try {
      // Dans ce projet, la DB mappe l'user sur email.
      // Si tu veux supporter téléphone : dupliquer create_password_reset_token côté DB.
      const { data, error } = await supabase.rpc('create_password_reset_token', {
        p_user_email: resetEmailOrPhone,
      });

      if (error) throw error;

      // data est le token ; on l’affiche pour test local
      showToast('Lien de réinitialisation généré. (Token généré côté DB)');

      // Option : vider le champ.
      setResetEmailOrPhone('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la demande de reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPassword) return;
    setError('');

    if (regPassword !== regConfirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (regPassword.length < 6) {
      setError('Le mot de passe doit avoir au moins 6 caractères');
      return;
    }
    
    setLoading(true);
    try {
      const user = await register({ name: regName, email: regEmail, phone: regPhone, password: regPassword, role: regRole });
      if (user) {
        showToast(`Compte créé avec succès ! Bienvenue ${user.name}`);
      } else {
        setError('Cet email est déjà utilisé');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a 
          href="/"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}

          className="text-center mb-8 block hover:opacity-80 transition-opacity group"
        >
          <div className="flex justify-center mb-3 ">
            <Logo size={200} />
          </div>
          {/* <h1 className="text-xl font-extrabold text-gray-800">Lumoo</h1> */}
          <p className="text-xs text-gray-400">Votre marché en ligne livrés chez vous.</p>
        </a>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-green-100/50 border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex">
            <button
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-4 text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              🔑 Connexion
            </button>
            <button
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-4 text-sm font-bold transition-all ${
                mode === 'register'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              ✨ Créer un compte
            </button>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-bounce-in">
              <span className="text-xl">⚠️</span>
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">📧 Email ou Téléphone</label>
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email ou N° de téléphone"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connexion...</>
                ) : 'Se connecter'}
              </button>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); }}
                  className="text-xs font-semibold text-gray-500 hover:text-green-600"
                >
                  Mot de passe oublié ?
                </button>
                <span />
              </div>
            </form>

          )}

          {/* Register Form */}
          {/* Reset Form */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">📧 Email</label>
                <input
                  type="text"
                  value={resetEmailOrPhone}
                  onChange={e => setResetEmailOrPhone(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Génération...</>
                ) : 'Envoyer le lien de réinitialisation'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="w-full py-3.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="p-6 space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">👤 Nom complet</label>
                <input
                  type="text"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Ex: Amadou SANGARE"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">📧 Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="asangare@lumoo.ml"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">📞 Téléphone</label>
                <MaliPhoneInput 
                  value={regPhone} 
                  onChange={setRegPhone}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Mot de passe</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création...</>
                ) : '✨ Créer mon compte'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
