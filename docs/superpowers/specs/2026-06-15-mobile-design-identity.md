# Identité visuelle mobile — Fondation (logo, couleurs, typographie)

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, monorepo npm (web Vite + mobile Expo)
**Worktree / branche :** `lumoo-mali` / `react-native-terrain`
**Statut :** Design validé, en attente de relecture avant plan d'implémentation

---

## 1. Contexte et objectif

Le mobile (Expo SDK 54 + NativeWind) tourne désormais (crashes React et modules natifs réglés, données Supabase OK), mais il n'a **aucune identité visuelle** : assets template Expo par défaut, pas de logo Lumoo, polices non chargées, couleurs génériques.

**Objectif :** poser une **fondation d'identité visuelle réutilisable** sur le mobile, alignée sur la marque web déjà en prod et sur les standards `CLAUDE.md` — sans refondre les écrans existants.

Ce lot couvre les **trois piliers** : logo, couleurs, typographie.

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Périmètre | **Logo + couleurs + typographie** |
| Couleur de marque | **Vert émeraude `#16a34a`** (DEFAULT) / `#059669` (dark) — cohérent web ; le bleu du splash était un reliquat |
| Typographie | **Spline Sans** (titres) + **Inter** (texte), **embarquées** via `@expo-google-fonts` |
| Emplacement des tokens | **Mobile-only** (`apps/mobile`), pas de partage `@lumoo/core` pour ce lot (zéro impact web/Vercel) |
| Niveau d'ambition | **Approche A — Fondation** : tokens + polices + logo + composant `Logo` + header brandé + splash vert. *Pas de refonte d'écrans.* |
| CTA WhatsApp | **Bouton flottant global** (catalogue) — réutilise le pattern web `wa.me/c/22377996858`. **Inclus dans ce lot.** |

Référence normative : `CLAUDE.md` (identité Lumoo verrouillée, contraintes Mali, accessibilité) et `apps/mobile/CLAUDE.md` (spécificités RN/Expo). En cas de doute, ces fichiers priment.

## 3. Périmètre

**Dans le périmètre**
- Module de tokens mobile (couleurs, espacements, rayons, typographie, ombres).
- Chargement des polices Spline Sans + Inter (embarquées).
- Extraction du logo Lumoo en asset propre + composant `<Logo>`.
- Branchement des tokens dans `tailwind.config.js` + `theme.ts`.
- Header brandé appliqué à l'écran `Produits` (`index.tsx`).
- Correction de la couleur du splash (bleu → vert).
- **Bouton flottant WhatsApp** (catalogue), réutilisant le numéro/pattern du web.

**Hors périmètre (lots ultérieurs)**
- Refonte visuelle des écrans, kit de composants complet (Card/ScreenHeader…).
- CTA WhatsApp **par produit** et **flux panier → commande** (le bouton flottant global, lui, **est inclus** dans ce lot).
- Régénération de l'icône d'app (app icon adaptatif) — option future.
- Partage des tokens dans `@lumoo/core`.

## 4. Architecture et livrables

### 4.1 Tokens — `apps/mobile/src/theme/tokens.ts`
Source unique de vérité, importée par `tailwind.config.js` et `constants/theme.ts`.

- **Couleurs**
  - `brand`: `DEFAULT #16a34a`, `dark #059669`, échelle `50…900` (vert).
  - `whatsapp #25D366` — CTA commande/contact (utilisé par le **bouton flottant WhatsApp** de ce lot).
  - `adminBlue` (`blue-600 #2563eb`) — espace admin uniquement.
  - `mali`: `green #14B53A`, `yellow #FCD116`, `red #CE1126` — usage ponctuel/culturel.
  - Neutres : `text #0F172A`, `muted #475569`, `bg #F8FAFC`, `surface #FFFFFF`, `border #E5E7EB`.
- **Espacements** : `2 / 4 / 8 / 16 / 24 / 32 / 64` (repris de `constants/theme.ts`).
- **Rayons** : `lg 16`, `xl 24`, `2xl 28`, `full 9999` (style « très arrondi »).
- **Typographie** : familles (cf. 4.2) + tailles (body **≥ 16px**, échelle titres).
- **Ombres** : ombres douces + ombre colorée verte pour les CTA.

> **Format** : les tokens sont écrits en **JS/CommonJS** (valeurs brutes) afin d'être à la fois `require()` par `tailwind.config.js` **et** `import` par le TS de l'app — un fichier `.ts` pur ne serait pas chargeable par la config Tailwind (Node).

### 4.2 Typographie — Spline Sans + Inter (embarquées)
- Dépendances : `@expo-google-fonts/spline-sans`, `@expo-google-fonts/inter`.
- Chargement dans `app/_layout.tsx` via `useFonts({ SplineSans_600SemiBold, SplineSans_700Bold, Inter_400Regular, Inter_600SemiBold })`.
- **Splash maintenu** (`expo-splash-screen` `preventAutoHideAsync` / `hideAsync`) jusqu'au chargement des polices — pas de FOUT ni de rendu avant fonts prêtes. Fallback : police système si échec.
- Exposition NativeWind : `fontFamily` `display` (Spline Sans) et `body` (Inter) → classes `font-display` / `font-body`.
- **Note RN** : une famille par graisse (RN ne synthétise pas le gras) → on déclare explicitement regular/semibold/bold.

