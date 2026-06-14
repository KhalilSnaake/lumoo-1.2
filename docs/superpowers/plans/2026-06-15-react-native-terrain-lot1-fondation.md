# Terrain React Native — Lot 1 / Plan 1 : Fondation (monorepo + @lumoo/core + Expo smoke‑test)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le dépôt web actuel en monorepo npm workspaces avec un package partagé `@lumoo/core`, faire consommer ce core par l'app web (comportement inchangé), et démarrer une app Expo qui lit réellement les produits depuis Supabase via le core.

**Architecture:** `packages/core` contient toute la logique agnostique (client Supabase injectable, types, services, contexts React). `apps/web` = l'app Vite actuelle déplacée, qui appelle `initCore()` au boot et importe depuis `@lumoo/core`. `apps/mobile` = app Expo (Expo Router + NativeWind) qui appelle `initCore()` avec `AsyncStorage` et affiche un écran preuve listant les produits. Aucune réécriture d'auth (Supabase Auth est déjà en place sur la branche `supabase-auth-migration`, dont cette branche hérite).

**Tech Stack:** npm workspaces · TypeScript 5.9 · React 19 · Vite 7 + Tailwind 4 (web) · Expo SDK 53+ (React 19 / RN 0.79+) + Expo Router + NativeWind 4 (mobile) · `@supabase/supabase-js` · Vitest (tests du core).

**Pré-requis / contexte de branche :** travailler dans le worktree `C:/Dev/lumoo-mali` sur la branche `react-native-terrain` (elle contient déjà le code Supabase Auth). Le worktree `C:/Dev/lumoo-auth` (branche `supabase-auth-migration`) appartient à l'effort auth — **ne pas y toucher**. Spec de référence : `docs/superpowers/specs/2026-06-15-react-native-monorepo-terrain-design.md`.

