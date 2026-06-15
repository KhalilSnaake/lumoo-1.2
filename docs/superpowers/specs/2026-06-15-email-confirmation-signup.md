

# Confirmation d'email à l'inscription — Design

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, monorepo (core partagé, web Vite, mobile Expo)
**Branche :** `react-native-terrain`
**Statut :** Design validé, en attente de relecture avant plan

---

## 1. Contexte et objectif

La confirmation d'email à l'inscription était **désactivée au départ** (design migration §2). Le SMTP est branché et le template « Confirm signup » est traduit FR. **Objectif : l'activer** — l'utilisateur reçoit un email, le valide, et seulement alors son compte est actif.

**Problème actuel à corriger** : avec « Confirm email » ON, `supabase.auth.signUp` renvoie un `user` **sans session**. Or `AuthContext.register` fait `setUser(u)` dès qu'un user revient → il **croit l'utilisateur connecté** alors qu'il n'a pas de session (RLS échoue, état incohérent). Il faut donc distinguer « confirmation requise » de « connecté ».

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Confirmation | **Activée** (« Confirm email » ON dans Supabase) |
| Lien de confirmation mobile | **Deep link** (ouvre l'app), réutilise l'infra du reset |
| Callback mobile | **Unifié** : un seul `auth-callback` sert reset **et** confirmation (route par `type`) |
| Retour de `apiRegister` | Passe à `{ user, needsConfirmation }` (répercuté sur `AuthContext.register`, le type, et les 2 apps) |
| Flux de tokens | **Implicite** (inchangé, partagé) |

## 3. Périmètre

**Dans le périmètre**
- `core` : `apiRegister` (emailRedirectTo + `needsConfirmation`), `AuthContext.register`, type `AuthContextType.register`.
- Mobile : callback unifié, handler deep link généralisé (`type`), écran `auth-callback`, message d'inscription.
- Web : panneau « vérifie ta boîte mail » à l'inscription (confirmation auto via `detectSessionInUrl`).
- Supabase : activer « Confirm email » + Redirect URLs (manuel).

**Hors périmètre**
- Changement de `flowType` (reste implicite).
- Magic link / OTP.
- Bouton « renvoyer l'email de confirmation » (`supabase.auth.resend`) — option future.

## 4. Architecture

### 4.1 Supabase (manuel — utilisateur)
- Authentication → Providers → Email → activer **« Confirm email »**.
- Authentication → URL Configuration → **Redirect URLs** → ajouter l'URL de callback mobile (`lumoo://auth-callback` + l'URL Expo Go `exp://…/--/auth-callback`).

### 4.2 `core`
- **`apiRegister`** (`services/auth.ts`) :
  - `signUp({ email, password, options: { data: { name, phone }, emailRedirectTo: getAuthRedirectUrl() } })`.
  - `const needsConfirmation = !data.session;`
  - Retour `{ user: needsConfirmation ? null : toUser(...), needsConfirmation }`.
    *(Si confirmation requise, pas de session → on ne lit pas `profiles` (RLS), `user` reste `null`.)*
  - Nouveau type de retour : `Promise<{ user: User | null; needsConfirmation: boolean }>`.
- **`AuthContext.register`** :
  - `const { user: u, needsConfirmation } = await apiRegister(input);`
  - `if (u && !needsConfirmation) { setUser(u); setShowAuth(false); }`
  - `return { user: u, needsConfirmation };`
- **`types/auth.ts`** : `register: (data: RegisterInput) => Promise<{ user: User | null; needsConfirmation: boolean }>;`

