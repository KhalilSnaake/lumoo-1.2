# Plan d'implémentation — Checkout mobile (commande + livraison + paiement)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter le tunnel de commande du web sur mobile : depuis le panier, un écran checkout en 3 étapes (Livraison → Paiement → Confirmation) qui crée la commande en base (`createOrder`) puis propose WhatsApp.

**Architecture:** Un écran `checkout.tsx` avec état interne 3 étapes, poussé depuis le panier. Il réutilise toute la logique de `@lumoo/core` (`useCart`, `useOrders.createOrder`, `useAuth`) et 4 composants nouveaux (MaliPhoneInput, CityPicker, LocationPicker, PaymentLogos). GPS via `expo-location`.

**Tech Stack:** Expo SDK 54, Expo Router, NativeWind, react-native-svg, expo-location, `@lumoo/core`.

**Spec :** `docs/superpowers/specs/2026-06-15-mobile-checkout.md`. Standards : `CLAUDE.md` + `apps/mobile/CLAUDE.md`.

> **Tests :** pas de jest dans `apps/mobile`. Vérif = `tsc --noEmit`, bundle one-shot (`expo export`), assertions Node pour la logique pure, checklist visuelle. (Comme les lots précédents.)

> **Important :** `font-display`, `font-body`, `font-body-semibold`, `font-display-semibold`, `bg-brand`, `bg-whatsapp`, `bg-mali-green/yellow/red`, `text-ink`, `text-muted` sont **déjà** définis dans `tailwind.config.js`. `lib/whatsapp.ts` exporte déjà `openOrder(text)`. `react-native-svg` est déjà installé.

---

## Structure des fichiers

**Créés**
- `apps/mobile/src/components/MaliPhoneInput.tsx` — saisie tél +223 (8 chiffres).
- `apps/mobile/src/components/CityPicker.tsx` — sélecteur de ville (modal).
- `apps/mobile/src/components/LocationPicker.tsx` — GPS via expo-location.
- `apps/mobile/src/components/PaymentLogos.tsx` — logos Orange/Wave/espèces (SVG).
- `apps/mobile/src/app/checkout.tsx` — écran tunnel 3 étapes.

**Modifiés**
- `apps/mobile/src/app/(tabs)/panier.tsx` — bouton « Commander » → `router.push("/checkout")`.
- `apps/mobile/src/app/_layout.tsx` — `Stack.Screen name="checkout"`.
- `apps/mobile/app.json` — plugin + permission `expo-location`.
- `apps/mobile/package.json` — `expo-location`.

---

## Task 1 : Installer expo-location + permission

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json`

- [ ] **Step 1 : Installer la dépendance**

Run (depuis `apps/mobile`) : `npx expo install expo-location`
Expected : `expo-location` ajouté à `package.json` (version SDK 54).

- [ ] **Step 2 : Déclarer le plugin + le message de permission FR dans `app.json`**

Dans `apps/mobile/app.json`, ajouter dans `expo.plugins` (à côté de `expo-router` / `expo-splash-screen`) l'entrée :
```json
[
  "expo-location",
  {
    "locationWhenInUsePermission": "Lumoo utilise votre position pour préciser le lieu de livraison."
  }
]
```

- [ ] **Step 3 : Valider le JSON**

Run (depuis `apps/mobile`) : `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"`
Expected : `app.json OK`

- [ ] **Step 4 : Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json package-lock.json
git commit -m "chore(mobile): expo-location + permission localisation (checkout)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : MaliPhoneInput

**Files:**
- Create: `apps/mobile/src/components/MaliPhoneInput.tsx`

- [ ] **Step 1 : Composant**