**Note TDD :** ce plan est une migration structurelle (déplacement de fichiers existants) + un peu de code neuf. On applique la TDD au seul morceau de logique réellement neuf (la factory `initCore`/`getSupabase`). Pour le reste, la vérification se fait par **typecheck + build + lancement** (le filet de sécurité : l'app web doit toujours builder et tourner).

---

## Structure des fichiers (cible de ce plan)

```
lumoo-mali/                         (racine = racine du workspace)
├─ package.json                     ← NOUVEAU : workspaces
├─ package-lock.json                ← régénéré
├─ tsconfig.base.json               ← NOUVEAU : options TS partagées
├─ vercel.json                      ← NOUVEAU : build ciblant apps/web
├─ .gitignore                       ← MODIFIÉ (ajouts mobile)
├─ docs/ , *.sql , README.md , TODO.md   ← inchangés (restent à la racine)
├─ packages/
│  └─ core/
│     ├─ package.json               ← NOUVEAU (@lumoo/core)
│     ├─ tsconfig.json              ← NOUVEAU (extends base)
│     ├─ vitest.config.ts           ← NOUVEAU
│     ├─ src/
│     │  ├─ lib/
│     │  │  ├─ storage.ts           ← NOUVEAU (interface AsyncStorageLike)
│     │  │  └─ supabaseClient.ts    ← NOUVEAU (initCore/getSupabase)
│     │  ├─ types/                  ← DÉPLACÉ depuis web src/types + types.ts
│     │  ├─ services/               ← DÉPLACÉ (auth.ts, api.ts) + rewiré
│     │  ├─ context/                ← DÉPLACÉ (contexts agnostiques)
│     │  ├─ data/                   ← DÉPLACÉ (products.ts seed)
│     │  └─ index.ts                ← NOUVEAU (surface publique)
│     └─ test/
│        └─ supabaseClient.test.ts  ← NOUVEAU
└─ apps/
   ├─ web/                          ← l'app Vite actuelle, DÉPLACÉE
   │  ├─ package.json , tsconfig.json , vite.config.ts , index.html
   │  ├─ public/ , src/  (sans context/services/types/lib/data déplacés)
   └─ mobile/                       ← NOUVEAU : app Expo
      ├─ package.json , app.json/app.config.ts , tsconfig.json
      ├─ metro.config.js , babel.config.js , global.css , nativewind-env.d.ts
      ├─ lib/storage.ts , lib/env.ts
      └─ app/  (_layout.tsx, index.tsx = écran preuve)
```

---

## PARTIE A — Monorepo + app web déplacée (l'app web doit toujours tourner)

### Task 1 : Déplacer l'app web dans `apps/web/`

**Files:**
- Move: `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `public/` → `apps/web/`
- Delete (régénérés/obsolètes à la racine): `package-lock.json` (racine), `node_modules/` (racine)

- [ ] **Step 1 : Créer les dossiers et déplacer les fichiers de l'app web avec `git mv`**

```bash
cd /c/Dev/lumoo-mali
mkdir -p apps/web packages
git mv index.html apps/web/index.html
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv package.json apps/web/package.json
git mv src apps/web/src
git mv public apps/web/public
```

- [ ] **Step 2 : Supprimer le lockfile et node_modules de la racine (seront régénérés par le workspace)**

```bash
rm -f package-lock.json
rm -rf node_modules
```

- [ ] **Step 3 : Vérifier l'état git (déplacements détectés, rien de cassé)**

Run: `git status --short`
Expected: des lignes `R  index.html -> apps/web/index.html` etc. (renames). Aucun fichier `docs/`, `*.sql`, `README.md`, `TODO.md` déplacé.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "refactor: déplacer l'app web dans apps/web/ (préparation monorepo)"
```

---

### Task 2 : Racine du workspace (package.json, tsconfig.base, tsconfig web, vercel.json) + install + vérif

**Files:**
- Create: `package.json` (racine), `tsconfig.base.json` (racine), `vercel.json` (racine)
- Modify: `apps/web/package.json`, `apps/web/tsconfig.json`

- [ ] **Step 1 : Créer le `package.json` racine du workspace**

`package.json` (racine) :
```json
{
  "name": "lumoo-monorepo",
  "private": true,
  "version": "0.0.0",
  "workspaces": [
    "packages/*",
    "apps/web",
    "apps/mobile"
  ],
  "scripts": {
    "dev:web": "npm run dev --workspace apps/web",
    "build:web": "npm run build --workspace apps/web",
    "test:core": "npm run test --workspace @lumoo/core"
  }
}
```

- [ ] **Step 2 : Créer `tsconfig.base.json` (options TS partagées)**

`tsconfig.base.json` (racine) :
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "useDefineForClassFields": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "ignoreDeprecations": "5.0"
  }
}
```

- [ ] **Step 3 : Mettre à jour `apps/web/package.json`** (nom propre + dépendance au core)

Modifier `apps/web/package.json` : renommer le paquet et ajouter `@lumoo/core` en dépendance. Remplacer les 2 premières lignes de clés et la section `dependencies` :

```jsonc
{
  "name": "@lumoo/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@lumoo/core": "*",
    "@supabase/supabase-js": "^2.105.4",
    "clsx": "2.1.1",
    "exceljs": "^3.4.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "read-excel-file": "^9.0.10",
    "tailwind-merge": "3.4.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.1.17",
    "@types/node": "22.19.17",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "5.1.1",
    "tailwindcss": "4.1.17",
    "typescript": "5.9.3",
    "vite": "7.3.2",
    "vite-plugin-singlefile": "2.3.0"
  }
}
```

- [ ] **Step 4 : Faire que `apps/web/tsconfig.json` étende la base et garde ses options web**

`apps/web/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@lumoo/core": ["../../packages/core/src/index.ts"],
      "@lumoo/core/*": ["../../packages/core/src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5 : Créer `vercel.json` à la racine** (déploiement ciblant `apps/web`, sans toucher au dashboard)

`vercel.json` (racine) :
```json
{
  "installCommand": "npm install",
  "buildCommand": "npm run build --workspace @lumoo/web",
  "outputDirectory": "apps/web/dist"
}
```

- [ ] **Step 6 : Installer le workspace**

Run: `npm install`
Expected: installation sans erreur ; un lien symbolique `node_modules/@lumoo/core` est créé (il pointera vers le package créé en Partie B — il peut être vide pour l'instant, on le crée juste après).

> Si `npm install` échoue parce que `@lumoo/core` n'existe pas encore, c'est attendu : enchaîner sur la Partie B (Task 3) puis relancer `npm install`. Sinon, continuer.

- [ ] **Step 7 : Vérifier que l'app web build et tourne encore (filet de sécurité)**

Run: `npm run build:web`
Expected: build Vite réussi, sortie dans `apps/web/dist/`.

Run (manuel): `npm run dev:web` puis ouvrir l'URL affichée — l'app doit s'afficher comme avant.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "build: racine workspace npm (package.json, tsconfig.base, vercel.json) + web rattaché au core"
```

---

## PARTIE B — Package `@lumoo/core` et consommation par le web

### Task 3 : Scaffolder `packages/core`

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts` (temporaire)

- [ ] **Step 1 : Créer `packages/core/package.json`**

`packages/core/package.json` :
```json
{
  "name": "@lumoo/core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.105.4"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@types/react": "19.2.7",
    "typescript": "5.9.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2 : Créer `packages/core/tsconfig.json`**

`packages/core/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "noEmit": true,
    "baseUrl": "."
  },
  "include": ["src", "test"]
}
```

> `DOM` est dans `lib` uniquement pour les types (ex. types de `@supabase/supabase-js`). Le code du core ne doit appeler **aucune** API DOM à l'exécution.

- [ ] **Step 3 : Créer `packages/core/vitest.config.ts`**

`packages/core/vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4 : Créer un `index.ts` temporaire** (sera complété en Task 8)

