# Réinitialisation de mot de passe — mobile (deep link)

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, monorepo (web Vite + mobile Expo)
**Branche :** `react-native-terrain`
**Statut :** Design validé, en attente de relecture avant plan

---

## 1. Contexte et objectif

Le **web** gère déjà entièrement le reset : `initCore({ authRedirectUrl: window.location.origin })` + `detectSessionInUrl: true` → supabase-js auto-détecte le token de recovery et `App.tsx` affiche `ResetPasswordModal`. **Aucun travail web.**

Le **mobile** envoie bien l'email (`auth-form.tsx` mode « reset » → `apiRequestPasswordReset`), mais :
- `initCore` mobile ne passe **pas** `authRedirectUrl` → le lien pointe vers le **web** (Site URL Supabase), pas vers l'app.
- `detectSessionInUrl: false` → l'app ne capte rien automatiquement.

**Objectif :** faire en sorte que le lien de reset **ouvre l'app mobile** et permette d'y saisir un nouveau mot de passe, en réutilisant la logique `@lumoo/core`.

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Périmètre | **Mobile uniquement** (le web est déjà fait) |
| Flux de tokens | **Implicite** (défaut supabase-js) — tokens dans le fragment `#…&type=recovery`. **On ne touche pas au `flowType` partagé → zéro impact web.** |
| Expo Go vs build | `Linking.createURL("reset-password")` → `exp://…` en Expo Go, `lumoo://reset-password` en build |
| Après reset réussi | **Déconnexion** + retour vers la **connexion** (l'utilisateur se reconnecte avec le nouveau mdp) |

## 3. Périmètre

**Dans le périmètre**
- Rediriger le lien de reset mobile vers l'app (`authRedirectUrl`).
- Capter le deep link à l'ouverture, établir la session de recovery.
- Écran de saisie du nouveau mot de passe.
- Config Supabase (Redirect URLs) — étape manuelle de l'utilisateur, documentée.

**Hors périmètre**
- Web (déjà fait).
- Deep link de **confirmation d'email** (désactivée pour l'instant) et magic link.
- Passage du client à **PKCE** (changerait le `core` partagé → risque web).

## 4. Architecture

### 4.1 `app/_layout.tsx` — redirection + capture du lien
- À `initCore`, ajouter `authRedirectUrl: Linking.createURL("reset-password")` (depuis `expo-linking`).
- Un hook/effet de **deep link** dans `RootLayout` :
  - Au montage : `Linking.getInitialURL()` ; + abonnement `Linking.addEventListener("url", …)`.
  - Pour chaque URL reçue : si elle contient `type=recovery`, **parser le fragment** (`#access_token=…&refresh_token=…&type=recovery`), puis `supabase.auth.setSession({ access_token, refresh_token })`, puis `router.push("/reset-password")`.
  - *(Le parsing du fragment est une fonction pure `parseRecoveryParams(url)` → `{ access_token, refresh_token, type } | null`, testable.)*
- Enregistrer la route : `<Stack.Screen name="reset-password" options={{ headerShown: false }} />`.

### 4.2 `app/reset-password.tsx` — écran de saisie
- 2 champs (mot de passe + confirmation), validation : ≥ 6 caractères, identiques.
- Au submit → `apiUpdateOwnPassword(newPassword)` (déjà dans `core` : `supabase.auth.updateUser({ password })`).
- Succès → `apiLogout()` (déconnexion de la session de recovery) + `router.replace("/(tabs)/compte")` (qui affiche `AuthForm` connexion) + message de succès.
- **Garde** : si aucune session active (lien expiré/invalide / écran ouvert hors flux), afficher un état « Lien invalide ou expiré » + bouton « Demander un nouveau lien » → revient sur le formulaire de reset (compte).

### 4.3 Données / flux
1. `auth-form.tsx` (mode reset) → `apiRequestPasswordReset(email)` → `resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() })` (= `lumoo://reset-password`).
2. Email reçu → tap sur le lien → ouvre l'app (`lumoo://reset-password#access_token=…&type=recovery`).
3. `_layout` capte l'URL → `setSession(...)` → navigation `/reset-password`.
4. Écran → `updateUser({ password })` → `signOut` → retour connexion.

### 4.4 Config Supabase (manuel — utilisateur)
- Auth → **URL Configuration → Redirect URLs** : ajouter `lumoo://reset-password` (+ l'URL Expo Go `exp://…` pour les tests).

## 5. Composants / fichiers

**Nouveaux**
- `apps/mobile/src/app/reset-password.tsx` — écran de saisie.
- `apps/mobile/src/lib/recovery-link.ts` — `parseRecoveryParams(url)` (fonction pure, testable).

**Modifiés**
- `apps/mobile/src/app/_layout.tsx` — `authRedirectUrl` + handler deep link + `Stack.Screen`.
- *(éventuel)* `apps/mobile/package.json` — `expo-linking` (vérifier ; souvent déjà présent en transitif via expo-router).

## 6. Gestion des erreurs
- Lien expiré/invalide (pas de session) → état dédié + « Demander un nouveau lien ».
- Mots de passe non identiques / < 6 → message inline, submit désactivé.
- `updateUser` échoue → message d'erreur, on reste sur l'écran.

## 7. Conformité (`CLAUDE.md`)
- Vert marque pour le CTA ; typo `font-display`/`font-body` ; touch ≥ 44px ; labels de champs ; FR ; contraste ≥ 4.5:1.

## 8. Tests
- `parseRecoveryParams(url)` (pur) → assertions Node (URL avec fragment recovery → objet ; URL normale → null).
- Reste : `tsc --noEmit` (0 erreur), bundle one-shot (`expo export`), **test manuel** : demander un reset depuis l'app → ouvrir le lien de l'email → changer le mot de passe → se reconnecter.

## 9. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Tokens dans le **fragment** (`#`) non transmis aux params de route | On parse l'URL brute via `Linking.getInitialURL`/listener (le fragment y est présent), pas via les search params |
| Lien ouvert sur un **autre appareil** que celui qui a demandé | Flux implicite → pas de code-verifier requis, fonctionne cross-device (contrairement à PKCE) |
| Redirect URL non autorisée dans Supabase → lien cassé | Étape manuelle documentée (§4.4) ; tester en Expo Go avec l'URL `exp://` |
| Expo Go : scheme `lumoo://` inactif | `Linking.createURL` génère l'URL `exp://` adaptée à Expo Go |

## 10. Critères de succès
- Depuis l'app, « mot de passe oublié » envoie un email dont le lien **ouvre l'app**.
- L'app affiche l'écran de nouveau mot de passe, le change, déconnecte, et renvoie vers la connexion.
- L'utilisateur se reconnecte avec le nouveau mot de passe.
- Un lien invalide/expiré affiche un message clair sans planter.
- Le web reste inchangé.
