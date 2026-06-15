# Plan d'implémentation — Identité visuelle mobile (fondation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation d'identité visuelle Lumoo sur le mobile (tokens, polices embarquées, logo, header brandé, splash vert, bouton WhatsApp flottant) sans refondre les écrans.

**Architecture:** Un module de tokens **CommonJS** (consommé par `tailwind.config.js` ET le TS de l'app) pilote couleurs/typo/espacements. Les polices Spline Sans + Inter sont embarquées via `@expo-google-fonts` et chargées dans `_layout.tsx` (splash maintenu jusqu'au chargement). Le logo web (PNG base64) est extrait en asset puis exposé via un composant `<Logo>`. Un `<WhatsAppButton>` flottant réutilise le numéro/pattern du web.

**Tech Stack:** Expo SDK 54, Expo Router, NativeWind v4 (Tailwind), expo-image, expo-font, expo-splash-screen, react-native-svg, @expo-google-fonts/{spline-sans,inter}.

**Spec de référence :** `docs/superpowers/specs/2026-06-15-mobile-design-identity.md`. Standards : `CLAUDE.md` (racine) + `apps/mobile/CLAUDE.md`.

> **Note tests :** `apps/mobile` n'a **pas** de runner de tests (pas de jest). Ajouter jest est hors périmètre. On vérifie donc par : `tsc` (typecheck), un **bundle one-shot** (`expo export`) qui doit réussir, des assertions Node pour les helpers purs, et une checklist visuelle au reload. Quand un « test » est listé, c'est l'un de ces moyens.

> **Pré-requis déjà en place :** `metro.config.js` contient déjà le `resolveRequest` qui corrige la résolution de `lucide-react-native` (package-exports désactivés pour Lucide uniquement). `react-native-svg` et `lucide-react-native` sont déjà déclarés dans `apps/mobile/package.json`.

> **Important — règle projet :** avant de coder/retoucher un **écran**, lancer la recherche dédiée du skill (`python -X utf8 .claude/skills/ui-ux-pro-max/scripts/search.py "<sujet>" --stack react-native`) et appliquer la pre-delivery checklist. (Mémoire : « Run ui-ux search per screen ».)

---

## Structure des fichiers

**Créés**
- `apps/mobile/src/theme/tokens.js` — source unique (CommonJS) : couleurs, espacements, rayons, typo, ombres.
- `apps/mobile/src/theme/tokens.d.ts` — types pour l'import TS.
- `apps/mobile/assets/images/logo-lumoo.png` — logo extrait du web.
- `apps/mobile/src/components/Logo.tsx` — composant logo (expo-image).
- `apps/mobile/src/components/BrandHeader.tsx` — header brandé (logo + titre).
- `apps/mobile/src/lib/whatsapp.ts` — numéro + builders d'URL + ouverture.
- `apps/mobile/src/components/WhatsAppButton.tsx` — bouton flottant.

**Modifiés**
- `apps/mobile/package.json` — déps polices.
- `apps/mobile/tailwind.config.js` — couleurs + fontFamily depuis les tokens.
- `apps/mobile/src/constants/theme.ts` — aligné sur les tokens.
- `apps/mobile/src/app/_layout.tsx` — `useFonts` + gestion splash + montage `<WhatsAppButton>`.
- `apps/mobile/app.json` — splash vert + logo.
- L'écran d'accueil (liste produits) — applique header + classes typo (fichier réel : `src/app/(tabs)/index.tsx` s'il existe, sinon `src/app/index.tsx`).

---

## Task 1 : Installer les dépendances de polices

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1 : Installer les polices via expo (versions alignées SDK 54)**

Run (depuis `apps/mobile`) :
```bash
npx expo install @expo-google-fonts/spline-sans @expo-google-fonts/inter expo-font expo-splash-screen
```
`expo-splash-screen` et `expo-font` sont peut-être déjà là — `expo install` les laisse alors inchangés.

- [ ] **Step 2 : Vérifier qu'aucune copie en double de React/natif n'est réapparue**

Run (depuis la racine) :
```bash
for p in react react-native-safe-area-context react-native-screens; do printf "%s (imbriqué mobile): " "$p"; test -d "apps/mobile/node_modules/$p" && echo "PRÉSENT — à dédupliquer !" || echo "absent ✓"; done
```
Expected : les trois en **absent ✓** (les `overrides` racine tiennent la déduplication). Si l'un est « PRÉSENT », relancer `npm install` à la racine.

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/package.json package-lock.json
git commit -m "chore(mobile): ajouter @expo-google-fonts (spline-sans, inter)"
```

---

## Task 2 : Module de tokens + branchement Tailwind

**Files:**
- Create: `apps/mobile/src/theme/tokens.js`
- Create: `apps/mobile/src/theme/tokens.d.ts`
- Modify: `apps/mobile/tailwind.config.js`

- [ ] **Step 1 : Écrire les tokens (CommonJS)**

`apps/mobile/src/theme/tokens.js` :
```js
// Source unique de l'identité Lumoo. CommonJS pour être require() par
// tailwind.config.js ET import par le TS de l'app (types via tokens.d.ts).
const colors = {
  brand: {
    DEFAULT: "#16a34a",
    dark: "#059669",
    50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac",
    400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
    800: "#166534", 900: "#14532d",
  },
  whatsapp: "#25D366",   // réservé CTA commande/contact
  adminBlue: "#2563eb",  // espace admin uniquement
  mali: { green: "#14B53A", yellow: "#FCD116", red: "#CE1126" },
  text: "#0F172A",
  muted: "#475569",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E5E7EB",
};

const spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 };
const radii = { lg: 16, xl: 24, "2xl": 28, full: 9999 };

