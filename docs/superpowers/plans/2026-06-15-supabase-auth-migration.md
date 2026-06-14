# Migration vers Supabase Auth — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'authentification maison (table `public.users` + clé `anon`) par Supabase Auth (sessions JWT, table `profiles`, vraies RLS, reset email).

**Architecture:** `auth.users` (géré par Supabase) pour l'identité ; table `public.profiles` (UUID = `auth.users.id`) pour name/email/phone/role/avatar/blocked, créée par trigger à l'inscription ; RLS réelles via `auth.uid()` et une fonction `is_admin()` SECURITY DEFINER (anti-récursion). Le front conserve la forme du type `User` pour limiter l'impact.

**Tech Stack:** React 19 + Vite + TypeScript, `@supabase/supabase-js` v2, Supabase (Postgres + Auth), déploiement Vercel (auto sur `main`).

**Vérification (ce projet n'a pas de framework de test) :** chaque tâche de code se valide par `npm run build` + `npx tsc --noEmit` + test manuel sur la **preview Vercel**. Le SQL se teste sur une **branche Supabase** avant la prod.

**Décisions figées (voir la spec `2026-06-14-supabase-auth-migration-design.md`) :** connexion email ; repartir propre (données de test effaçables) ; reset email inclus ; confirmation email désactivée au début ; option admin **simple** (pas d'Edge Function → l'admin perd création/suppression/reset-d'autrui, remplacés par auto-inscription + rôle + blocage + reset email).

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---------|------|--------|
| `supabase_auth_migration.sql` | SQL : profiles, is_admin, trigger, RLS, re-key orders/notifications, retrait ancien système | Créer |
| `src/services/auth.ts` | Couche d'accès auth : signIn/signUp/signOut/session + lecture `profiles` | Réécrire |
| `src/context/AuthContext.tsx` | État auth React via `onAuthStateChange` + reset password | Réécrire |
| `src/components/AuthPage.tsx` | Écran connexion / inscription / demande de reset | Réécrire |
| `src/components/ResetPasswordModal.tsx` | Saisie du nouveau mot de passe après clic sur le lien email | Créer |
| `src/App.tsx` | Affiche `ResetPasswordModal` sur l'évènement PASSWORD_RECOVERY | Modifier |
| `src/components/UserManagement.tsx` | Email en lecture seule ; « Supprimer » → « Bloquer/Débloquer » | Modifier |
| `src/components/AdminPanel.tsx` | Retirer les formulaires de création de compte ; message d'explication | Modifier |
| `src/types/auth.ts` | Type `User` (inchangé : id est déjà `string`, l'UUID en est un) | Vérifier |
| `secure_auth.sql` | Ancien dispositif maison, devenu obsolète | Supprimer (Task 13) |

---

## Task 1 : SQL — table `profiles`, `is_admin()`, trigger, RLS

**Files:**
- Create: `supabase_auth_migration.sql`

- [ ] **Step 1 : Écrire la 1ʳᵉ partie du fichier SQL**

```sql
-- supabase_auth_migration.sql
-- Migration vers Supabase Auth. À exécuter dans Supabase → SQL Editor.
-- TESTER D'ABORD sur une branche Supabase (voir Task 3).

-- ============================================================
-- PARTIE A — Table profiles + sécurité
-- ============================================================

-- A.1 Table profiles (1 ligne par compte auth)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text,
  phone      text,
  role       text not null default 'client' check (role in ('admin','client','livreur')),
  avatar     text,
  blocked    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A.2 Fonction is_admin() : SECURITY DEFINER => s'exécute en tant que owner,
--     contourne la RLS de profiles => PAS de récursion (le bug rencontré avant).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- A.3 RLS profiles : chacun sa ligne, l'admin toutes
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

-- A.4 Trigger : créer le profile à l'inscription.
--     SÉCURITÉ : on force role='client'. On n'utilise JAMAIS un role venant
--     des métadonnées d'inscription (un utilisateur pourrait sinon se déclarer admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone, role, avatar, blocked)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'client',
    coalesce(
      new.raw_user_meta_data->>'avatar',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=client'
    ),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2 : Vérifier (syntaxe) en lisant le fichier**

Relire : `is_admin()` est `security definer`, le trigger force `role='client'`, RLS activée. Pas d'exécution ici (voir Task 3).

- [ ] **Step 3 : Commit**

```bash
git add supabase_auth_migration.sql
git commit -m "SQL: profiles + is_admin + trigger handle_new_user + RLS"
```

---

## Task 2 : SQL — re-key `orders`/`notifications`, retrait de l'ancien système

**Files:**
- Modify: `supabase_auth_migration.sql` (ajouter PARTIE B)

⚠️ **Destructif** : cette partie EFFACE les commandes et notifications de **test**. Validé par l'utilisateur (« repartir propre », app pas encore utilisée). Toujours vérifier le volume avant (Step 1).

- [ ] **Step 1 : Ajouter une requête de contrôle de volume (à lancer manuellement avant)**

```sql
-- À lancer AVANT pour confirmer qu'il n'y a que des données de test :
-- select (select count(*) from public.users)         as users,
--        (select count(*) from public.orders)        as orders,
--        (select count(*) from public.notifications) as notifs;
```

- [ ] **Step 2 : Ajouter la PARTIE B au fichier `supabase_auth_migration.sql`**

```sql

-- ============================================================
-- PARTIE B — Re-key orders/notifications + retrait ancien système
-- ⚠️ EFFACE les données de test. Ne lancer qu'après contrôle du volume.
-- ============================================================

-- B.1 Effacer les données de test liées aux anciens IDs maison
truncate table public.notifications;
truncate table public.orders;

-- B.2 orders.user_id : text 'USR-...' -> uuid (références auth.users)
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  alter column user_id type uuid using null;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- B.3 notifications.user_id : text -> uuid
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  alter column user_id type uuid using null;
alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- B.4 Retrait de l'ancien dispositif maison (sécurisation précédente)
drop trigger if exists trg_hash_user_password on public.users;
drop function if exists public.hash_user_password();
drop function if exists public.login_user(text, text);
drop table if exists public.users cascade;

-- NB : la RLS fine "chacun ne voit que ses commandes" n'est PAS posée ici
-- (les commandes/notifications gardent leur accès actuel pour ne pas casser
-- le tunnel de commande). C'est une amélioration ultérieure documentée.
```

- [ ] **Step 3 : Commit**

```bash
git add supabase_auth_migration.sql
git commit -m "SQL: re-key orders/notifications vers uuid + retrait ancien systeme"
```

---

## Task 3 : Tester le SQL sur une branche Supabase

**Files:** aucun (opération Supabase)

- [ ] **Step 1 : Créer une branche Supabase**

Dans Supabase → Branches → créer une branche de test (copie de la prod), OU via l'outil MCP Supabase `create_branch`.

- [ ] **Step 2 : Exécuter `supabase_auth_migration.sql` sur la branche**

Coller le contenu complet dans le SQL Editor de la branche → Run. Attendu : aucune erreur.

- [ ] **Step 3 : Vérifier le résultat**

```sql
-- profiles existe et RLS active
select * from public.profiles limit 1;          -- 0 ligne, pas d'erreur
-- is_admin existe
select public.is_admin();                         -- false (pas connecté)
-- ancienne table users supprimée
select to_regclass('public.users');               -- NULL
-- types de colonnes
select column_name, data_type from information_schema.columns
 where table_name = 'orders' and column_name = 'user_id';   -- uuid
```

- [ ] **Step 4 : Créer un utilisateur de test via Auth et vérifier le trigger**

Dans la branche → Authentication → Add user (email + mot de passe). Puis :

```sql
select id, email, name, role, blocked from public.profiles;  -- 1 ligne, role='client'
```

Attendu : une ligne `profiles` a été créée automatiquement par le trigger.

- [ ] **Step 5 : Supprimer la branche de test** (une fois validé).

---

## Task 4 : Configurer Supabase Auth (tableau de bord)

**Files:** aucun (réglages Supabase, à faire sur la prod au moment de la bascule — Task 12)

- [ ] **Step 1 : Activer le provider Email**

Authentication → Providers → **Email** activé. Désactiver « Confirm email » (inscription immédiate au début).

- [ ] **Step 2 : URLs**

Authentication → URL Configuration :
- Site URL : `https://www.lumoo.ml`
- Redirect URLs : ajouter `https://www.lumoo.ml/**` et l'URL de preview Vercel `https://*-lumoomali.vercel.app/**`.

- [ ] **Step 3 : Templates email en français**

Authentication → Email Templates → personnaliser « Reset Password » (et « Confirm signup » pour plus tard) en français. Le lien doit pointer vers le Site URL.

---

## Task 5 : Réécrire `src/services/auth.ts`

**Files:**
- Rewrite: `src/services/auth.ts`

- [ ] **Step 1 : Remplacer tout le contenu par :**

```ts
import { User, RegisterInput } from '../types/auth';
import { supabase } from '../lib/supabase';

const PROFILE_COLUMNS = 'id, name, email, phone, role, avatar, blocked, created_at';

// Construit le User de l'app à partir de la session Supabase + la ligne profiles.
function toUser(authUserId: string, authEmail: string | undefined, profile: any): User {
  return {
    id: authUserId,
    name: profile?.name ?? '',
    email: profile?.email ?? authEmail ?? '',
    phone: profile?.phone ?? '',
    role: profile?.role ?? 'client',
    createdAt: profile?.created_at ?? new Date().toISOString(),
    avatar: profile?.avatar ?? '',
    blocked: profile?.blocked ?? false,
  };
}

async function fetchProfile(userId: string): Promise<any | null> {
  const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  return data;
}

export async function apiLogin(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.message?.toLowerCase().includes('invalid')) return null; // identifiants incorrects
    throw new Error(error.message || 'Erreur lors de la connexion');
  }
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id);
  if (profile?.blocked) {
    await supabase.auth.signOut();
    throw new Error('Votre compte est bloqué. Contactez un administrateur.');
  }
  return toUser(data.user.id, data.user.email, profile);
}

export async function apiRegister(input: RegisterInput): Promise<User | null> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name, phone: input.phone.trim() } },
  });
  if (error) throw new Error(error.message || 'Erreur lors de la création du compte');
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id);
  return toUser(data.user.id, data.user.email, profile);
}

// Option simple : la création de compte par l'admin n'est plus possible (clé service requise).
export async function apiCreateUser(_input: RegisterInput): Promise<User | null> {
  throw new Error("La création de compte par l'admin n'est pas disponible. L'utilisateur doit s'inscrire lui-même.");
}

export async function apiLogout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function apiGetCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  if (profile?.blocked) {
    await supabase.auth.signOut();
    return null;
  }
  return toUser(session.user.id, session.user.email, profile);
}

export async function apiGetAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => toUser(p.id, p.email, p));
}

// Met à jour le profil (name/phone/role/avatar/blocked). Email/mot de passe NON modifiables ici.
export async function apiUpdateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
  if (updates.blocked !== undefined) updateData.blocked = updates.blocked;

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error || !data) return null;
  return toUser(data.id, data.email, data);
}

// Option simple : suppression de compte non disponible (clé service requise). Utiliser le blocage.
export async function apiDeleteUser(_id: string): Promise<boolean> {
  return false;
}

export async function seedDefaultAdmin() {
  // Plus de seed maison : l'admin se crée via inscription puis passage role='admin' (SQL/console).
  return null;
}

// Changement de SON PROPRE mot de passe (utilisateur connecté).
export async function apiUpdateOwnPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || 'Erreur lors du changement de mot de passe');
}

// Demande de reset par email.
export async function apiRequestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}`,
  });
  if (error) throw new Error(error.message || 'Erreur lors de la demande de réinitialisation');
}
```

- [ ] **Step 2 : Type-check**

Run: `npx tsc --noEmit`
Expected: pas de nouvelle erreur dans `src/services/auth.ts` (les 4 erreurs pré-existantes de `AdminPanel.tsx` peuvent rester pour l'instant).

- [ ] **Step 3 : Commit**

```bash
git add src/services/auth.ts
git commit -m "auth.ts: bascule sur supabase.auth + table profiles"
```

---

## Task 6 : Réécrire `src/context/AuthContext.tsx`

**Files:**
- Rewrite: `src/context/AuthContext.tsx`

Le contexte garde la même interface (`AuthContextType`) pour ne pas casser les ~9 consommateurs. Il ajoute un état `passwordRecovery` (vrai quand l'utilisateur arrive via le lien de reset) et la méthode `updateOwnPassword`.

- [ ] **Step 1 : Ajouter au type `AuthContextType` dans `src/types/auth.ts`** (2 nouveaux champs)

```ts
// Dans src/types/auth.ts, interface AuthContextType, ajouter :
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  updateOwnPassword: (newPassword: string) => Promise<void>;
```

- [ ] **Step 2 : Remplacer tout le contenu de `src/context/AuthContext.tsx` par :**

```tsx
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { User, RegisterInput, AuthContextType } from '../types/auth';
import { supabase } from '../lib/supabase';
import {
  apiLogin, apiRegister, apiCreateUser, apiLogout, apiGetCurrentUser,
  apiGetAllUsers, apiUpdateUser, apiDeleteUser, apiUpdateOwnPassword,
} from '../services/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    apiGetCurrentUser().then(u => {
      setUser(u);
      setInitialized(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      // Recharge l'utilisateur courant à chaque changement de session.
      apiGetCurrentUser().then(setUser);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const refreshUsers = useCallback(async () => {
    const data = await apiGetAllUsers();
    setUsers(data);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') refreshUsers();
  }, [user?.role, refreshUsers]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    if (u) { setUser(u); setShowAuth(false); }
    return u;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const u = await apiRegister(input);
    if (u) { setUser(u); setShowAuth(false); }
    return u;
  }, []);

  const createUser = useCallback(async (input: RegisterInput) => {
    const u = await apiCreateUser(input);
    refreshUsers();
    return u;
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const updated = await apiUpdateUser(id, updates);
    if (updated && user?.id === id) setUser(updated);
    refreshUsers();
    return updated;
  }, [user?.id, refreshUsers]);

  const deleteUser = useCallback(async (id: string) => {
    await apiDeleteUser(id);
    refreshUsers();
    return true;
  }, [refreshUsers]);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);
  const updateOwnPassword = useCallback(async (newPassword: string) => {
    await apiUpdateOwnPassword(newPassword);
  }, []);

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{
      user, users, login, register, createUser, logout, updateUser, deleteUser,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      isLivreur: user?.role === 'livreur',
      isClient: user?.role === 'client',
      showAuth, setShowAuth,
      passwordRecovery, clearPasswordRecovery, updateOwnPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3 : Type-check** — `npx tsc --noEmit` (pas de nouvelle erreur).

- [ ] **Step 4 : Commit**

```bash
git add src/context/AuthContext.tsx src/types/auth.ts
git commit -m "AuthContext: session supabase + evenement PASSWORD_RECOVERY"
```

---

## Task 7 : Réécrire `src/components/AuthPage.tsx`

**Files:**
- Rewrite: `src/components/AuthPage.tsx`

Conserver la mise en page existante (logo, onglets, classes Tailwind). Changements : login par **email** uniquement, inscription via `register`, demande de reset via `apiRequestPasswordReset`.

- [ ] **Step 1 : Réécrire le composant**

Garder toute la structure JSX actuelle (onglets Connexion / Créer un compte / reset, et les champs). Modifier uniquement :
1. Le label du champ login : « 📧 Email » (au lieu de « Email ou Téléphone »), `type="email"`.
2. `handleResetPassword` :

```tsx
import { apiRequestPasswordReset } from '../services/auth';
// ...
const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  const email = resetEmailOrPhone.trim();
  if (!email) return;
  setResetLoading(true);
  setError('');
  try {
    await apiRequestPasswordReset(email);
    showToast('Si un compte existe, un email de réinitialisation a été envoyé.');
    setResetEmailOrPhone('');
    setMode('login');
  } catch (err: any) {
    setError(err?.message || 'Erreur lors de la demande');
  } finally {
    setResetLoading(false);
  }
};
```

3. Retirer l'import `supabase` direct devenu inutile (vérifier qu'il n'est plus référencé).
4. `handleLogin` et `handleRegister` restent identiques (ils passent par `login`/`register` du contexte).

- [ ] **Step 2 : Build + type-check**

Run: `npm run build && npx tsc --noEmit`
Expected: build OK ; pas de nouvelle erreur de type.

- [ ] **Step 3 : Commit**

```bash
git add src/components/AuthPage.tsx
git commit -m "AuthPage: connexion email + demande de reset par email"
```

---

## Task 8 : `ResetPasswordModal` + branchement dans `App.tsx`

**Files:**
- Create: `src/components/ResetPasswordModal.tsx`
- Modify: `src/App.tsx`

Quand l'utilisateur clique le lien reçu par email, supabase-js détecte le token dans l'URL et déclenche `PASSWORD_RECOVERY` (géré dans AuthContext → `passwordRecovery = true`). On affiche alors ce modal pour saisir le nouveau mot de passe.

- [ ] **Step 1 : Créer `src/components/ResetPasswordModal.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
```

- [ ] **Step 2 : Brancher dans `src/App.tsx`**

Dans `MainApp`, ajouter l'import et l'affichage conditionnel :

```tsx
// en haut :
import ResetPasswordModal from './components/ResetPasswordModal';
// dans MainApp, récupérer passwordRecovery :
const { user, showAuth, setShowAuth, passwordRecovery } = useAuth();
// juste avant la fermeture du <div> racine de MainApp (après le bloc Auth Modal) :
{passwordRecovery && <ResetPasswordModal />}
```

- [ ] **Step 3 : Build** — `npm run build` (OK).

- [ ] **Step 4 : Commit**

```bash
git add src/components/ResetPasswordModal.tsx src/App.tsx
git commit -m "Reset password: modal de nouveau mot de passe sur PASSWORD_RECOVERY"
```

---

## Task 9 : `UserManagement.tsx` — email lecture seule, blocage à la place de la suppression

**Files:**
- Modify: `src/components/UserManagement.tsx`

- [ ] **Step 1 : Email en lecture seule dans le modal d'édition**

Remplacer l'input email (≈ lignes 156-158) par un champ désactivé :

```tsx
<div>
  <label className="block text-xs font-semibold text-gray-600 mb-1">Email (non modifiable)</label>
  <input type="email" value={editingUser.email} disabled
    className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500" />
</div>
```

Et retirer `email: editingUser.email,` de l'objet passé à `updateUser` dans `handleSave` (≈ lignes 38-43) — on ne met plus à jour l'email.

- [ ] **Step 2 : Remplacer « Supprimer » par « Bloquer / Débloquer »**

Dans `useAuth()` (ligne 14), remplacer `deleteUser` par `updateUser` :
```tsx
const { users, updateUser } = useAuth();
```
Remplacer le bouton « Supprimer » (≈ lignes 127-129) par :
```tsx
{u.role !== 'admin' && (
  <button
    onClick={() => updateUser(u.id, { blocked: !u.blocked })}
    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${u.blocked ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}>
    {u.blocked ? '✅ Débloquer' : '🚫 Bloquer'}
  </button>
)}
```
Supprimer l'état et le modal de confirmation de suppression (`deletingId`, `confirmDelete`, `handleDelete`, et le bloc JSX « Delete Confirm » ≈ lignes 180-196).

- [ ] **Step 3 : Build + type-check** — `npm run build && npx tsc --noEmit` (pas de nouvelle erreur).

- [ ] **Step 4 : Commit**

```bash
git add src/components/UserManagement.tsx
git commit -m "UserManagement: email lecture seule + blocage au lieu de suppression"
```

---

## Task 10 : `AdminPanel.tsx` — retirer la création de comptes

**Files:**
- Modify: `src/components/AdminPanel.tsx`

L'AdminPanel contient des formulaires de création d'utilisateur/livreur (avec mot de passe) — devenus impossibles en option simple. Les remplacer par un message.

- [ ] **Step 1 : Lire la section concernée**

Lire `src/components/AdminPanel.tsx` autour des lignes 1240-1470 (composants de création d'utilisateur et de livreur, repérables par `createUser`, `const [password, setPassword]`, `Nouveau mot de passe`).

- [ ] **Step 2 : Neutraliser les formulaires de création**

Dans chaque formulaire de **création** (utilisateur et livreur), remplacer le contenu du formulaire par un encart explicatif (garder le composant pour ne pas casser les imports/onglets) :

```tsx
<div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
  ℹ️ La création de compte se fait par <b>auto-inscription</b> : demandez à la personne de créer
  son compte depuis la page « Créer un compte », puis attribuez-lui le rôle souhaité
  (ex. « livreur ») via <b>Gestion des utilisateurs → Modifier</b>.
</div>
```

Retirer les `handleCreate`/`createUser(...)` et les champs mot de passe associés (et l'édition du mot de passe d'un autre utilisateur, ≈ lignes 1274, 1394, et les champs « Nouveau mot de passe »). Conserver les modifications de rôle/nom/téléphone.

- [ ] **Step 3 : Build + type-check**

Run: `npm run build && npx tsc --noEmit`
Expected: build OK. (Les 4 erreurs `moov_money`/variables inutilisées pré-existantes peuvent subsister ; ne pas les corriger ici sauf si elles bloquent.)

- [ ] **Step 4 : Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "AdminPanel: retrait creation de comptes (option simple) + message"
```

---

## Task 11 : Build, preview Vercel, test fumée

**Files:** aucun

- [ ] **Step 1 : Build local complet** — `npm run build` (OK).

- [ ] **Step 2 : Pousser la branche**

```bash
git push -u origin supabase-auth-migration
```

- [ ] **Step 3 : Ouvrir une PR (génère la preview Vercel)**

```bash
"C:\Program Files\GitHub CLI\gh.exe" pr create --repo KhalilSnaake/lumoo-1.2 --base main --head supabase-auth-migration --title "Migration vers Supabase Auth" --body "Voir docs/superpowers/specs/2026-06-14-supabase-auth-migration-design.md"
```

- [ ] **Step 4 : ⚠️ Préparer la branche Supabase pour la preview**

La preview partage la **base de prod**. Pour tester SANS casser la prod, il faut que le SQL de migration soit **déjà appliqué** sur la base que la preview utilise. Deux choix :
- (a) faire la bascule prod (Task 12) AVANT de tester la preview, ou
- (b) pointer la preview sur une branche Supabase de test (variables d'env de preview Vercel).
Recommandé pour un site pas encore utilisé : (a) — appliquer Task 12, puis tester directement.

---

## Task 12 : Bascule en production

**Files:** aucun (opérations Supabase + Vercel)

- [ ] **Step 1 : Contrôle de volume** (Task 2, Step 1) — confirmer données de test uniquement.

- [ ] **Step 2 : Appliquer `supabase_auth_migration.sql` sur la base de prod** (SQL Editor → Run).

- [ ] **Step 3 : Configurer Supabase Auth** (Task 4 : provider email, confirmation désactivée, URLs, templates FR).

- [ ] **Step 4 : Déployer le code** — merger la PR dans `main` :

```bash
"C:\Program Files\GitHub CLI\gh.exe" pr merge --repo KhalilSnaake/lumoo-1.2 --merge <num_PR>
```
*(Le déploiement prod auto-déclenché nécessite la validation du garde-fou : demander explicitement à l'utilisateur avant de merger.)*

- [ ] **Step 5 : Recréer le compte admin**

Sur lumoo.ml → « Créer un compte » avec l'email admin. Puis dans Supabase SQL Editor :
```sql
update public.profiles set role = 'admin' where email = 'EMAIL_ADMIN';
```

---

## Task 13 : Vérification de bout en bout + nettoyage

**Files:**
- Delete: `secure_auth.sql`

- [ ] **Step 1 : Tests manuels sur lumoo.ml** (Ctrl+F5)
  - Inscription d'un nouveau compte → connecté immédiatement.
  - Déconnexion / reconnexion.
  - « Mot de passe oublié » → email reçu → lien → modal nouveau mot de passe → reconnexion OK.
  - Connexion admin → panneau admin accessible ; liste des utilisateurs visible.
  - Modifier (UserManagement) → changer un rôle en « livreur », bloquer/débloquer.
  - Vérifier qu'un utilisateur non-admin ne voit pas les données des autres (RLS).

- [ ] **Step 2 : Supprimer l'ancien fichier SQL obsolète**

```bash
git rm secure_auth.sql
git commit -m "Cleanup: retrait de secure_auth.sql (remplace par Supabase Auth)"
```

- [ ] **Step 3 : Pousser** — `git push` (sur `main` via PR si la branche est déjà mergée, sinon inclure dans la PR de migration).

---

## Self-review (vérifié par l'auteur du plan)

- **Couverture spec :** profiles ✓ (T1) · is_admin/RLS ✓ (T1) · trigger ✓ (T1) · re-key orders/notif ✓ (T2) · retrait ancien système ✓ (T2) · config Auth/email ✓ (T4) · auth.ts ✓ (T5) · AuthContext ✓ (T6) · AuthPage ✓ (T7) · reset email + page ✓ (T7,T8) · option admin simple ✓ (T9,T10) · cutover ✓ (T12) · critères de succès ✓ (T13).
- **Sécurité :** le trigger force `role='client'` (pas d'escalade via métadonnées). `is_admin()` SECURITY DEFINER évite la récursion RLS rencontrée précédemment.
- **Cohérence des types :** `User` inchangé (id `string`/UUID) → les ~9 consommateurs (`Header`, `UserDashboard`, `NotificationContext`, `api.ts`, etc.) ne changent pas. Nouvelles méthodes `updateOwnPassword`/`passwordRecovery` ajoutées au type `AuthContextType` (T6, Step 1) AVANT usage (T8).
- **Limite assumée :** RLS fine par-utilisateur sur `orders`/`notifications` non posée ici (parité fonctionnelle conservée) — amélioration ultérieure documentée.
