# Préparation du terrain React Native (monorepo + core partagé) — Design

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, React + Vite + Supabase
**Statut :** Design validé, en attente de relecture avant plan d'implémentation
**Branche :** `react-native-terrain`

---

## 1. Contexte et objectif

L'app est aujourd'hui une **SPA web** (React 19 + Vite + Tailwind 4) avec un backend **Supabase** (Postgres + RPC + Storage + Realtime). On veut **ajouter une app mobile React Native** en réutilisant un maximum de logique côté backend/API, **sans dupliquer** le code d'accès aux données.

> **Note sur l'auth :** la migration vers **Supabase Auth est déjà réalisée** sur la branche parallèle `supabase-auth-migration` (worktree `C:/Dev/lumoo-auth`). `services/auth.ts` utilise déjà `supabase.auth.*` + une table `profiles`. La branche `react-native-terrain` (worktree `C:/Dev/lumoo-mali`) en hérite. **Ce lot ne refait pas l'auth** ; il la déplace dans le core et la rend compatible mobile.

Trois couplages au web bloquent aujourd'hui ce partage :

1. **Stockage de session non injectable** : le client Supabase est créé sans adaptateur de stockage. Sur web, Supabase Auth persiste la session dans `localStorage` (défaut navigateur) ; sur mobile il faut lui passer **`AsyncStorage`** via `createClient(url, key, { auth: { storage } })`, sinon la session ne persiste pas.
2. **`import.meta.env`** pour la config Supabase (spécifique à Vite) → le mobile utilise un autre système d'environnement.
3. **Logique métier mélangée** au code web (le client Supabase est créé à l'import, l'accès aux données est éparpillé dans les contexts React).

**Objectif du présent lot :** mettre en place un **monorepo** avec un **package `core` partagé** (logique, types, accès données — zéro visuel), réorganiser l'app web pour qu'elle consomme ce core **sans changement de comportement**, créer une **app mobile Expo** qui démarre et lit réellement depuis Supabase, et livrer une **première tranche d'écrans publics** (Accueil, Catalogue, Fiche produit, Panier).

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Structure du code | **Monorepo + package `core` partagé** (npm workspaces) |
| Système d'auth | **Supabase Auth** — déjà implémenté (branche `supabase-auth-migration` : auth.users + table `profiles` + RLS). Le terrain se base dessus, on ne le refait pas. |
| Travail auth dans ce lot | **Aucune réécriture d'auth** : on déplace le service Supabase Auth + `AuthContext` dans le core et on rend le client + le stockage de session compatibles mobile (`AsyncStorage`). |
| Ampleur | **Fondation + premiers écrans mobiles**, découpée en lots ; **Lot 1** ici |
| Périmètre des écrans | Répliquer l'app web à terme ; **Lot 1 = écrans publics sans auth** |
| Partage de code | **Partager la logique, UI séparée** : core partagé ; web en Tailwind, mobile en NativeWind |
| Mobile | **Expo** (managed) + **Expo Router** + **NativeWind** |
| Layout web | **Déplacé dans `apps/web/`** (layout symétrique) |
| Déploiement Vercel | **`vercel.json` à la racine** ciblant `apps/web` (aucun réglage à changer dans le dashboard) |
| Admin | **Web-only** (pas porté sur mobile) |

## 3. Découpage en lots

- **Lot 1 (ce design)** — Le terrain + tranche publique : monorepo, package `core`, app web réorganisée (comportement inchangé), app Expo qui démarre, écrans **Accueil + Catalogue + Fiche produit + Panier** (lecture/local, **aucune auth**).
- **Lot 2 (plus tard)** — Écrans authentifiés mobiles (Supabase Auth déjà en place) : Connexion/Inscription + Mon compte + Mes commandes + Suivi de commande + passage de commande.
- **Lot 3 (plus tard)** — Espace livreur.
- **Hors mobile** — Admin (reste web-only).
- **Déjà fait, hors de ce lot** — Migration vers Supabase Auth (branche `supabase-auth-migration` ; voir `2026-06-14-supabase-auth-migration-design.md`).

Chaque lot suit son propre cycle spec → plan → implémentation.

## 4. Arborescence cible

