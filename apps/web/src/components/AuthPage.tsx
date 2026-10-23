import { useState } from 'react';
import { useAuth, apiRequestPasswordReset } from '@lumoo/core';
import { useToast } from '../context/ToastContext';
import Logo from './Logo';
import MaliPhoneInput from './MaliPhoneInput';

function PasswordVisibilityButton({ visible, inputId, onToggle }: { visible: boolean; inputId: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      aria-controls={inputId}
      aria-pressed={visible}
      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        {visible ? (
          <>
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.3 4.5 9 6-.3.7-1.1 1.8-2.3 2.9" />
            <path d="M6.2 6.2C4.4 7.4 3.3 9.2 3 11c.7 1.5 4 6 9 6 1 0 1.9-.2 2.8-.5" />
          </>
        ) : (
          <>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset password
  const [resetEmailOrPhone, setResetEmailOrPhone] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [regSent, setRegSent] = useState(false);


  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const regRole = 'client' as const;

  const handleTabChange = (newMode: 'login' | 'register' | 'reset') => {
    setMode(newMode);
    setError('');
    setResetSent(false);
    setRegSent(false);
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
    const email = resetEmailOrPhone.trim();
    if (!email) return;
    setResetLoading(true);
    setError('');
    try {
      await apiRequestPasswordReset(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la demande');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regAddress.trim() || !regPassword) return;
    setError('');

    if (regPassword !== regConfirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (regPassword.length < 6) {
      setError('Le mot de passe doit avoir au moins 6 caractères');
      return;
    }
    // Majuscule, chiffre et caractère spécial obligatoires
    if (!/[A-Z]/.test(regPassword) || !/\d/.test(regPassword) || !/[^A-Za-z0-9]/.test(regPassword)) {
      setError('Le mot de passe doit contenir au moins 1 majuscule, 1 chiffre et 1 caractère spécial');
      return;
    }

    
    setLoading(true);
    try {
      const { user, needsConfirmation } = await register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        role: regRole,
        address: regAddress.trim(),
      });
      if (needsConfirmation) {
        setRegSent(true);
      } else if (user) {
        showToast(`Compte créé avec succès ! Bienvenue ${user.name}`);
      } else {
        setError("Erreur lors de l'inscription (réponse vide)");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du compte");
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">📧 Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Mot de passe</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                  <PasswordVisibilityButton
                    visible={showPassword}
                    inputId="login-password"
                    onToggle={() => setShowPassword(visible => !visible)}
                  />
                </div>
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
          {mode === 'reset' && !resetSent && (
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Entrez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.
              </p>
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

          {mode === 'reset' && resetSent && (
            <div className="p-6 space-y-4 text-center animate-bounce-in">
              <span className="text-5xl block">📬</span>
              <h3 className="text-lg font-extrabold text-gray-800">Vérifiez votre boîte mail</h3>
              <p className="text-sm text-gray-500">
                Si un compte existe pour <span className="font-bold text-gray-700">{resetEmailOrPhone}</span>, un email de réinitialisation vient d'être envoyé.
              </p>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-left space-y-1.5">
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">1.</span> Ouvrez l'email de Lumoo.</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">2.</span> Cliquez sur le lien « Réinitialiser le mot de passe ».</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">3.</span> Choisissez votre nouveau mot de passe.</p>
              </div>
              <p className="text-[11px] text-gray-400">Pensez à vérifier vos spams. Le lien expire au bout d'une heure.</p>
              <button
                type="button"
                onClick={() => { setResetSent(false); setMode('login'); setError(''); setResetEmailOrPhone(''); }}
                className="w-full py-3.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}

          {mode === 'register' && !regSent && (
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
                <label htmlFor="register-phone" className="block text-xs font-semibold text-gray-600 mb-1.5">Téléphone</label>
                <MaliPhoneInput 
                  id="register-phone"
                  value={regPhone} 
                  onChange={setRegPhone}
                  required 
                />
              </div>
              <div>
                <label htmlFor="register-address" className="mb-1.5 block text-sm font-semibold text-gray-700">Adresse complète</label>
                <textarea
                  id="register-address"
                  value={regAddress}
                  onChange={event => setRegAddress(event.target.value)}
                  placeholder="Quartier, rue et repère"
                  autoComplete="street-address"
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none transition-colors focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Mot de passe</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                  <PasswordVisibilityButton
                    visible={showRegPassword}
                    inputId="register-password"
                    onToggle={() => setShowRegPassword(visible => !visible)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="register-password-confirm" className="block text-xs font-semibold text-gray-600 mb-1.5">🔒 Confirmer le mot de passe</label>
                <div className="relative">
                  <input
                    id="register-password-confirm"
                    type={showRegConfirm ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                  <PasswordVisibilityButton
                    visible={showRegConfirm}
                    inputId="register-password-confirm"
                    onToggle={() => setShowRegConfirm(visible => !visible)}
                  />
                </div>
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

          {mode === 'register' && regSent && (
            <div className="p-6 space-y-4 text-center animate-bounce-in">
              <span className="text-5xl block">📬</span>
              <h3 className="text-lg font-extrabold text-gray-800">Vérifiez votre boîte mail</h3>
              <p className="text-sm text-gray-500">
                Un email d'activation a été envoyé à <span className="font-bold text-gray-700">{regEmail}</span>.
              </p>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-left space-y-1.5">
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">1.</span> Ouvrez l'email de Lumoo.</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">2.</span> Cliquez sur le lien d'activation.</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">3.</span> Connectez-vous.</p>
              </div>
              <p className="text-[11px] text-gray-400">Pensez à vérifier vos spams.</p>
              <button
                type="button"
                onClick={() => { setRegSent(false); handleTabChange('login'); }}
                className="w-full py-3.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm"
              >
                ← Aller à la connexion
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