`packages/core/src/index.ts` :
```ts
export {};
```

- [ ] **Step 5 : Installer (relier le workspace) et committer**

Run: `npm install`
Expected: `node_modules/@lumoo/core` lié, `vitest` installé.

```bash
git add -A
git commit -m "feat(core): scaffolder le package @lumoo/core (vitest, tsconfig)"
```

---

### Task 4 : (TDD) Interface `Storage` + factory `initCore`/`getSupabase`

**Files:**
- Create: `packages/core/src/lib/storage.ts`, `packages/core/src/lib/supabaseClient.ts`
- Test: `packages/core/test/supabaseClient.test.ts`

- [ ] **Step 1 : Écrire le test d'abord**

`packages/core/test/supabaseClient.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { initCore, getSupabase } from '../src/lib/supabaseClient';

// Les tests d'un même fichier partagent l'état du module (singleton) et s'exécutent dans l'ordre.
describe('core supabase client', () => {
  it('getSupabase() lève une erreur avant initCore()', () => {
    expect(() => getSupabase()).toThrowError(/initCore/);
  });

  it('initCore() crée un client et getSupabase() renvoie la même instance', () => {
    const client = initCore({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'test-anon-key',
    });
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe('function');
    expect(getSupabase()).toBe(client);
  });
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run: `npm run test:core`
Expected: ÉCHEC — module `../src/lib/supabaseClient` introuvable.

- [ ] **Step 3 : Créer l'interface de stockage**

`packages/core/src/lib/storage.ts` :
```ts
// Contrat compatible avec l'option `auth.storage` de supabase-js,
// satisfait par localStorage (web, via wrapper) et AsyncStorage (mobile).
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

- [ ] **Step 4 : Créer la factory**

`packages/core/src/lib/supabaseClient.ts` :
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AsyncStorageLike } from './storage';

export interface CoreConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Stockage de session injecté par l'app hôte. Omis sur web (localStorage par défaut). */
  storage?: AsyncStorageLike;
  /** false sur mobile (pas d'URL de redirection à parser). Défaut: true (web). */
  detectSessionInUrl?: boolean;
  /** Base d'URL pour les liens de reset de mot de passe (ex. https://lumoo.ml). */
  authRedirectUrl?: string;
}

let client: SupabaseClient | null = null;
let authRedirectUrl: string | undefined;

export function initCore(config: CoreConfig): SupabaseClient {
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      ...(config.storage ? { storage: config.storage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: config.detectSessionInUrl ?? true,
    },
  });
  authRedirectUrl = config.authRedirectUrl;
  return client;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error("Supabase non initialisé : appelez initCore(config) au démarrage de l'app.");
  }
  return client;
}

/** URL de redirection pour le reset de mot de passe (paramétrée par plateforme). */
export function getAuthRedirectUrl(): string | undefined {
  return authRedirectUrl;
}
```

- [ ] **Step 5 : Lancer le test pour le voir passer**

Run: `npm run test:core`
Expected: PASS (2 tests verts).

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(core): client Supabase injectable (initCore/getSupabase) + interface Storage"
```