### 4.3 Mobile
- **`_layout.tsx`** : `authRedirectUrl = Linking.createURL("auth-callback")` (remplace `reset-password` ; sert reset **et** confirmation).
- **`recovery-link.ts`** → généraliser en `parseAuthCallback(url)` : renvoie `{ type, access_token, refresh_token } | null` pour `type ∈ {recovery, signup, email}`.
- **Handler deep link** (`_layout`) : après `setSession`, router par `type` :
  - `recovery` → `router.push("/reset-password")` (inchangé) ;
  - `signup` / `email` → `router.replace("/(tabs)")` (l'utilisateur est confirmé **et** connecté).
- **`app/auth-callback.tsx`** (nouveau) : écran spinner (le handler redirige aussitôt).
- **`auth-form.tsx`** (inscription) : `const { needsConfirmation } = await register(...)` → si `needsConfirmation`, afficher **« 📬 Vérifie ta boîte mail pour activer ton compte »** (rester sur l'écran, ne pas basculer en connexion auto).

### 4.4 Web
- **`AuthPage.handleRegister`** : `const { user, needsConfirmation } = await register(...)` →
  - si `needsConfirmation` → panneau persistant **« 📬 Vérifie ta boîte mail »** (étapes 1-2-3, comme le reset) ;
  - sinon (confirmation OFF) → comportement actuel (« Bienvenue », connecté).
- Confirmation : `detectSessionInUrl: true` confirme **automatiquement** à l'arrivée sur le site — rien d'autre à coder.

## 5. Flux (mobile, confirmation ON)
1. Inscription → `signUp(..., emailRedirectTo = lumoo://auth-callback)` → user sans session → `needsConfirmation = true`.
2. Écran « Vérifie ta boîte mail ».
3. L'utilisateur ouvre l'email → tap le lien → l'app s'ouvre (`auth-callback#access_token=…&type=signup`).
4. `_layout` parse `type=signup` → `setSession` → `/(tabs)` (connecté) + toast « Compte activé ».

## 6. Fichiers

**Nouveaux**
- `apps/mobile/src/app/auth-callback.tsx`

**Modifiés**
- `packages/core/src/services/auth.ts` (`apiRegister`)
- `packages/core/src/context/AuthContext.tsx` (`register`)
- `packages/core/src/types/auth.ts` (signature `register`)
- `apps/mobile/src/lib/recovery-link.ts` (`parseAuthCallback`)
- `apps/mobile/src/app/_layout.tsx` (callback unifié + handler par `type` + route `auth-callback`)
- `apps/mobile/src/components/auth-form.tsx` (message confirmation)
- `apps/web/src/components/AuthPage.tsx` (panneau confirmation à l'inscription)

> ⚠️ Changer le retour de `register` touche `core` **partagé** : web **et** mobile doivent être adaptés dans le même lot (sinon build cassé).

## 7. Gestion des erreurs
- Lien de confirmation expiré/invalide (pas de session après `setSession`) → message « Lien invalide ou expiré » (réutilise l'état de `auth-callback` / un message).
- `signUp` échoue (email déjà pris, etc.) → message d'erreur existant.

## 8. Conformité (`CLAUDE.md`)
- Vert marque, typo, touch ≥ 44px, FR, contraste — comme le reste.

## 9. Tests
- `parseAuthCallback` (pur) → assertions Node : lien recovery → `{type:'recovery',…}` ; lien signup → `{type:'signup',…}` ; lien normal → `null`.
- `tsc --noEmit` sur **core + mobile + web** (le changement de type doit compiler partout).
- Bundle one-shot mobile (`expo export`).
- Manuel : activer Confirm email → s'inscrire (mobile) → « vérifie ta boîte mail » → cliquer le lien → l'app confirme & connecte ; (web) s'inscrire → panneau confirmation.

## 10. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Changement de type `register` casse un appelant non mis à jour | Adapter `core` + web + mobile dans le même lot ; `tsc` des 3 |
| Unifier le callback casse le reset (déjà construit) | Le reset n'est pas commité ; généraliser `parse` + path en même temps, re-tester le reset |
| Profil non lisible sans session à l'inscription | Quand `needsConfirmation`, on ne lit pas `profiles` ; `user = null`, l'UI n'en a pas besoin |
| Lien signup ouvre `auth-callback` avant que le handler redirige | `auth-callback` = simple spinner ; `router.replace` immédiat |

## 11. Critères de succès
- « Confirm email » ON : une inscription **ne connecte pas** directement ; l'app/web affiche « vérifie ta boîte mail ».
- Le lien de l'email **ouvre l'app** (mobile) et **confirme + connecte** ; le web confirme tout seul.
- Le **reset password** continue de fonctionner (callback unifié).
- `tsc` passe sur core + web + mobile ; bundle mobile OK.