Créer `apps/mobile/src/components/MaliPhoneInput.tsx` avec EXACTEMENT :
```tsx
import { View, Text, TextInput } from "react-native";

export function MaliPhoneInput({
  value,
  onChange,
  label,
  placeholder = "77 99 68 58",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const digits = value.replace("+223 ", "").replace(/\s/g, "").slice(0, 8);
  const handle = (t: string) => {
    const d = t.replace(/\D/g, "").slice(0, 8);
    onChange(d ? `+223 ${d}` : "");
  };
  return (
    <View>
      {label ? (
        <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">{label}</Text>
      ) : null}
      <View className="min-h-12 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-3">
        <View className="h-4 w-6 flex-row overflow-hidden rounded-sm">
          <View className="flex-1 bg-mali-green" />
          <View className="flex-1 bg-mali-yellow" />
          <View className="flex-1 bg-mali-red" />
        </View>
        <Text className="ml-2 mr-2 border-r border-gray-200 pr-2 font-display text-sm text-muted">+223</Text>
        <TextInput
          value={digits}
          onChangeText={handle}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          maxLength={8}
          accessibilityLabel={label ?? "Téléphone"}
          className="flex-1 py-3 font-body text-gray-900"
        />
        <Text className="ml-2 font-body text-[10px] text-gray-300">{digits.length}/8</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2 : Tester la logique de formatage (assertion Node)**

Run (depuis la racine) :
```bash
node -e "const f=(t)=>{const d=String(t).replace(/\D/g,'').slice(0,8);return d?('+223 '+d):''}; console.assert(f('77 99 68 58')==='+223 77996858','KO1'); console.assert(f('')==='', 'KO2'); console.assert(f('770000009999')==='+223 77000000','KO3'); console.log('OK', f('77996858'));"
```
Expected : `OK +223 77996858`

- [ ] **Step 3 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/components/MaliPhoneInput.tsx
git commit -m "feat(mobile): MaliPhoneInput (+223, 8 chiffres)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : CityPicker

**Files:**
- Create: `apps/mobile/src/components/CityPicker.tsx`

- [ ] **Step 1 : Composant**

Créer `apps/mobile/src/components/CityPicker.tsx` avec EXACTEMENT :
```tsx
import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";

export const CITIES = [
  "Bamako", "Sikasso", "Kayes", "Ségou", "Mopti", "Gao", "Tombouctou", "Koulikoro",
] as const;

export function CityPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choisir la ville de livraison"
        className="min-h-12 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4"
      >
        <Text className={`font-body ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value || "Sélectionner une ville"}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable className="rounded-t-3xl bg-white pb-8 pt-2">
            <View className="mx-auto my-2 h-1 w-10 rounded-full bg-gray-200" />
            <Text className="px-5 py-2 font-display text-lg text-ink">Choisir la ville</Text>
            <FlatList
              data={CITIES as readonly string[]}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  className="min-h-12 flex-row items-center justify-between px-5 active:bg-gray-50"
                >
                  <Text className="font-body text-gray-800">{item}</Text>
                  {value === item ? <Check size={18} color="#16a34a" /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/components/CityPicker.tsx
git commit -m "feat(mobile): CityPicker (modal, 8 villes)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : LocationPicker (GPS)

**Files:**
- Create: `apps/mobile/src/components/LocationPicker.tsx`

- [ ] **Step 1 : Composant**

Créer `apps/mobile/src/components/LocationPicker.tsx` avec EXACTEMENT :
```tsx
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MapPin } from "lucide-react-native";
import * as Location from "expo-location";