---

### Task 5 : Déplacer les types dans le core

**Files:**
- Move: `apps/web/src/types/` → `packages/core/src/types/`, `apps/web/src/types.ts` → `packages/core/src/types/index.ts` (fusion)

- [ ] **Step 1 : Déplacer le dossier `types/` et le fichier `types.ts`**

```bash
cd /c/Dev/lumoo-mali
git mv apps/web/src/types packages/core/src/types
git mv apps/web/src/types.ts packages/core/src/types/app.ts
```

- [ ] **Step 2 : Créer un baril `packages/core/src/types/index.ts`** qui réexporte tout

Vérifier d'abord les fichiers présents : `ls packages/core/src/types`. Puis créer/écraser `packages/core/src/types/index.ts` pour réexporter chaque module présent. Exemple (adapter à la liste réelle) :
```ts
export * from './app';
export * from './auth';
export * from './category';
export * from './notifications';
```

> Si `app.ts` et un autre fichier exportent un même nom, préférer des réexports nommés explicites pour lever l'ambiguïté. Le typecheck (Step 4) signalera tout conflit.

- [ ] **Step 3 : Corriger les imports relatifs internes aux types** (si un fichier de `types/` importait `../types`), les faire pointer vers `./app` ou le bon module local.

- [ ] **Step 4 : Typecheck du core**

Run: `npm run typecheck --workspace @lumoo/core`
Expected: peut signaler des imports cassés tant que services/contexts ne sont pas déplacés — c'est OK à ce stade s'ils concernent des fichiers encore dans le web. L'objectif ici : aucun conflit interne au dossier `types/`.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor(core): déplacer les types métier dans @lumoo/core"
```

---

### Task 6 : Déplacer les services dans le core et les brancher sur `getSupabase()`

**Files:**
- Move: `apps/web/src/services/` → `packages/core/src/services/`
- Delete: `apps/web/src/lib/supabase.ts` (remplacé par la factory du core)
- Modify: `packages/core/src/services/auth.ts`, `packages/core/src/services/api.ts`

- [ ] **Step 1 : Déplacer le dossier services et supprimer l'ancien client web**

```bash
cd /c/Dev/lumoo-mali
git mv apps/web/src/services packages/core/src/services
git rm apps/web/src/lib/supabase.ts
```

- [ ] **Step 2 : Rebrancher chaque service sur la factory**

Dans `packages/core/src/services/api.ts` ET `packages/core/src/services/auth.ts` :
1. Remplacer l'import `import { supabase } from '../lib/supabase';` par `import { getSupabase } from '../lib/supabaseClient';`.
2. Corriger l'import des types : `from '../types/auth'` → `from '../types'` (ou le baril) ; `from '../types'` reste valide.
3. Au début de **chaque fonction exportée** qui utilise `supabase`, insérer en première ligne : `const supabase = getSupabase();`

Fonctions concernées dans `api.ts` : `apiCreateOrder`, `apiGetOrders`, `apiGetOrder`, `apiUpdateOrderStatus`, `apiUpdateOrder`, `apiDeleteOrder`, `apiGetStats`.
Fonctions concernées dans `auth.ts` : `apiLogin`, `apiRegister`, `apiCreateUser` (lève une erreur, pas de supabase — laisser), `apiLogout`, `apiGetCurrentUser`, `apiGetAllUsers`, `apiUpdateUser`, `apiDeleteUser` (renvoie false — laisser), `apiUpdateOwnPassword`, `apiRequestPasswordReset`. Et la fonction interne `fetchProfile` : ajouter aussi `const supabase = getSupabase();` en tête.

- [ ] **Step 3 : Paramétrer le redirect du reset (retirer `window.location.origin`)**

Dans `packages/core/src/services/auth.ts`, fonction `apiRequestPasswordReset`, remplacer :
```ts
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}`,
  });
```
par :
```ts
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: getAuthRedirectUrl(),
  });
```
et ajouter `getAuthRedirectUrl` à l'import : `import { getSupabase, getAuthRedirectUrl } from '../lib/supabaseClient';`

