# Migration vers Supabase Auth — Design

**Date :** 2026-06-14
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, React + Vite + Supabase
**Statut :** Design validé, en attente de relecture avant plan d'implémentation

---

## 1. Contexte et objectif

L'app utilise aujourd'hui une **authentification maison** : une table `public.users` interrogée directement avec la clé publique `anon`, et une session stockée en `localStorage`. Une première sécurisation a été faite (mots de passe hashés bcrypt, vérification via la fonction serveur `login_user`, colonne `password` verrouillée).

**Limite restante :** comme il n'y a pas de vraie session authentifiée (`auth.uid()` toujours nul), on ne peut pas faire de **vraie autorisation par utilisateur** côté base. La clé `anon` peut encore techniquement modifier/supprimer des lignes.

**Objectif :** basculer vers **Supabase Auth** (système natif) pour obtenir des sessions JWT sécurisées, des **vraies règles RLS**, et un **reset de mot de passe par email** fonctionnel.

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Mode de connexion principal | **Email + mot de passe** |
| Données existantes | **Repartir propre** (app pas encore utilisée ; pas de vraie donnée à migrer) |
| Reset mot de passe par email | **Inclus** dans cette migration |
| Création de comptes livreurs | **Option simple** : le livreur s'inscrit, puis l'admin le passe en « livreur » |
| Confirmation d'email à l'inscription | **Désactivée au début** (inscription immédiate), à activer plus tard |
| Stratégie de bascule | **En une fois**, testée sur une branche Supabase d'abord (faible risque, pas de fenêtre de maintenance nécessaire) |

## 3. Architecture cible

- **Supabase Auth** (`auth.users`) gère : email, mot de passe chiffré, id (UUID), sessions JWT.
- **Table `profiles`** (nouvelle) — infos métier liées à chaque compte :
  ```
  profiles (
    id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    phone      text,
    role       text NOT NULL DEFAULT 'client' CHECK (role IN ('admin','client','livreur')),
    avatar     text,
    blocked    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )
  ```
- **Trigger `handle_new_user`** : à chaque insertion dans `auth.users`, crée la ligne `profiles` correspondante en lisant les métadonnées d'inscription (`raw_user_meta_data` : name, phone, role).
- **Fonction `public.is_admin()`** (SECURITY DEFINER) : lit `profiles.role` pour `auth.uid()` **sans déclencher la récursion RLS** (le bug rencontré lors de la sécurisation). Utilisée dans les policies admin.

## 4. Sécurité — RLS réelles

- **`profiles`** : un utilisateur lit/modifie **sa** ligne (`id = auth.uid()`) ; un admin lit/modifie **toutes** (`is_admin()`).
- **`orders`** : `user_id` devient `uuid`. L'utilisateur voit ses commandes (`user_id = auth.uid()`) ; l'admin voit tout ; le livreur voit celles qui lui sont assignées.
- **`notifications`** : `user_id` devient `uuid` ; chacun voit les siennes ; l'admin gère.
- On **retire** l'ancien dispositif maison (table `public.users`, fonction `login_user`, trigger de hashage) une fois la bascule validée.

## 5. Changements frontend (~9 fichiers)

On **conserve la forme du type `User`** (id, name, email, phone, role, avatar, blocked) pour minimiser l'impact sur les écrans existants. `auth.ts` reconstruit un `User` à partir de la session Supabase + la ligne `profiles`.