export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = lat != null && lng != null;

  const getLocation = async () => {
    setError(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Autorise l'accès à la localisation pour partager ta position.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setError("Impossible de récupérer la position. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Pressable
        onPress={getLocation}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Partager ma position GPS"
        className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl border px-4 active:opacity-80 ${
          has ? "border-brand bg-green-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#16a34a" />
        ) : (
          <MapPin size={18} color={has ? "#16a34a" : "#6B7280"} />
        )}
        <Text className={`font-body-semibold ${has ? "text-brand" : "text-gray-600"}`}>
          {has ? "Position partagée ✓" : "Partager ma position GPS"}
        </Text>
      </Pressable>
      {has ? (
        <Text className="mt-1 text-center font-body text-[10px] text-gray-400">
          {lat!.toFixed(4)}, {lng!.toFixed(4)}
        </Text>
      ) : null}
      {error ? (
        <Text className="mt-1 text-center font-body text-xs text-red-600">{error}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur (nécessite que Task 1 ait installé `expo-location`).
```bash
git add apps/mobile/src/components/LocationPicker.tsx
git commit -m "feat(mobile): LocationPicker (GPS via expo-location)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : PaymentLogos (port des logos web)

**Files:**
- Create: `apps/mobile/src/components/PaymentLogos.tsx`
- Référence (lecture) : `apps/web/src/components/PaymentLogos.tsx`

- [ ] **Step 1 : Lire le composant web et le porter en react-native-svg**

Lire `apps/web/src/components/PaymentLogos.tsx`. Il exporte `OrangeMoneyLogo`, `WaveLogo`, `CashLogo` en SVG web. Créer `apps/mobile/src/components/PaymentLogos.tsx` qui exporte les **mêmes 3 composants** en **react-native-svg**, avec ces règles de conversion :
- `import Svg, { Path, Rect, Circle, G, ... } from "react-native-svg";`
- `<svg ...>` → `<Svg width={36} height={36} viewBox="0 0 ...">` (taille fixe 36×36, garder le `viewBox` d'origine).
- `<path d="..." fill="..."/>` → `<Path d="..." fill="..."/>` ; idem `rect`→`Rect`, `circle`→`Circle`, `g`→`G`.
- Attributs kebab-case → camelCase (`fill-rule`→`fillRule`, `stroke-width`→`strokeWidth`, `stroke-linecap`→`strokeLinecap`).
- Pas de `className` sur les SVG natifs — utiliser les props (`width`/`height`/`fill`).
- Chaque composant : `export function OrangeMoneyLogo() { return (<Svg ...>...</Svg>); }` (idem Wave, Cash).

Si un logo web utilise une `<img>`/URL plutôt qu'un vrai SVG, le remplacer par un carré arrondi de la couleur de marque avec l'initiale (ex. Orange → carré orange `#FF7900`, Wave → carré bleu `#1DC8F2`) à la même taille 36×36.

- [ ] **Step 2 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/components/PaymentLogos.tsx
git commit -m "feat(mobile): logos paiement (Orange/Wave/espèces) en SVG" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 : Écran checkout (3 étapes)

**Files:**
- Create: `apps/mobile/src/app/checkout.tsx`

- [ ] **Step 1 : Vérifier l'export de `PaymentMethod` par core**

Run (depuis la racine) :
```bash
node -e "console.log(require('fs').readFileSync('packages/core/src/index.ts','utf8').includes('PaymentMethod') ? 'exporté' : 'À VÉRIFIER')"
```
Si « À VÉRIFIER », ouvrir `packages/core/src/index.ts` et confirmer que `PaymentMethod` (et `CreateOrderInput`) sont ré-exportés ; sinon importer le type depuis le chemin réel. *(Le web fait `import type { PaymentMethod } from '@lumoo/core'`, donc c'est exporté.)*

- [ ] **Step 2 : Tester le message WhatsApp (assertion Node)**

Run (depuis la racine) :
```bash
node -e "const items=[{product:{name:'Riz 5kg'},quantity:2}]; const id='CMD-1'; const total='10 000 FCFA'; const name='Awa'; const city='Bamako'; const phone='+223 77996858'; const lines=items.map(it=>'• '+it.product.name+' × '+it.quantity).join('\n'); const msg='Bonjour Lumoo ! Commande n° '+id+'\n\nArticles :\n'+lines+'\n\nTotal : '+total+'\nLivraison : '+name+', '+city+' — '+phone; console.assert(msg.includes('Riz 5kg × 2')&&msg.includes('CMD-1')&&msg.includes('Bamako'),'KO'); console.log('OK message');"
```
Expected : `OK message`

- [ ] **Step 3 : Écran**

Créer `apps/mobile/src/app/checkout.tsx` avec EXACTEMENT :
```tsx
import { useState, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCart, useOrders, useAuth, type PaymentMethod } from "@lumoo/core";
import { MaliPhoneInput } from "@/components/MaliPhoneInput";
import { CityPicker } from "@/components/CityPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { OrangeMoneyLogo, WaveLogo, CashLogo } from "@/components/PaymentLogos";
import { openOrder } from "@/lib/whatsapp";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

type Step = "livraison" | "paiement" | "confirmation";

const PAYMENTS: { id: PaymentMethod; name: string; desc: string; logo: ReactNode }[] = [
  { id: "orange_money", name: "Orange Money", desc: "Payez avec Orange Money", logo: <OrangeMoneyLogo /> },
  { id: "wave", name: "Wave", desc: "Payez avec Wave", logo: <WaveLogo /> },
  { id: "livraison", name: "Paiement à la livraison", desc: "Payez en espèces à la réception", logo: <CashLogo /> },
];

const STEP_ORDER: Step[] = ["livraison", "paiement", "confirmation"];
const TITLES: Record<Step, string> = { livraison: "Livraison", paiement: "Paiement", confirmation: "Confirmation" };

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalPrice, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("livraison");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [gps, setGps] = useState<{ lat?: number; lng?: number }>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = !!(name && phone && address && city);
  const canPay = !!paymentMethod && (paymentMethod === "livraison" || !!paymentPhone);

  const goBack = () => {
    if (step === "paiement") setStep("livraison");
    else if (step === "livraison") router.back();
  };

  const submit = async () => {
    if (!paymentMethod) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({
        userId: user?.id,
        items,
        customerName: name,
        customerPhone: phone,
        address,
        city,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        paymentMethod,
        paymentPhone,
      });
      setOrderId(order.id);
      setStep("confirmation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendWhatsApp = () => {
    const lines = items.map((it) => `• ${it.product.name} × ${it.quantity}`).join("\n");
    openOrder(
      `Bonjour Lumoo ! Commande n° ${orderId}\n\nArticles :\n${lines}\n\nTotal : ${formatFCFA(totalPrice)}\nLivraison : ${name}, ${city} — ${phone}`,
    );
  };

  const finish = () => {
    clearCart();
    router.replace("/(tabs)");
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-gray-100 bg-white px-3 py-3">
        {step !== "confirmation" ? (
          <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="Retour" className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <ChevronLeft size={22} color="#374151" />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
        <Text className="ml-1 font-display text-lg text-ink">{TITLES[step]}</Text>
        <View className="ml-auto flex-row gap-1.5">
          {STEP_ORDER.map((s, i) => (
            <View key={s} className={`h-1.5 w-6 rounded-full ${STEP_ORDER.indexOf(step) >= i ? "bg-brand" : "bg-gray-200"}`} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
        {step === "livraison" ? (
          <View className="gap-4">
            <View className="flex-row items-center justify-between rounded-2xl border border-green-100 bg-green-50 p-4">
              <Text className="font-body-semibold text-green-800">Total panier</Text>
              <Text className="font-display text-lg text-brand">{formatFCFA(totalPrice)}</Text>
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Nom complet *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Ex : Aïssata Traoré" placeholderTextColor="#9CA3AF" accessibilityLabel="Nom complet" className="min-h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900" />
            </View>
            <MaliPhoneInput value={phone} onChange={setPhone} label="Téléphone *" />
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Adresse de livraison *</Text>
              <TextInput value={address} onChangeText={setAddress} placeholder="Ex : Badalabougou, près de la pharmacie…" placeholderTextColor="#9CA3AF" accessibilityLabel="Adresse de livraison" multiline style={{ textAlignVertical: "top" }} className="min-h-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900" />
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Ville *</Text>
              <CityPicker value={city} onChange={setCity} />
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Localisation (GPS) — optionnel</Text>
              <LocationPicker lat={gps.lat} lng={gps.lng} onChange={(la, ln) => setGps({ lat: la, lng: ln })} />
            </View>
            <Pressable onPress={() => setStep("paiement")} disabled={!canProceed} accessibilityRole="button" className={`mt-2 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${!canProceed ? "opacity-40" : ""}`}>
              <Text className="font-display-semibold text-white">Continuer vers le paiement</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "paiement" ? (
          <View className="gap-3">
            <Text className="text-center font-display text-lg text-ink">Mode de paiement</Text>
            {PAYMENTS.map((m) => (
              <Pressable key={m.id} onPress={() => setPaymentMethod(m.id)} accessibilityRole="button" accessibilityState={{ selected: paymentMethod === m.id }} className={`flex-row items-center gap-3 rounded-2xl border-2 bg-white p-4 ${paymentMethod === m.id ? "border-brand" : "border-gray-100"}`}>
                {m.logo}
                <View className="flex-1">
                  <Text className="font-display text-gray-800">{m.name}</Text>
                  <Text className="font-body text-[11px] text-gray-400">{m.desc}</Text>
                </View>
              </Pressable>
            ))}
            {paymentMethod && paymentMethod !== "livraison" ? (
              <MaliPhoneInput value={paymentPhone} onChange={setPaymentPhone} label="Numéro de paiement *" />
            ) : null}
            {error ? <Text className="text-center font-body text-sm text-red-600">{error}</Text> : null}
            <Pressable onPress={submit} disabled={!canPay || submitting} accessibilityRole="button" className={`mt-2 h-12 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${!canPay || submitting ? "opacity-50" : ""}`}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-display-semibold text-white">
                  {paymentMethod === "livraison" ? "Confirmer la commande" : `Payer ${formatFCFA(totalPrice)}`}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {step === "confirmation" ? (
          <View className="items-center gap-5 pt-8">
            <Text className="text-6xl">🎉</Text>
            <Text className="font-display text-2xl text-ink">Commande réussie !</Text>
            <View className="w-full items-center rounded-3xl border border-green-100 bg-green-50 p-5">
              <Text className="font-body text-[11px] uppercase tracking-widest text-green-700">Numéro de commande</Text>
              <Text className="mt-1 font-display text-xl text-green-800">{orderId}</Text>
            </View>
            <Pressable onPress={sendWhatsApp} accessibilityRole="button" accessibilityLabel="Confirmer par WhatsApp" className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-whatsapp active:opacity-90">
              <Text className="font-display-semibold text-white">Confirmer par WhatsApp</Text>
            </Pressable>
            <Pressable onPress={finish} accessibilityRole="button" className="h-12 w-full items-center justify-center rounded-2xl bg-gray-100 active:opacity-80">
              <Text className="font-body-semibold text-gray-600">Retour à la boutique</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur. *(Si `PaymentMethod` n'est pas exporté par `@lumoo/core`, corriger l'import selon le chemin réel — cf. Step 1.)*
```bash
git add apps/mobile/src/app/checkout.tsx
git commit -m "feat(mobile): écran checkout (livraison/paiement/confirmation + WhatsApp)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 : Câbler le panier + enregistrer la route

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/panier.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1 : Câbler « Commander » → checkout**

Dans `apps/mobile/src/app/(tabs)/panier.tsx` :
1. S'assurer que `router` est importé : ajouter `import { router } from "expo-router";` (s'il n'y est pas déjà).
2. Sur le `<Pressable>` du bouton « Commander » (le bloc résumé/total en bas), ajouter `onPress={() => router.push("/checkout")}`.

*(Ne pas modifier le reste de l'écran. Si le bouton « Commander » a déjà un `onPress`, le remplacer par celui-ci.)*

- [ ] **Step 2 : Enregistrer la route checkout**

Dans `apps/mobile/src/app/_layout.tsx`, à l'intérieur du `<Stack ...>` (à côté des `<Stack.Screen name="(tabs)" />` et `name="commandes"`), ajouter :
```tsx
<Stack.Screen name="checkout" options={{ headerShown: false }} />
```

- [ ] **Step 3 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/app/(tabs)/panier.tsx apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): ouvrir le checkout depuis le panier + route" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 : Vérification finale

- [ ] **Step 1 : Typecheck global**

Run (depuis `apps/mobile`) : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 2 : Bundle one-shot (tout l'app, checkout + expo-location + svg)**

Run (depuis `apps/mobile`) :
```bash
EXPO_OFFLINE=1 npx expo export --platform android --output-dir "$TEMP/lumoo-checkout" 2>&1 | tail -6
```
Expected : `Android Bundled …` puis `Exported: …`, **aucune** ligne `Unable to resolve`. Puis : `rm -rf "$TEMP/lumoo-checkout"`.

- [ ] **Step 3 : Checklist visuelle au reload (device)**
- [ ] Panier non vide → « Commander » ouvre l'écran checkout (étape Livraison).
- [ ] Formulaire : nom, tél (+223, 8 chiffres), adresse, ville (modal), GPS (« Partager ma position » demande la permission).
- [ ] « Continuer » désactivé tant que nom+tél+adresse+ville pas remplis.
- [ ] Paiement : 3 options avec logos ; mobile money → champ numéro ; bouton « Payer/Confirmer ».
- [ ] Validation → **commande créée** (visible dans l'onglet `commandes`).
- [ ] Confirmation : n° de commande + « Confirmer par WhatsApp » (ouvre WhatsApp avec le récap) + « Retour à la boutique » (panier vidé).

---

## Couverture du spec (self-review)

| Exigence spec | Tâche |
|---|---|
| expo-location + permission | Task 1 |
| MaliPhoneInput | Task 2 |
| CityPicker (8 villes, modal) | Task 3 |
| LocationPicker (GPS) | Task 4 |
| Logos paiement SVG | Task 5 |
| Écran 3 étapes + createOrder + WhatsApp | Task 6 |
| Câblage panier + route | Task 7 |
| Validation, erreurs, conformité | Tasks 6/7 + checklist Task 8 |
| Vérification (tsc + bundle + visuel) | Task 8 |