> Le core ne référence plus aucune API DOM. Sur web, `authRedirectUrl` sera passé à `initCore` (Task 8). Sur mobile (Lot 2), on passera un deep link.

- [ ] **Step 4 : Typecheck du core**

Run: `npm run typecheck --workspace @lumoo/core`
Expected: plus d'erreur liée à `supabase` non défini ni à `window`. (Des erreurs sur les contexts non encore déplacés sont normales — ils sont encore côté web et n'appartiennent pas au core.)

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor(core): déplacer services (auth, api) et les brancher sur getSupabase()"
```

---

### Task 7 : Déplacer les contexts agnostiques (et le seed `data/`) dans le core

**Files:**
- Move: `apps/web/src/context/` → `packages/core/src/context/`, `apps/web/src/data/` → `packages/core/src/data/`
- Modify: imports relatifs dans les contexts déplacés

- [ ] **Step 1 : Déplacer les dossiers, puis ramener `ToastContext` côté web**

`ToastContext` est le **seul** context qui rend du DOM (un viewport `<div>` de toasts) — vérifié. Il reste donc côté web (le mobile ne l'utilise pas dans ce lot). Tous les autres contexts sont purs et vont dans le core.

```bash
cd /c/Dev/lumoo-mali
git mv apps/web/src/context packages/core/src/context
git mv apps/web/src/data packages/core/src/data
# ToastContext rend du DOM (<div> viewport) → rester côté web
mkdir -p apps/web/src/context
git mv packages/core/src/context/ToastContext.tsx apps/web/src/context/ToastContext.tsx
```

- [ ] **Step 2 : Corriger les imports internes des contexts**

Dans chaque fichier de `packages/core/src/context/*.tsx` :
- `from '../lib/supabase'` → `from '../lib/supabaseClient'` **et** remplacer l'usage : ces contexts utilisent `supabase.from(...)` directement. Ajouter `const supabase = getSupabase();` au début de chaque fonction/handler qui l'utilise (ex. `fetchProducts`, `addProduct`, `updateProduct`, `deleteProduct`, `seedProducts` dans `ProductContext`, et équivalents dans `OrderContext`, `CategoryContext`, `AdContext`, `NotificationContext`, `ContactMessagesContext`). Import : `import { getSupabase } from '../lib/supabaseClient';`
- `from '../services/...'` reste valide (services au même niveau dans le core).
- `from '../types'` / `from '../types/...'` reste valide.
- `from '../data/products'` reste valide (data déplacé aussi).

> Astuce : repérer les usages restants avec `grep -rn "from '../lib/supabase'" packages/core/src/context` (doit renvoyer 0 après correction) et `grep -rn "supabase\." packages/core/src/context` (chaque occurrence doit être précédée d'un `const supabase = getSupabase();` dans la même fonction).

- [ ] **Step 3 : Typecheck du core**

Run: `npm run typecheck --workspace @lumoo/core`
Expected: PASS (0 erreur) — tout le core est cohérent et autonome.

- [ ] **Step 4 : Lancer les tests du core**

Run: `npm run test:core`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor(core): déplacer les contexts agnostiques + seed data dans @lumoo/core"
```

---

### Task 8 : Surface publique du core (`index.ts`)

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1 : Écrire le baril public**

Lister d'abord les contexts présents (`ls packages/core/src/context`) puis écrire `packages/core/src/index.ts` en réexportant la config, les types, les services et **chaque** provider/hook de context. Exemple (adapter à la liste réelle) :
```ts
// Config / client
export { initCore, getSupabase, getAuthRedirectUrl } from './lib/supabaseClient';
export type { CoreConfig } from './lib/supabaseClient';
export type { AsyncStorageLike } from './lib/storage';

// Types métier
export * from './types';

// Services
export * from './services/api';
export * from './services/auth';

// Contexts (providers + hooks) — PAS ToastContext (rendu DOM, reste côté web)
export * from './context/AuthContext';
export * from './context/CartContext';
export * from './context/OrderContext';
export * from './context/ProductContext';
export * from './context/CategoryContext';
export * from './context/AdContext';
export * from './context/NotificationContext';
export * from './context/SearchContext';
export * from './context/ContactMessagesContext';
```

> Si deux modules exportent un même nom (collision), remplacer le `export *` fautif par des réexports nommés explicites. Le typecheck (Step 2) révèle les collisions.

- [ ] **Step 2 : Typecheck du core**

Run: `npm run typecheck --workspace @lumoo/core`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat(core): exposer la surface publique de @lumoo/core (index.ts)"
```

---

### Task 9 : L'app web consomme `@lumoo/core`

**Files:**
- Modify: `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, et tous les fichiers de `apps/web/src/components/*` important des contexts/services/types
- Create: `apps/web/.env` (si absent) — variables Vite déjà existantes
- Delete: `apps/web/src/lib/` si vide

- [ ] **Step 1 : Ajouter l'alias `@lumoo/core` (vers la source) dans Vite**

`apps/web/vite.config.ts` — ajouter l'alias core à côté de `@` :
```ts
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lumoo/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
});
```

- [ ] **Step 2 : Initialiser le core au boot dans `main.tsx`**

`apps/web/src/main.tsx` :
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initCore } from "@lumoo/core";
import "./index.css";
import App from "./App";

initCore({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  authRedirectUrl: window.location.origin,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3 : Rediriger tous les imports de contexts/services/types vers `@lumoo/core`**

Dans `apps/web/src` : remplacer tous les imports relatifs vers les modules déplacés par `@lumoo/core`. Repérer les occurrences :
```bash
grep -rnE "from ['\"][./]+(context|services|types)(/[^'\"]*)?['\"]" apps/web/src
grep -rnE "from ['\"][./]+(data/products|lib/supabase)['\"]" apps/web/src
```
Pour chaque occurrence, remplacer le chemin relatif par `@lumoo/core`. Exemples :
- `import { useAuth } from './context/AuthContext'` → `import { useAuth } from '@lumoo/core'`
- `import { Product } from '../types'` → `import { Product } from '@lumoo/core'`
- `import { apiGetOrders } from '../services/api'` → `import { apiGetOrders } from '@lumoo/core'`
- `import { supabase } from '../lib/supabase'` → utiliser `getSupabase()` depuis `@lumoo/core` : `import { getSupabase } from '@lumoo/core'` puis `const supabase = getSupabase();` dans la fonction concernée.

> `App.tsx` importe une dizaine de providers depuis `./context/*` : les regrouper en un seul import core `import { AuthProvider, CartProvider, OrderProvider, ProductProvider, CategoryProvider, AdProvider, NotificationProvider, SearchProvider, ContactMessagesProvider, useAuth, useProducts, useCategories, useCart } from '@lumoo/core';`
> **Exception `ToastContext`** : il reste local au web. Garder `import { ToastProvider } from './context/ToastContext'` dans `App.tsx`, et dans tout composant utilisant `useToast`, garder l'import local `from '../context/ToastContext'` (ne PAS le router vers `@lumoo/core`). Le `grep` du Step 3 listera ces imports — les laisser tels quels pour `ToastContext` uniquement.

- [ ] **Step 4 : Supprimer le dossier `lib` web s'il est vide**

```bash
rmdir apps/web/src/lib 2>/dev/null || true
```

- [ ] **Step 5 : Mettre à jour `apps/web/tsconfig.json`** — déjà fait en Task 2 (paths `@lumoo/core`). Vérifier que `@/*` n'est plus utilisé pour les modules déplacés.

- [ ] **Step 6 : Typecheck de l'app web**

Run: `npm exec --workspace @lumoo/web -- tsc --noEmit`
Expected: PASS (0 erreur). Corriger tout import oublié signalé.

- [ ] **Step 7 : Build de l'app web**

Run: `npm run build:web`
Expected: build Vite réussi.

- [ ] **Step 8 : Lancement manuel (smoke test fonctionnel)**

Run: `npm run dev:web`
Expected: l'app s'affiche **comme avant** — catalogue, panier, connexion. Vérifier la console : pas d'erreur « Supabase non initialisé ».

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "refactor(web): consommer @lumoo/core (initCore au boot, imports unifiés)"
```

---

## PARTIE C — App Expo qui démarre et lit les produits (preuve de bout en bout)

### Task 10 : Scaffolder l'app Expo dans `apps/mobile`

**Files:**
- Create: arborescence Expo dans `apps/mobile/` (via `create-expo-app`), puis ajustements workspace

- [ ] **Step 1 : Générer l'app Expo (template Expo Router, TypeScript)**

```bash
cd /c/Dev/lumoo-mali/apps
npx create-expo-app@latest mobile
```
Expected: `apps/mobile/` créé avec Expo Router (template par défaut) et TypeScript. (Le template récent inclut `expo-router` et un dossier `app/`.)

- [ ] **Step 2 : Renommer le package et nettoyer le template**

Dans `apps/mobile/package.json`, mettre `"name": "@lumoo/mobile"`. Supprimer les écrans de démo superflus du template (garder `app/_layout.tsx`, on remplacera `app/index.tsx` en Task 12) :
```bash
cd /c/Dev/lumoo-mali/apps/mobile
rm -rf app/(tabs) components/__tests__ 2>/dev/null || true
```
> Ne pas supprimer `app/_layout.tsx`. La liste exacte des fichiers de démo dépend du template ; ne retirer que les écrans d'exemple, pas la config.

- [ ] **Step 3 : Ajouter les dépendances runtime nécessaires**

```bash
cd /c/Dev/lumoo-mali/apps/mobile
npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
npx expo install @supabase/supabase-js
npm pkg set dependencies.@lumoo/core="*"
```

- [ ] **Step 4 : Réinstaller au niveau racine (lier le workspace)**

```bash
cd /c/Dev/lumoo-mali
npm install
```
Expected: `@lumoo/mobile` et `@lumoo/core` liés dans le workspace.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(mobile): scaffolder l'app Expo (@lumoo/mobile) dans apps/mobile"
```

---

### Task 11 : Configurer NativeWind, Metro (workspace + core source), polyfills, env

**Files:**
- Create/Modify: `apps/mobile/babel.config.js`, `apps/mobile/metro.config.js`, `apps/mobile/tailwind.config.js`, `apps/mobile/global.css`, `apps/mobile/nativewind-env.d.ts`, `apps/mobile/tsconfig.json`, `apps/mobile/lib/storage.ts`, `apps/mobile/lib/env.ts`, `apps/mobile/app.json`

- [ ] **Step 1 : Installer NativeWind + Tailwind**

```bash
cd /c/Dev/lumoo-mali/apps/mobile
npx expo install nativewind react-native-reanimated react-native-safe-area-context
npm install -D tailwindcss@^3.4.0
```
> NativeWind v4 s'appuie sur Tailwind 3 côté mobile (l'app web reste en Tailwind 4 ; les deux sont indépendantes).

- [ ] **Step 2 : `tailwind.config.js`** (mobile)

`apps/mobile/tailwind.config.js` :
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Identité Lumoo (vert/émeraude) — alignée sur le web
        brand: { DEFAULT: "#16a34a", dark: "#059669" },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3 : `global.css`** (directives Tailwind)

`apps/mobile/global.css` :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4 : `babel.config.js`**

`apps/mobile/babel.config.js` :
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5 : `metro.config.js`** (NativeWind + résolution du workspace/core en source)

`apps/mobile/metro.config.js` :
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo : surveiller la racine et résoudre les node_modules des deux niveaux
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6 : `nativewind-env.d.ts`** (types className)

`apps/mobile/nativewind-env.d.ts` :
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 7 : `tsconfig.json` mobile** (paths vers le core source)

`apps/mobile/tsconfig.json` :
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@lumoo/core": ["../../packages/core/src/index.ts"],
      "@lumoo/core/*": ["../../packages/core/src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "nativewind-env.d.ts"]
}
```

- [ ] **Step 8 : Adaptateur de stockage mobile**

`apps/mobile/lib/storage.ts` :
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AsyncStorageLike } from "@lumoo/core";

export const mobileStorage: AsyncStorageLike = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
```

- [ ] **Step 9 : Lecture des variables d'environnement**

`apps/mobile/lib/env.ts` :
```ts
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";
```

Créer `apps/mobile/.env` (mêmes valeurs que le web, préfixe `EXPO_PUBLIC_`) :
```
EXPO_PUBLIC_SUPABASE_URL=<même valeur que VITE_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<même valeur que VITE_SUPABASE_PUBLISHABLE_KEY>
```
> Récupérer les valeurs depuis `apps/web/.env`. Ne pas committer `.env` (déjà ignoré — voir Task suivante pour l'ajout au .gitignore).

- [ ] **Step 10 : Ignorer les artefacts mobiles à la racine**

Ajouter à `.gitignore` (racine) :
```
# Mobile / Expo
apps/mobile/.expo
apps/mobile/.env
**/.env.local
```

- [ ] **Step 11 : Commit**

```bash
cd /c/Dev/lumoo-mali
git add -A
git commit -m "chore(mobile): config NativeWind, Metro (workspace), polyfills, env"
```

---

### Task 12 : Boot du core sur mobile + écran preuve listant les produits

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`