- **`services/auth.ts`** — réécrit sur `supabase.auth` :
  - `apiLogin` → `supabase.auth.signInWithPassword({ email, password })`
  - `apiRegister` → `supabase.auth.signUp({ email, password, options: { data: { name, phone, role: 'client' } } })`
  - `apiLogout` → `supabase.auth.signOut()`
  - `apiGetCurrentUser` → `supabase.auth.getSession()` + lecture du `profile`
  - `apiGetAllUsers` / `apiUpdateUser` → sur la table `profiles`
  - reset → `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- **`context/AuthContext.tsx`** — s'abonne à `supabase.auth.onAuthStateChange` + `getSession` ; charge le `profile` à la connexion.
- **`components/AuthPage.tsx`** — réécrit : connexion email/mot de passe, inscription, « mot de passe oublié » réel.
- **Nouvelle page/route de réinitialisation** — gère le lien reçu par email et permet de saisir le nouveau mot de passe (`supabase.auth.updateUser`).
- **~9 fichiers** utilisant `user.id` (désormais UUID) et `user.role` (depuis `profiles`) — adaptés (`AdminPanel`, `UserDashboard`, `Header`, `NotificationContext`, `UserManagement`, `api.ts`, `App.tsx`…).

## 6. Création de comptes livreurs (option simple validée)

L'admin ne peut plus créer un compte + mot de passe directement (Supabase Auth l'interdit avec la clé `anon`). Flux retenu :
1. Le livreur **s'inscrit** lui-même (compte `client` par défaut).
2. L'admin le **passe en « livreur »** depuis le panneau admin (modification de `profiles.role`).

*(Version avancée hors-périmètre : Edge Function avec `service_role` pour créer des comptes depuis l'admin — à ajouter plus tard si besoin.)*

## 7. Emails

- Supabase Auth envoie les emails de confirmation et de reset.
- **Démarrage** : service email intégré de Supabase (gratuit, limité en volume) ; **confirmation d'email désactivée** pour une inscription immédiate.
- **Templates** personnalisés en français.
- **Production (plus tard)** : brancher un SMTP dédié (ex. Resend) et activer la confirmation d'email.

## 8. Données existantes

- **Nettoyage** des comptes et commandes de **test**.
- Migration de type des colonnes `orders.user_id` et `notifications.user_id` (`text` → `uuid`).
- Retrait de l'ancien système maison (table `users`, `login_user`, trigger de hashage, fichier `secure_auth.sql` devenu obsolète).

## 9. Déroulé de bascule

1. **Tester** le SQL de migration sur une **branche Supabase** (copie).
2. Appliquer le SQL en prod (création `profiles`, trigger, `is_admin()`, RLS, ALTER des colonnes, nettoyage).
3. Configurer les réglages **Supabase Auth** (provider email, confirmation désactivée, templates FR).
4. Déployer le **nouveau code** (branche → preview Vercel → merge `main`).
5. **Recréer le compte admin** (inscription + passage `role = 'admin'`).
6. **Tester de bout en bout** : inscription, connexion, reset email, accès admin, commandes.

## 10. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Erreur sur les policies RLS (récursion déjà vécue) | Fonction `is_admin()` SECURITY DEFINER ; test sur branche Supabase |
| Délivrabilité des emails (service intégré limité) | OK pour démarrer ; SMTP dédié plus tard |
| Changement du flux de création livreur | Documenté ; option simple validée |
| Régressions dans les ~9 fichiers | Conserver la forme du type `User` ; build + test sur preview avant merge |

## 11. Hors-périmètre (YAGNI)

- Edge Function de création de comptes par l'admin (version avancée).
- SMTP de production et activation de la confirmation d'email (phase ultérieure).
- Connexion par téléphone / SMS OTP (non retenue : connexion par email).
- Connexion sociale (Google) et MFA.

## 12. Critères de succès

- Un visiteur peut **s'inscrire** (email + mot de passe) et est connecté immédiatement.
- Un utilisateur peut **se connecter** et **se déconnecter** ; la session est sécurisée (JWT).
- Le **« mot de passe oublié »** envoie un email avec lien fonctionnel qui permet de changer le mot de passe.
- L'**admin** accède à son panneau ; un utilisateur ne voit que ses propres données (RLS vérifiées).
- L'ancien système maison est **retiré**, et la clé `anon` ne peut plus lire/modifier librement les données utilisateurs.