```
lumoo-mali/
├─ package.json              ← racine : workspaces npm ["apps/*", "packages/*"]
├─ tsconfig.base.json        ← config TypeScript partagée
├─ packages/
│  └─ core/                  ← @lumoo/core — logique partagée, ZÉRO visuel
│     ├─ package.json
│     └─ src/
│        ├─ types/           ← auth, category, notifications, products…
│        ├─ lib/
│        │  ├─ supabaseClient.ts  ← factory injectable (clé du terrain)
│        │  └─ storage.ts         ← interface Storage (async)
│        ├─ services/        ← auth.ts, orders/api.ts…
│        ├─ context/         ← Product, Category, Cart, Search, Ad, Auth…
│        └─ index.ts         ← surface publique du package
└─ apps/
   ├─ web/                   ← l'app Vite ACTUELLE, déplacée telle quelle
   │  ├─ package.json
   │  ├─ vite.config.ts
   │  ├─ index.html
   │  └─ src/                ← components/, App.tsx, main.tsx, utils visuels…
   └─ mobile/                ← nouvelle app Expo
      ├─ package.json
      ├─ app.config.ts
      ├─ app/                ← Expo Router (onglets + écrans)
      └─ components/, lib/…
```

## 5. Le package `core` (le point central)

### 5.1 Client Supabase injectable

Aujourd'hui `src/lib/supabase.ts` crée le client **à l'import**, avec `import.meta.env`. On remplace par une **factory** que chaque app appelle au démarrage avec ses propres valeurs :

```ts
// packages/core/src/lib/supabaseClient.ts (forme indicative)
export interface CoreConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  storage?: AsyncStorageLike;   // stockage de session injecté par l'app hôte
}
// crée le client via createClient(url, key, { auth: { storage, persistSession: true, autoRefreshToken: true } })
export function initCore(config: CoreConfig): SupabaseClient { /* crée + mémorise le singleton */ }
export function getSupabase(): SupabaseClient { /* renvoie le singleton, erreur si non initialisé */ }
```

- **Web** : `initCore({ supabaseUrl: import.meta.env.VITE_SUPABASE_URL, supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY })` — `storage` omis : Supabase utilise `localStorage` par défaut dans le navigateur.
- **Mobile** : `initCore({ … depuis expo-constants/app.config, storage: AsyncStorage })` + `detectSessionInUrl: false`.
- Le `storage` injecté est passé à la config `auth` de `supabase-js` : c'est ce qui fait **persister la session Supabase Auth** sur chaque plateforme.
- Le core **ne référence plus aucune variable d'environnement** directement.

### 5.2 Interface `Storage` asynchrone

```ts
// packages/core/src/lib/storage.ts
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

- **Web** : non requis — Supabase utilise `localStorage` par défaut dans le navigateur.
- **Mobile** : `@react-native-async-storage/async-storage` (déjà async), injecté dans `auth.storage`.
- Cette interface correspond exactement au contrat attendu par l'option `auth.storage` de `supabase-js`. Aucune gestion de session « maison » à reporter : **Supabase Auth gère la session** ; on ne fait que lui fournir le bon stockage par plateforme.

### 5.3 Contenu déplacé dans le core

- **types/** : `auth.ts`, `category.ts`, `notifications.ts`, et les types produits/commandes (`types.ts` éclaté/normalisé).
- **services/** : `auth.ts` (**service Supabase Auth déjà migré** : `signInWithPassword`, `signUp`, `getSession`, `signOut`, `resetPasswordForEmail`, `updateUser`, lecture `profiles`), `api.ts` (commandes/stats). Déplacés tels quels, branchés sur le client via `getSupabase()`.
- **context/** (React pur, fonctionne web + mobile) : `ProductContext`, `CategoryContext`, `CartContext`, `SearchContext`, `AdContext`, `AuthContext`, et les autres contexts de données. Les deux apps les importent depuis `@lumoo/core`.
- **Restent côté app** : tout ce qui rend de l'UI (ex. la partie *rendu* de `ToastContext` — l'état peut vivre dans le core, l'affichage reste par plateforme), les composants, les assets, `utils/images`.

### 5.4 Note sur l'auth (pas de « port » à inventer)

La bascule vers **Supabase Auth est déjà faite** (branche `supabase-auth-migration`). Il n'y a donc **pas** d'abstraction « port » à créer (YAGNI) : le core contient directement le service Supabase Auth + `AuthContext`. Le seul travail « terrain » côté auth est de rendre le **client et le stockage de session** indépendants de la plateforme (§5.1/§5.2) — ce dont Supabase Auth a justement besoin sur mobile (`AsyncStorage`). Les écrans authentifiés mobiles viendront au **Lot 2**.

## 6. App web — impact

- **Déplacée** dans `apps/web/` ; le code des composants, `App.tsx` et Tailwind **ne changent quasiment pas**.
- Les imports de contexts/services/types pointent vers `@lumoo/core`.
- `main.tsx` appelle `initCore({ supabaseUrl, supabaseAnonKey })` (stockage par défaut `localStorage`) **avant** de monter les providers.
- **Garde-fou non négociable** : à chaque étape du déménagement, l'app web doit **builder et fonctionner comme avant**.

## 7. App mobile Expo — Lot 1

- **Stack** : Expo (managed) + **Expo Router** (navigation par fichiers) + **NativeWind** (Tailwind pour RN).
- **Polyfills Supabase RN** : `react-native-url-polyfill/auto`, `@react-native-async-storage/async-storage`.
- **Navigation par onglets** : `Accueil` · `Catalogue` · `Panier`. (Onglet `Compte` ajouté au Lot 2.)
- **Écrans Lot 1** :
  - **Accueil** : hero, produits populaires, bannières pub, bloc « features ».
  - **Catalogue** : grille de produits + filtres par catégorie + recherche.
  - **Fiche produit** : détail + sélection quantité + ajout au panier.
  - **Panier** : liste des articles, quantités, total (panier **local**, pas d'auth).
- **Visuel** : s'inspire de l'app web (mêmes couleurs/identité), adapté aux conventions mobiles natives.
- **Boot** : `initCore({ … , storage: AsyncStorage })` avant le rendu, puis les providers `@lumoo/core`.

## 8. Outillage & configuration

- **npm workspaces** (déjà sur npm — pas de nouvel outil ; Turborepo possible plus tard).
- `tsconfig.base.json` partagé + alias de chemin `@lumoo/core`.
- **Vercel** (l'utilisateur n'a pas accès au dashboard ; `main` se déploie automatiquement) : on **n'ajuste aucun réglage du dashboard**. À la place, on committe un **`vercel.json` à la racine** qui redirige le build vers `apps/web` :
  ```json
  {
    "installCommand": "npm install",
    "buildCommand": "npm run build --workspace apps/web",
    "outputDirectory": "apps/web/dist"
  }
  ```
  Ainsi le déploiement auto de `main` continue de fonctionner après le merge, sans intervention sur Vercel. *(Cas résiduel : si une « Root Directory » non-standard est déjà configurée dans le dashboard, le propriétaire du repo devra la remettre à la racine.)*
- **Variables d'environnement** :
  - Web : `apps/web/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
  - Mobile : `apps/mobile/app.config.ts` + `.env` (via `expo-constants`).