- [ ] **Step 1 : Polyfill + initCore + import CSS dans le layout racine**

`apps/mobile/app/_layout.tsx` :
```tsx
import "react-native-url-polyfill/auto";
import "../global.css";
import { Stack } from "expo-router";
import { initCore, ProductProvider } from "@lumoo/core";
import { mobileStorage } from "../lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
});

export default function RootLayout() {
  return (
    <ProductProvider>
      <Stack screenOptions={{ headerTitle: "Lumoo" }} />
    </ProductProvider>
  );
}
```

- [ ] **Step 2 : Écran preuve — liste des produits depuis le core**

`apps/mobile/app/index.tsx` :
```tsx
import { FlatList, Text, View, ActivityIndicator } from "react-native";
import { useProducts } from "@lumoo/core";

export default function HomeScreen() {
  const { products, loading } = useProducts();

  if (loading && products.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-gray-500">Chargement des produits…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Text className="px-4 pt-4 pb-2 text-xl font-extrabold text-gray-800">
        Produits ({products.length})
      </Text>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <View className="mb-3 rounded-2xl bg-white p-4 border border-gray-100">
            <Text className="font-bold text-gray-800">{item.name}</Text>
            <Text className="text-brand font-extrabold mt-1">
              {item.price.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-gray-400 text-center mt-8">Aucun produit.</Text>
        }
      />
    </View>
  );
}
```