const fonts = {
  display: "SplineSans_700Bold",
  displaySemibold: "SplineSans_600SemiBold",
  body: "Inter_400Regular",
  bodySemibold: "Inter_600SemiBold",
};

const fontSizes = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30 };

module.exports = { colors, spacing, radii, fonts, fontSizes };
```

- [ ] **Step 2 : Types pour l'import TS**

`apps/mobile/src/theme/tokens.d.ts` :
```ts
export declare const colors: {
  brand: { DEFAULT: string; dark: string } & Record<string, string>;
  whatsapp: string; adminBlue: string;
  mali: { green: string; yellow: string; red: string };
  text: string; muted: string; bg: string; surface: string; border: string;
};
export declare const spacing: Record<string, number>;
export declare const radii: Record<string, number>;
export declare const fonts: { display: string; displaySemibold: string; body: string; bodySemibold: string };
export declare const fontSizes: Record<string, number>;
```

- [ ] **Step 3 : Brancher les tokens dans Tailwind**

`apps/mobile/tailwind.config.js` — remplacer le bloc `theme` actuel (qui a `brand` en dur) par une lecture des tokens. Le fichier devient :
```js
/** @type {import('tailwindcss').Config} */
const { colors, fonts, radii } = require("./src/theme/tokens");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        whatsapp: colors.whatsapp,
        "admin-blue": colors.adminBlue,
        mali: colors.mali,
        ink: colors.text,
        muted: colors.muted,
        surface: colors.surface,
        line: colors.border,
      },
      fontFamily: {
        display: [fonts.display],
        "display-semibold": [fonts.displaySemibold],
        body: [fonts.body],
        "body-semibold": [fonts.bodySemibold],
      },
      borderRadius: { "2xl": String(radii["2xl"]) },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4 : Vérifier que la config Tailwind charge sans erreur**

Run (depuis `apps/mobile`) :
```bash
node -e "const c=require('./tailwind.config.js'); console.log('brand:', c.theme.extend.colors.brand.DEFAULT, '| font-display:', c.theme.extend.fontFamily.display[0]);"
```
Expected : `brand: #16a34a | font-display: SplineSans_700Bold`

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/theme/tokens.js apps/mobile/src/theme/tokens.d.ts apps/mobile/tailwind.config.js
git commit -m "feat(mobile): tokens d'identité Lumoo + branchement Tailwind"
```

---

## Task 3 : Aligner constants/theme.ts sur les tokens

**Files:**
- Modify: `apps/mobile/src/constants/theme.ts`

- [ ] **Step 1 : Réexporter les couleurs de marque depuis les tokens**

En tête de `apps/mobile/src/constants/theme.ts`, après les imports existants, ajouter :
```ts
import { colors as brandColors } from "@/theme/tokens";
```
Puis enrichir l'objet `Colors` exporté pour exposer la marque sans valeur en dur (garder les clés existantes `light`/`dark`) :
```ts
export const Brand = {
  primary: brandColors.brand.DEFAULT,
  primaryDark: brandColors.brand.dark,
  whatsapp: brandColors.whatsapp,
} as const;
```
*(Ne pas casser `Colors`, `Fonts`, `Spacing` existants — on ajoute `Brand`, on ne supprime rien.)*

- [ ] **Step 2 : Typecheck**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : aucune nouvelle erreur liée à `theme.ts` / `tokens`.

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/src/constants/theme.ts
git commit -m "refactor(mobile): exposer la marque via les tokens dans theme.ts"
```