## 9. Risques & garde-fous

| Risque | Garde-fou |
|--------|-----------|
| Casser l'app web pendant le déménagement | Build + lancement web vérifiés à **chaque** étape |
| Session Supabase Auth non persistée sur mobile | Passer `AsyncStorage` à `auth.storage` ; `detectSessionInUrl: false` ; persistance validée au Lot 2 |
| Supabase sur RN (polyfills manquants) | Smoke-test : le mobile lit les produits dès le départ |
| Branche basée sur la migration auth pas encore dans `main` | Dev sur `react-native-terrain` (contient déjà Supabase Auth) ; **merger après** que la migration auth soit dans `main`, en rebasant le terrain sur `main` |
| Contexts couplés au web | On ne déplace que les contexts **agnostiques** ; l'UI (Toast…) reste par plateforme |
| Imports web cachés dans le core (ex. `window`, assets) | Revue à l'extraction ; le core ne doit dépendre d'aucune API DOM |
| Divergence des versions React web (19) / RN | Aligner React/React-DOM/React-Native compatibles ; le core ne fixe pas React (peerDependency) |
| Déploiement Vercel cassé au merge sur `main` (web déplacé, pas d'accès dashboard) | `vercel.json` racine (install/build/output ciblant `apps/web`) committé ; à valider sur un déploiement *preview* de la PR avant merge |

## 10. Hors périmètre (YAGNI pour ce lot)

- Lots 2 et 3 (écrans authentifiés, compte, commandes, suivi, livreur).
- Admin sur mobile (reste web-only).
- (Re)faire la migration vers Supabase Auth — **déjà réalisée** sur `supabase-auth-migration`.
- UI universelle partagée (react-native-web / Tamagui) — on a choisi UI séparée.
- Notifications push mobiles, deep links, build store (EAS) — phases ultérieures.

## 11. Critères de succès du Lot 1

1. `npm install` à la racine installe tout le workspace.
2. L'app **web** build et fonctionne **exactement comme avant**, en consommant `@lumoo/core`.
3. L'app **mobile** démarre (Expo) et affiche les **vrais produits depuis Supabase** via le core.
4. Sur mobile : parcours **Accueil → Catalogue → Fiche produit → ajouter au panier → voir le panier**.
5. **Zéro duplication** de la logique d'accès aux données entre web et mobile.
6. Le client Supabase et le **stockage de session** sont **indépendants de la plateforme** (`AsyncStorage` injectable) — terrain prêt pour les écrans authentifiés du Lot 2.
7. Le service **Supabase Auth** et `AuthContext` vivent dans `@lumoo/core` et sont consommés à l'identique par le web (Lot 1) ; le mobile les réutilisera tels quels au Lot 2.
8. Le **déploiement Vercel preview** de la PR réussit grâce au `vercel.json` racine (validation avant merge sur `main`).