- [ ] **Step 3 : Lancer l'app Expo et vérifier la lecture réelle des produits**

Run: `npm run start --workspace @lumoo/mobile` (ou `cd apps/mobile && npx expo start`)
Expected: l'app démarre (Expo Go / web). L'écran affiche **« Produits (N) »** avec les vrais produits Supabase (les mêmes que le web). Pas d'erreur « Supabase non initialisé » ni de crash de polyfill URL.

> Vérification rapide sans appareil : `npx expo start --web` ouvre l'app dans le navigateur et permet de confirmer que la liste se remplit.

- [ ] **Step 4 : Commit**

```bash
cd /c/Dev/lumoo-mali
git add -A
git commit -m "feat(mobile): boot @lumoo/core (AsyncStorage) + écran preuve listant les produits"
```

---

## Vérification finale du Lot 1 / Plan 1 (critères de succès de la spec)

- [ ] **C1 :** `npm install` à la racine installe tout le workspace sans erreur.
- [ ] **C2 :** `npm run build:web` réussit et `npm run dev:web` montre l'app **identique à avant**.
- [ ] **C3 :** `npm run test:core` est vert ; `tsc --noEmit` du core et du web sont verts.
- [ ] **C4 :** l'app mobile démarre et affiche les **vrais produits depuis Supabase** via `@lumoo/core`.
- [ ] **C5 :** aucune duplication de la logique d'accès aux données (web et mobile passent par `@lumoo/core`).
- [ ] **C6 :** le `vercel.json` racine cible `apps/web` (à valider sur un déploiement *preview* avant tout merge dans `main`).

---

## Hors de ce plan (→ Plan 2)

Écrans publics mobiles complets, fidèles au web : **Accueil** (hero, populaires, pubs, features), **Catalogue** (grille + catégories + recherche), **Fiche produit** (modal/détail + quantité), **Panier** (CartBuilder), avec navigation par onglets Expo Router et UI NativeWind reprenant l'identité Lumoo. Ces écrans réutilisent les contexts du core (`useProducts`, `useCategories`, `useCart`, `useSearch`) déjà disponibles après ce plan.
