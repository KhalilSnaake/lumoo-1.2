# Checkout mobile (commande + livraison + paiement) — Design

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, monorepo (web Vite + mobile Expo)
**Branche :** `react-native-terrain`
**Statut :** Design validé, en attente de relecture avant plan

---

## 1. Contexte et objectif

Le mobile a un panier (`(tabs)/panier.tsx`) dont le bouton **« Commander »** est inactif. Le web (`apps/web/.../CartBuilder.tsx`) a un **tunnel de commande complet** : panier → livraison → paiement → confirmation, qui **crée une commande en base** (`createOrder`, visible par l'admin) puis propose **WhatsApp**.

**Objectif :** porter ce tunnel sur mobile, **fidèle au web**, en réutilisant la logique partagée (`@lumoo/core`). La « compose » étant déjà le panier mobile, le tunnel mobile démarre à **Livraison**.

## 2. Décisions validées (avec l'utilisateur)

| Décision | Choix |
|----------|-------|
| Ampleur | **Flux complet** : Livraison → Paiement → `createOrder` → Confirmation + WhatsApp |
| GPS | **Oui**, via `expo-location` (optionnel dans le formulaire) |
| Logos paiement | **Logos officiels répliqués** en SVG (Orange Money, Wave) |
| Modes de paiement | Orange Money, Wave, **Paiement à la livraison** (comme le web) |
| Villes | Les 8 du web : Bamako, Sikasso, Kayes, Ségou, Mopti, Gao, Tombouctou, Koulikoro |

Référence normative : `CLAUDE.md` + `apps/mobile/CLAUDE.md` (identité, accessibilité, contraintes Mali).

## 3. Périmètre

**Dans le périmètre**
- Écran checkout 3 étapes (Livraison / Paiement / Confirmation).
- Formulaire livraison (nom, téléphone +223, adresse, ville, GPS optionnel).
- Sélection paiement + numéro mobile money, avec logos SVG.
- Création de commande en base (`createOrder`).
- Confirmation : n° de commande + bouton « Confirmer par WhatsApp » (réutilise `lib/whatsapp`).
- Câblage du bouton « Commander » du panier.

**Hors périmètre**
- Moov Money (supporté par `core` mais pas dans ce lot — web ne l'expose pas).
- Upload de preuve de paiement (`paymentProofUrl` — champ existant, non utilisé ici).
- Suivi de livraison / notifications push.
- Notification admin à la création (le web la fait via `createNotification` ; ici la commande est créée et **visible** dans la liste, la notif admin = lot ultérieur).

## 4. Architecture

### 4.1 Écran et navigation
- Nouvel écran **`apps/mobile/src/app/checkout.tsx`**, enregistré comme `Stack.Screen name="checkout"` dans `_layout.tsx` (`headerShown: false` — header maison dans l'écran).
- Le bouton **« Commander »** de `panier.tsx` fait `router.push("/checkout")` (inactif si panier vide).
- État interne : `step: "livraison" | "paiement" | "confirmation"`.
- **Header maison** (dans l'écran) : bouton retour *step-aware* (paiement→livraison ; livraison→`router.back()` vers panier) + barre de progression légère (3 points) + titre par étape.

### 4.2 Données (réutilise `@lumoo/core`)
- `useCart()` : `items`, `totalPrice`, `totalItems`, `clearCart`.
- `useOrders()` : `createOrder(input: CreateOrderInput)`.
- `useAuth()` : `user` (pour `userId`).
- **`CreateOrderInput`** (déjà défini) : `{ userId?, items, customerName, customerPhone, address, city, gps_lat?, gps_lng?, paymentMethod, paymentPhone }`.

### 4.3 Étape Livraison
Champs (state local) : `name`, `phone`, `address`, `city`, `gps {lat?, lng?}`.
- **Nom complet** * — `TextInput`.
- **Téléphone** * — `<MaliPhoneInput>` (stocke `+223 XXXXXXXX`).
- **Adresse** * — `TextInput multiline`.
- **Ville** * — `<CityPicker>` (Pressable → `Modal` listant les 8 villes).
- **GPS** (optionnel) — `<LocationPicker>` (bouton « Partager ma position »).
- Bouton **« Continuer »** activé si `name && phone && address && city`.

### 4.4 Étape Paiement
Champs : `paymentMethod`, `paymentPhone`.
- 3 options (Pressable, sélection unique) : Orange Money / Wave / Livraison, avec **`<PaymentLogos>`** (SVG).
- Si méthode = mobile money (≠ livraison) → `<MaliPhoneInput>` « Numéro de paiement » *.
- Bouton **« Payer {total} »** / **« Confirmer la commande »** (si livraison), activé si `paymentMethod && (method === "livraison" || paymentPhone)`.
- Au clic → `createOrder({...})` ; en cas de succès → `step = "confirmation"`, mémorise `order.id`.

### 4.5 Étape Confirmation
- Visuel succès + **n° de commande** (`order.id`).
- Bouton **« Confirmer par WhatsApp »** → `openOrder(recap)` de `lib/whatsapp`, où `recap` =
  ```
  Bonjour Lumoo ! Commande n° {id}
  Articles :
  • {nom} × {qté}
  ...
  Total : {total} FCFA
  Livraison : {nom}, {ville} — {téléphone}
  ```
- Bouton **« Retour à la boutique »** → `clearCart()` + `router.replace("/(tabs)")`.

### 4.6 Composants nouveaux
- **`MaliPhoneInput.tsx`** : ligne avec drapeau Mali (3 bandes via tokens `mali.green/yellow/red`) + `+223` + `TextInput` (`keyboardType="phone-pad"`, max 8 chiffres, indicateur `n/8`). `value`/`onChange` stockent `+223 XXXXXXXX`.
- **`LocationPicker.tsx`** : `expo-location`. Bouton « Partager ma position » → `requestForegroundPermissionsAsync` + `getCurrentPositionAsync`. Affiche les coordonnées si obtenues ; message clair si permission refusée. État chargement.
- **`PaymentLogos.tsx`** : composants SVG `OrangeMoneyLogo`, `WaveLogo`, `CashLogo` (via `react-native-svg`).
- **`CityPicker.tsx`** : `Pressable` affichant la ville choisie (ou placeholder) → ouvre un `Modal` avec la liste des 8 villes.

## 5. Dépendances et config
- **`expo-location`** : `npx expo install expo-location`.
- **`app.json`** : ajouter le plugin `expo-location` avec un message de permission FR
  (`locationWhenInUsePermission`: « Lumoo utilise votre position pour préciser le lieu de livraison. »).
- `react-native-svg` : déjà présent (utilisé par les logos).

## 6. Fichiers

**Nouveaux**
- `apps/mobile/src/app/checkout.tsx`
- `apps/mobile/src/components/MaliPhoneInput.tsx`
- `apps/mobile/src/components/LocationPicker.tsx`
- `apps/mobile/src/components/PaymentLogos.tsx`
- `apps/mobile/src/components/CityPicker.tsx`

**Modifiés**
- `apps/mobile/src/app/(tabs)/panier.tsx` (« Commander » → `router.push("/checkout")`)
- `apps/mobile/src/app/_layout.tsx` (`Stack.Screen name="checkout"`, `headerShown: false`)
- `apps/mobile/app.json` (plugin + permission `expo-location`)
- `apps/mobile/package.json` (`expo-location`)

## 7. Gestion des erreurs
- Champs requis manquants → boutons désactivés (`opacity` réduite).
- Permission GPS refusée / erreur → message inline sous le bouton (pas de blocage : GPS optionnel).
- `createOrder` échoue → message d'erreur visible, on reste à l'étape Paiement (bouton réactivé).
- Panier vide → « Commander » inactif (sécurité même si l'écran est atteint).

## 8. Conformité (`CLAUDE.md`)
- Couleurs : vert marque pour les CTA de progression ; **WhatsApp `#25D366`** pour le bouton « Confirmer par WhatsApp ».
- Typo : `font-display` (titres/montants) + `font-body` (texte/labels).
- Accessibilité : touch ≥ 44px, `accessibilityLabel` sur icônes/boutons, labels de champs, contraste ≥ 4.5:1.
- Mali : FR, animations légères, images cachées si présentes.

## 9. Tests
- Helpers purs testables : formatage du téléphone (`+223 XXXXXXXX`), construction du **message WhatsApp** de récap → assertions Node.
- Reste : `tsc --noEmit` (0 erreur), **bundle one-shot** (`expo export`) qui réussit, checklist visuelle au reload (tunnel complet : panier → livraison → paiement → confirmation → WhatsApp).

## 10. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| `expo-location` non aligné SDK 54 / absent d'Expo Go | Installer via `npx expo install` ; tester le bouton GPS au reload |
| `Modal` ville mal rendu (z-index/safe-area) | `Modal` natif RN avec `transparent` + overlay ; tester |
| `createOrder` attend des champs/relations précises (RLS) | Réutiliser exactement `CreateOrderInput` ; le web prouve que ça marche |
| Logos officiels (marques tierces) | Reproduction simple à usage fonctionnel (sélection de paiement), cohérent avec le web |

## 11. Critères de succès
- Depuis le panier, « Commander » ouvre le tunnel.
- On saisit livraison (avec GPS optionnel), on choisit un paiement, et **une commande est créée en base** (visible dans `commandes` / l'admin).
- La confirmation affiche le n° et permet d'**envoyer le récap par WhatsApp**.
- « Retour à la boutique » vide le panier et revient aux onglets.
- Conforme à la pre-delivery checklist (touch, contraste, FR, polices).