---

## Task 4 : Embarquer Spline Sans + Inter + gérer le splash

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1 : Charger les polices et tenir le splash**

Réécrire `apps/mobile/src/app/_layout.tsx` pour charger les polices avant de rendre l'app (garder `ProductProvider`, `Stack`, `initCore` existants) :
```tsx
import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, SplineSans_600SemiBold, SplineSans_700Bold } from "@expo-google-fonts/spline-sans";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { initCore, ProductProvider } from "@lumoo/core";
import { mobileStorage } from "../lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // splash reste affiché
  }

  return (
    <ProductProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProductProvider>
  );
}
```
*(Note : `headerShown: false` — on remplacera l'en-tête natif par notre `BrandHeader` dans l'écran. Si tu veux garder l'en-tête natif, mets le titre Lumoo et adapte.)*

- [ ] **Step 2 : Vérifier le bundle (résolution des polices)**

Run (depuis `apps/mobile`) :
```bash
EXPO_OFFLINE=1 npx expo export --platform android --output-dir "$TEMP/lumoo-verify" 2>&1 | tail -5
```
Expected : `Exported: …` sans `Unable to resolve` (les `@expo-google-fonts/*` se résolvent). Puis : `rm -rf "$TEMP/lumoo-verify"`.

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): charger Spline Sans + Inter, maintenir le splash"
```

---

## Task 5 : Extraire le logo + composant Logo

**Files:**
- Create: `apps/mobile/assets/images/logo-lumoo.png`
- Create: `apps/mobile/src/components/Logo.tsx`

- [ ] **Step 1 : Extraire le PNG base64 du SVG web**

Run (depuis la racine) :
```bash
node -e "const fs=require('fs'); const svg=fs.readFileSync('apps/web/public/logo lumoo.svg','utf8'); const m=svg.match(/base64,([A-Za-z0-9+/=]+)/); if(!m){throw new Error('base64 introuvable')}; fs.writeFileSync('apps/mobile/assets/images/logo-lumoo.png', Buffer.from(m[1],'base64')); console.log('logo écrit:', fs.statSync('apps/mobile/assets/images/logo-lumoo.png').size, 'octets');"
```
Expected : `logo écrit: ~XXXXXX octets` (PNG 945×326).

- [ ] **Step 2 : Vérifier que c'est un vrai PNG**

Run (depuis la racine) :
```bash
node -e "const b=require('fs').readFileSync('apps/mobile/assets/images/logo-lumoo.png'); console.log(b.slice(0,8).toString('hex')==='89504e470d0a1a0a' ? 'PNG OK' : 'PAS UN PNG');"
```
Expected : `PNG OK`

- [ ] **Step 3 : Composant Logo**

`apps/mobile/src/components/Logo.tsx` :
```tsx
import { Image } from "expo-image";

const LOGO = require("../../assets/images/logo-lumoo.png");
const RATIO = 326 / 945; // hauteur / largeur du PNG source

export function Logo({ width = 120 }: { width?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width, height: Math.round(width * RATIO) }}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityLabel="Lumoo"
    />
  );
}
```

- [ ] **Step 4 : Typecheck**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : aucune erreur sur `Logo.tsx`.

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/assets/images/logo-lumoo.png apps/mobile/src/components/Logo.tsx
git commit -m "feat(mobile): extraire le logo Lumoo + composant Logo"
```

---

## Task 6 : Header brandé

**Files:**
- Create: `apps/mobile/src/components/BrandHeader.tsx`

- [ ] **Step 1 : Composant BrandHeader**

`apps/mobile/src/components/BrandHeader.tsx` :
```tsx
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "./Logo";

export function BrandHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="bg-surface px-4 pb-3 border-b border-line"
    >
      <View className="flex-row items-center justify-between">
        <Logo width={110} />
      </View>
      {title ? (
        <Text className="mt-2 font-display text-2xl text-ink">{title}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/src/components/BrandHeader.tsx
git commit -m "feat(mobile): header brandé (logo + titre)"
```

---

## Task 7 : Bouton flottant WhatsApp

**Files:**
- Create: `apps/mobile/src/lib/whatsapp.ts`
- Create: `apps/mobile/src/components/WhatsAppButton.tsx`