### 4.3 Logo — extraction + composant
- Le logo web (`apps/web/public/logo lumoo.svg`) est un **PNG base64** (945×326) encapsulé en SVG. On **décode** ce base64 vers `apps/mobile/assets/images/logo-lumoo.png`.
- Composant **`apps/mobile/src/components/Logo.tsx`** : `<Logo size={...} />`, rendu via **`expo-image`** (`cachePolicy="memory-disk"`, dimensions réservées — contrainte data Mali), `accessibilityLabel="Lumoo"`.
- **Splash** (`app.json`) : `backgroundColor` `#208AEF` → vert `#16a34a` ; `image` = `logo-lumoo.png` affiché sur fond vert par le plugin `expo-splash-screen`.

### 4.4 Application (sans refonte d'écrans)
- `tailwind.config.js` : `theme.extend.colors` et `fontFamily` **construits à partir de `tokens.ts`** (remplace le `brand` codé en dur actuel, en le conservant).
- `constants/theme.ts` : aligné sur les tokens (plus de couleurs génériques en dur).
- Nouveau **`apps/mobile/src/components/BrandHeader.tsx`** (logo + titre, safe-area), appliqué à `app/index.tsx` : titres `font-display`, prix en vert, texte `font-body`, cartes arrondies.
- **Icônes** : installer `lucide-react-native` + `react-native-svg` ; icône panier (Lucide, **44×44**, `accessibilityLabel`) dans le header. Politique hybride `CLAUDE.md` : SVG pour les actions.

### 4.5 Bouton flottant WhatsApp
- Nouveau **`apps/mobile/src/components/WhatsAppButton.tsx`** : bouton flottant (bas-gauche, safe-area), `Pressable` → `Linking.openURL` vers le catalogue WhatsApp Business.
- Helper **`apps/mobile/src/lib/whatsapp.ts`** : numéro `22377996858` + `catalogUrl()` (`wa.me/c/<n>`) et `orderUrl(text)` (`wa.me/<n>?text=…`, prêt pour un usage futur). *(Le web code le numéro en dur à 2 endroits ; le centraliser ici — puis dans `@lumoo/core` — est une amélioration future.)*
- Style : fond `whatsapp #25D366`, `rounded-full`, ombre colorée, `active:scale-95`, **glyphe WhatsApp en SVG** (`react-native-svg`, même tracé que le web), label « Notre Boutique / WhatsApp Business », `accessibilityLabel`, touch ≥ 44px.
- Animations légères (`transform/opacity`), respect `prefers-reduced-motion`.

## 5. Conformité aux standards (`CLAUDE.md`)
- Identité **verrouillée** : vert émeraude, style très arrondi, typo grasse, micro-interactions `active:scale-95`. On **ignore** les couleurs/polices génériques du skill.
- Accessibilité : contraste **≥ 4.5:1**, body **≥ 16px**, touch targets **≥ 44px** avec feedback, `aria-label` sur icônes seules.
- Marché Mali : animations légères (`transform/opacity`), images **cachées** (`expo-image memory-disk`), espace réservé (zéro saut de contenu), interface **français**.
- Méthode : skill `ui-ux-pro-max` exécuté en amont (`python -X utf8 … --design-system` / `--stack react-native`) pour la rigueur UX et sa pre-delivery checklist.

## 6. Fichiers

**Nouveaux**
- `apps/mobile/src/theme/tokens.ts`
- `apps/mobile/src/components/Logo.tsx`
- `apps/mobile/src/components/BrandHeader.tsx`
- `apps/mobile/src/components/WhatsAppButton.tsx`
- `apps/mobile/src/lib/whatsapp.ts`
- `apps/mobile/assets/images/logo-lumoo.png`

**Modifiés**
- `apps/mobile/tailwind.config.js` (couleurs + fontFamily depuis les tokens)
- `apps/mobile/src/constants/theme.ts` (aligné sur les tokens)
- `apps/mobile/src/app/_layout.tsx` (`useFonts` + gestion splash)
- `apps/mobile/src/app/index.tsx` (BrandHeader + classes typo + vert)
- `apps/mobile/app.json` (splash vert)
- `apps/mobile/package.json` (`@expo-google-fonts/spline-sans`, `@expo-google-fonts/inter`, `lucide-react-native`, `react-native-svg`)

## 7. Vérification / tests
- `tsc` (typecheck) sans erreur ; bundle Expo OK (cache vidé).
- Reload device : logo en header, palette verte, titres Spline Sans / texte Inter, splash vert.
- Test léger : les tokens exportent les valeurs attendues (`brand.DEFAULT === '#16a34a'`) ; `<Logo>` se rend sans crash.
- Passage de la **pre-delivery checklist** `ui-ux-pro-max` (contraste, touch, transitions, focus, reduced-motion, responsive).

## 8. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Versions `@expo-google-fonts/*` non alignées SDK 54 → re-drift natif | Installer via `npx expo install` ; vérifier qu'aucune copie en double n'apparaît (cf. overrides existants) |
| `react-native-svg` (natif) absent d'Expo Go au bon niveau | Installer via `expo install` (version SDK 54) ; tester le rendu de l'icône au reload |
| Splash sans hide des polices → écran figé | `preventAutoHideAsync`/`hideAsync` encadrés ; timeout de secours + fallback police système |
| Logo raster (945×326) flou si agrandi | Affichage à taille raisonnable (header ~140px), `contentFit="contain"` ; vectorisation = option future |

## 9. Critères de succès
- Au lancement : splash **vert** avec logo ; aucune erreur de polices.
- Écran `Produits` : **header brandé** (logo + panier SVG), prix en vert, titres Spline Sans, texte Inter, cartes arrondies.
- Tokens réutilisables : une nouvelle vue peut consommer `brand`, `font-display`, etc. sans valeur en dur.
- Un **bouton flottant WhatsApp** ouvre le catalogue (`wa.me/c/22377996858`) via `Linking`.
- Conforme à la pre-delivery checklist et aux contraintes Mali (images cachées, FR, touch ≥ 44px).