- [ ] **Step 1 : Helper (builders d'URL purs + ouverture)**

`apps/mobile/src/lib/whatsapp.ts` :
```ts
import { Linking } from "react-native";

export const WHATSAPP_PHONE = "22377996858";

// Purs (testables) :
export const catalogUrl = () => `https://wa.me/c/${WHATSAPP_PHONE}`;
export const orderUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;

// Effets :
export const openCatalog = () => Linking.openURL(catalogUrl());
export const openOrder = (text: string) => Linking.openURL(orderUrl(text));
```

- [ ] **Step 2 : Test du builder d'URL (assertion Node, pas de RN)**

Run (depuis la racine) :
```bash
node -e "const PHONE='22377996858'; const orderUrl=(t)=>'https://wa.me/'+PHONE+'?text='+encodeURIComponent(t); const u=orderUrl('Riz 5kg'); console.assert(u==='https://wa.me/22377996858?text=Riz%205kg', 'KO: '+u); console.log('OK', u);"
```
Expected : `OK https://wa.me/22377996858?text=Riz%205kg`
*(On valide la logique d'encodage qui sera dans `whatsapp.ts`. Le fichier lui-même importe `react-native`, donc non exécutable en Node nu.)*

- [ ] **Step 3 : Bouton flottant**

`apps/mobile/src/components/WhatsAppButton.tsx` :
```tsx
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { openCatalog } from "../lib/whatsapp";

function WhatsAppGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        fill="#ffffff"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </Svg>
  );
}

export function WhatsAppButton() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ position: "absolute", left: 16, bottom: insets.bottom + 16 }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={openCatalog}
        accessibilityRole="button"
        accessibilityLabel="Boutique WhatsApp Business"
        className="flex-row items-center gap-2 rounded-full bg-whatsapp pl-4 pr-5 py-3 active:opacity-90"
        style={{ minHeight: 48, shadowColor: "#059669", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <WhatsAppGlyph />
        <View>
          <Text className="font-display-semibold text-xs text-white">Notre Boutique</Text>
          <Text className="font-body text-[10px] text-white/80">WhatsApp Business</Text>
        </View>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4 : Typecheck**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/lib/whatsapp.ts apps/mobile/src/components/WhatsAppButton.tsx
git commit -m "feat(mobile): bouton flottant WhatsApp (catalogue)"
```

---

## Task 8 : Splash vert + logo

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1 : Splash sur fond vert avec le logo**

Dans `apps/mobile/app.json`, plugin `expo-splash-screen` : remplacer `backgroundColor` bleu par le vert et pointer l'image sur le logo extrait :
```json
[
  "expo-splash-screen",
  {
    "backgroundColor": "#16a34a",
    "image": "./assets/images/logo-lumoo.png",
    "imageWidth": 200,
    "android": {
      "image": "./assets/images/logo-lumoo.png",
      "imageWidth": 200
    }
  }
]
```
*(L'ancien `splash-icon.png` n'est plus référencé ; on garde le logo. `imageWidth` 200 = logo lisible centré.)*

- [ ] **Step 2 : Valider le JSON**

Run (depuis `apps/mobile`) : `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"`
Expected : `app.json OK`

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat(mobile): splash vert avec logo Lumoo"
```

---

## Task 9 : Appliquer l'identité à l'écran d'accueil + monter le bouton WhatsApp

**Files:**
- Modify: l'écran liste produits — `apps/mobile/src/app/(tabs)/index.tsx` s'il existe, sinon `apps/mobile/src/app/index.tsx`
- Modify (au choix) : `apps/mobile/src/app/_layout.tsx` (montage global du bouton) OU l'écran (montage local)

> **Avant de coder cet écran**, lancer : `python -X utf8 .claude/skills/ui-ux-pro-max/scripts/search.py "product list card e-commerce" --stack react-native` et appliquer la checklist.

- [ ] **Step 1 : Localiser l'écran d'accueil**

Run (depuis `apps/mobile`) : `ls src/app/(tabs)/index.tsx 2>/dev/null && echo "→ (tabs)/index.tsx" || echo "→ src/app/index.tsx"`
Utiliser le chemin retourné dans les steps suivants (noté `<HOME>`).

- [ ] **Step 2 : Brancher le header brandé + classes typo + vert**

Dans `<HOME>` : importer et afficher `<BrandHeader title="Produits (…)" />` en haut de la liste, mettre les titres en `font-display`, le texte courant en `font-body`, les prix en `text-brand`. Exemple de structure (adapter aux composants existants `product-card.tsx`) :
```tsx
import { BrandHeader } from "@/components/BrandHeader";
// …
return (
  <View className="flex-1 bg-bg">
    <BrandHeader title={`Produits (${products.length})`} />
    <FlatList
      data={products}
      keyExtractor={(p) => String(p.id)}
      numColumns={2}
      contentContainerClassName="px-2 pb-24 pt-2"
      renderItem={({ item }) => <ProductCard product={item} />}
      ListEmptyComponent={<Text className="mt-8 text-center font-body text-muted">Aucun produit.</Text>}
    />
  </View>
);
```
*(Le `pb-24` réserve la place du bouton flottant. Si `ProductCard` existe déjà, ne pas le réécrire — juste s'assurer qu'il utilise `font-body`/`text-brand`.)*

- [ ] **Step 3 : Monter le bouton WhatsApp globalement**

Dans `apps/mobile/src/app/_layout.tsx`, envelopper la navigation pour superposer le bouton sur toutes les pages :
```tsx
import { View } from "react-native";
import { WhatsAppButton } from "@/components/WhatsAppButton";
// …dans le return, remplacer <Stack/> par :
return (
  <ProductProvider>
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <WhatsAppButton />
    </View>
  </ProductProvider>
);
```

- [ ] **Step 4 : Typecheck**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/app
git commit -m "feat(mobile): header brandé + typo Lumoo + bouton WhatsApp global"
```

---

## Task 10 : Lucide — confirmer le fix + noter l'optimisation taille

**Files:**
- Verify: `apps/mobile/metro.config.js` (déjà patché)
- Doc: ce plan (note d'optimisation)

- [ ] **Step 1 : Confirmer que le `resolveRequest` Lucide est présent**

Run (depuis `apps/mobile`) : `grep -n "lucide-react-native" metro.config.js`
Expected : le bloc `resolveRequest` désactivant les package exports pour Lucide est présent. (Sinon, le ré-appliquer — cf. spec § Lucide.)

- [ ] **Step 2 : Note d'optimisation (à faire dans un lot ultérieur, PAS maintenant)**

L'import barrel `import { Plus } from "lucide-react-native"` embarque ~1500 icônes (bundle ~6.3 MB). Optimisation future pour le Mali : remplacer par des imports ciblés (sous-chemins) ou `babel-plugin-transform-imports`, pour ne garder que les icônes utilisées. **Hors périmètre de ce lot** — juste documenté.

---

## Task 11 : Vérification finale

- [ ] **Step 1 : Typecheck global**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 2 : Bundle one-shot (tout l'app, polices + logo + lucide + svg)**

Run (depuis `apps/mobile`) :
```bash
EXPO_OFFLINE=1 npx expo export --platform android --output-dir "$TEMP/lumoo-final" 2>&1 | tail -6
```
Expected : `Android Bundled …` puis `Exported: …`, **aucune** ligne `Unable to resolve`. Puis : `rm -rf "$TEMP/lumoo-final"`.

- [ ] **Step 3 : Checklist visuelle au reload (device, Metro lancé côté utilisateur)**

Vérifier sur le téléphone :
- [ ] Splash **vert** avec logo au lancement.
- [ ] **Header brandé** (logo Lumoo) en haut de la liste.
- [ ] Titres en **Spline Sans**, texte en **Inter**, prix en **vert**.
- [ ] **Bouton flottant WhatsApp** en bas à gauche → ouvre `wa.me/c/22377996858`.
- [ ] Cibles tactiles ≥ 44px, pas de saut de contenu (images réservées).

- [ ] **Step 4 : Commit éventuel de bilan** (si ajustements visuels)

```bash
git add -A
git commit -m "polish(mobile): ajustements identité visuelle après revue device"
```

---

## Couverture du spec (self-review)

| Exigence spec | Tâche |
|---|---|
| Tokens (couleurs/espacements/rayons/typo) | Task 2 |
| Format JS consommable par tailwind | Task 2 (tokens.js + .d.ts) |
| theme.ts aligné | Task 3 |
| Polices Spline Sans + Inter embarquées + splash gate | Task 4 |
| Logo extrait + composant `<Logo>` | Task 5 |
| Header brandé | Task 6 |
| Bouton flottant WhatsApp + helper | Task 7 |
| Splash vert + logo | Task 8 |
| Application écran (typo/vert/header) + montage WhatsApp | Task 9 |
| Lucide (déjà corrigé) + note taille | Task 10 |
| Conformité (touch 44px, contraste, FR, images cachées) | Tasks 6/7/9 + Task 11 checklist |
| Vérification (tsc + bundle + visuel) | Task 11 |
