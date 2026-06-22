# Push Notifications (clients invités) — Implementation Plan

> ⚠️ **SUPERSEDED** par `2026-06-22-notifications-push-unifie.md` (architecture triggers Postgres, push + in-app pour tous). Conservé pour historique.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'envoyer une notification push à un client (invité ou connecté) au changement de statut de sa commande, même application fermée.

**Architecture:** Approche « B » (sécurisée/normalisée). Les tokens push vivent dans une table dédiée `device_tokens` **verrouillée** (deny-all côté client ; écriture via RPC `SECURITY DEFINER`, lecture réservée au `service_role`). La commande porte un `device_id` (non sensible) qui relie la commande à l'appareil. L'envoi se fait **côté serveur** via une **Edge Function Supabase** (`send-order-push`) qui authentifie l'appelant comme admin, lit le token avec le `service_role`, et appelle l'API Expo Push. Le mobile enregistre son token via `expo-notifications`.

**Tech Stack:** Expo SDK 54 (`expo-notifications`), React Native 0.81, Supabase (Postgres + RLS + Edge Functions Deno), `@lumoo/core` (couche service partagée), API Expo Push (`https://exp.host/--/api/v2/push/send`).

## Global Constraints

- Expo SDK **54** uniquement — docs `https://docs.expo.dev/versions/v54.0.0/`. Ne pas suivre une autre version.
- Le token push est une **capacité bearer** : ne JAMAIS l'exposer à une lecture client (anon/authenticated). Lecture réservée au `service_role` (Edge Function).
- Identité bundle : `ml.lumoo.app` (iOS + Android). EAS `projectId` = `fc31e4b2-89be-4aa9-84b0-866a6e8df670`, owner `pymalien`.
- Interface en **français**. Pas de couleurs génériques : vert marque `#16a34a`.
- Le push **ne fonctionne pas dans Expo Go** (surtout iOS) : tester sur un **dev build** EAS. Android nécessite FCM, iOS nécessite APNs (credentials EAS).
- Pas de runner de tests unitaires dans le repo aujourd'hui (pas de jest). Les « gates » de vérification de ce plan sont donc : **typecheck** (`tsc`/LSP), **test local de l'Edge Function** (`supabase functions serve` + `curl`), et **test manuel sur dev build**. Ne pas fabriquer de faux tests jest.
- SQL appliqué **manuellement** (fichiers `*.sql` à la racine + dashboard Supabase / MCP `apply_migration`). Pas de dossier `supabase/migrations` à ce jour ; on introduit `supabase/functions/` pour l'Edge Function.
- Respecter le refus de l'utilisateur (permission notifications) sans casser l'app.

---

## File Structure

**Créés :**
- `add_device_tokens.sql` (racine) — table `device_tokens`, RLS deny-all, RPC `register_device_token`.
- `add_device_id_to_orders.sql` (racine) — colonne `orders.device_id`.
- `supabase/functions/send-order-push/index.ts` — Edge Function d'envoi.
- `supabase/functions/send-order-push/deno.json` — config import map (optionnel mais propre).
- `apps/mobile/src/lib/device-id.ts` — génère/persiste un `device_id` stable (AsyncStorage).
- `apps/mobile/src/lib/push.ts` — permission + récupération token + enregistrement + handlers.

**Modifiés :**
- `packages/core/src/types/app.ts` — `deviceId?` sur `Order` et `CreateOrderInput`.
- `packages/core/src/services/api.ts` — insert `device_id` dans `apiCreateOrder` ; ajout `apiRegisterDeviceToken`, `apiSendOrderPush` ; déclenchement dans `apiUpdateOrderStatus`.
- `packages/core/src/index.ts` — export des nouvelles fonctions.
- `apps/mobile/package.json` — dépendance `expo-notifications`.
- `apps/mobile/app.json` — plugin `expo-notifications` (icône/couleur).
- `apps/mobile/src/app/_layout.tsx` — enregistrement au démarrage + listener de tap.
- `apps/mobile/src/app/checkout.tsx` — passe `deviceId` à `createOrder`.

---

## Task 1 : Table `device_tokens` + RLS verrouillée + RPC d'enregistrement

**Files:**
- Create: `add_device_tokens.sql`

**Interfaces:**
- Produces (SQL exposé à PostgREST) : RPC `register_device_token(p_token text, p_device_id text, p_platform text) returns void`.
- Produces (table) : `device_tokens(token text PK, device_id text, user_id text null, platform text, updated_at timestamptz)`.

- [ ] **Step 1: Écrire la migration SQL**

```sql
-- add_device_tokens.sql
-- Tokens push, isolés et verrouillés. Le token est une capacité "bearer" :
-- aucune lecture/écriture directe côté client. Lecture = service_role uniquement.

CREATE TABLE IF NOT EXISTS device_tokens (
  token       TEXT PRIMARY KEY,                 -- ExpoPushToken (unique par appareil/app)
  device_id   TEXT NOT NULL,                    -- identifiant d'appareil stable (généré côté app)
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,  -- rempli si connecté
  platform    TEXT,                             -- 'ios' | 'android'
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_device_id ON device_tokens(device_id, updated_at DESC);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
-- IMPORTANT : aucune policy SELECT/INSERT/UPDATE/DELETE pour anon/authenticated.
-- => RLS active sans policy = tout accès client refusé. Le service_role bypass la RLS.

-- Enregistrement contrôlé via fonction SECURITY DEFINER : le client (même invité/anon)
-- peut appeler cette RPC, mais ne touche jamais la table directement.
CREATE OR REPLACE FUNCTION register_device_token(
  p_token TEXT,
  p_device_id TEXT,
  p_platform TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 OR p_device_id IS NULL OR length(p_device_id) < 4 THEN
    RAISE EXCEPTION 'invalid token or device_id';
  END IF;

  INSERT INTO device_tokens (token, device_id, user_id, platform, updated_at)
  VALUES (p_token, p_device_id, auth.uid()::text, p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET device_id  = EXCLUDED.device_id,
        user_id    = EXCLUDED.user_id,
        platform   = EXCLUDED.platform,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION register_device_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT, TEXT, TEXT) TO anon, authenticated;
```

- [ ] **Step 2: Appliquer la migration**

Via le dashboard Supabase (SQL editor) ou MCP `apply_migration` (name: `add_device_tokens`). Copier-coller le contenu du fichier.

- [ ] **Step 3: Vérifier le verrouillage (gate sécurité)**

Dans le SQL editor, en tant que rôle `anon` (ou via un client anon), vérifier que la lecture est refusée et l'enregistrement passe par la RPC :

```sql
-- Doit renvoyer 0 ligne / erreur de policy pour un client anon :
SELECT * FROM device_tokens;          -- attendu : aucune ligne visible côté client
-- La RPC doit réussir :
SELECT register_device_token('ExponentPushToken[TEST_xxxxxxxx]', 'dev-test-0001', 'android');
SELECT count(*) FROM device_tokens;   -- (via service_role) attendu : 1
```
Expected : insertion OK via RPC, `SELECT` direct client vide/refusé.

- [ ] **Step 4: Commit**

```bash
git add add_device_tokens.sql
git commit -m "feat(push): table device_tokens verrouillee + RPC register_device_token"
```

---

## Task 2 : Colonne `orders.device_id` (lien commande → appareil)

**Files:**
- Create: `add_device_id_to_orders.sql`

**Interfaces:**
- Produces : colonne `orders.device_id text` (nullable, non sensible).
- Contrainte : `track_order` ne doit PAS exposer `device_id` (rien à changer si la fonction renvoie un JSON de colonnes choisies — à vérifier).

- [ ] **Step 1: Écrire la migration**

```sql
-- add_device_id_to_orders.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_device_id ON orders(device_id);
```

- [ ] **Step 2: Vérifier que `track_order` ne fuit pas `device_id`**

Lire la définition de `track_order` (suivi invité) dans le SQL existant. Le `device_id` n'est pas sensible, mais par principe de moindre exposition, s'assurer qu'il n'est pas ajouté au retour. Si `track_order` fait `SELECT *`, restreindre aux colonnes déjà renvoyées (statut, dates, etc.) — sinon ne rien changer.

Run (dashboard) : inspecter `pg_get_functiondef('track_order'::regproc)`.
Expected : le retour liste des colonnes explicites sans `device_id` (ou `row_to_json` d'un sous-ensemble). Corriger seulement si `SELECT *`.

- [ ] **Step 3: Appliquer + commit**

```bash
git add add_device_id_to_orders.sql
git commit -m "feat(push): colonne orders.device_id (lien commande->appareil)"
```

---

## Task 3 : Couche core — types, insert device_id, register, send, déclencheur

**Files:**
- Modify: `packages/core/src/types/app.ts:43-66` (Order), `:79-90` (CreateOrderInput)
- Modify: `packages/core/src/services/api.ts` (apiCreateOrder, apiUpdateOrderStatus, + 2 nouvelles fns)
- Modify: `packages/core/src/index.ts` (exports)

**Interfaces:**
- Consumes : `getSupabase()` (déjà importé dans api.ts), RPC `register_device_token` (Task 1), Edge Function `send-order-push` (Task 4).
- Produces :
  - `Order.deviceId?: string`, `CreateOrderInput.deviceId?: string`
  - `apiRegisterDeviceToken(token: string, deviceId: string, platform: string): Promise<boolean>`
  - `apiSendOrderPush(orderId: string, status: OrderStatus): Promise<void>` (fire-and-forget)
  - `apiUpdateOrderStatus` déclenche `apiSendOrderPush` après succès.

- [ ] **Step 1: Ajouter `deviceId` aux types**

Dans `packages/core/src/types/app.ts`, ajouter à `interface Order` (après `userId?: string;`) :
```ts
  deviceId?: string;
```
et à `interface CreateOrderInput` (après `userId?: string;`) :
```ts
  deviceId?: string;
```

- [ ] **Step 2: Insérer `device_id` à la création de commande**

Dans `apiCreateOrder` (`api.ts`), dans l'objet `.insert({...})` de la table `orders`, ajouter après `user_id: input.userId,` :
```ts
    device_id: input.deviceId,
```

- [ ] **Step 3: Ajouter `apiRegisterDeviceToken`**

À la fin de `api.ts` :
```ts
// ─── Push : enregistrement du token de l'appareil ───
// Passe par la RPC SECURITY DEFINER (la table device_tokens est verrouillée côté client).
export async function apiRegisterDeviceToken(
  token: string,
  deviceId: string,
  platform: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_device_id: deviceId,
    p_platform: platform,
  });
  return !error;
}
```

- [ ] **Step 4: Ajouter `apiSendOrderPush` + déclencher dans `apiUpdateOrderStatus`**

À la fin de `api.ts` :
```ts
// ─── Push : déclenchement de l'envoi (admin → Edge Function) ───
// Fire-and-forget : ne bloque jamais la mise à jour de statut. L'Edge Function
// authentifie l'appelant (admin) et lit le token avec le service_role.
export async function apiSendOrderPush(orderId: string, status: OrderStatus): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.functions.invoke('send-order-push', { body: { orderId, status } });
  } catch {
    // Le push est best-effort : on n'échoue jamais le flux métier dessus.
  }
}
```
Puis dans `apiUpdateOrderStatus`, juste avant `return rowToOrder(data, items || []);` :
```ts
  void apiSendOrderPush(orderId, status);
```

- [ ] **Step 5: Exporter depuis l'index core**

Dans `packages/core/src/index.ts`, ajouter aux exports des services (vérifier le point d'export existant de `api`) :
```ts
export { apiRegisterDeviceToken, apiSendOrderPush } from './services/api';
```
(Si `api` est déjà ré-exporté en `export * from './services/api'`, cette étape est inutile — vérifier avant d'ajouter.)

- [ ] **Step 6: Typecheck (gate)**

Run: `npx tsc -p packages/core --noEmit` (ou diagnostics LSP sur `api.ts` + `app.ts`)
Expected: 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types/app.ts packages/core/src/services/api.ts packages/core/src/index.ts
git commit -m "feat(push): core - deviceId commande, register & send order push"
```

---

## Task 4 : Edge Function `send-order-push`

**Files:**
- Create: `supabase/functions/send-order-push/index.ts`
- Create: `supabase/functions/send-order-push/deno.json`

**Interfaces:**
- Consumes : table `orders` (device_id, customer_name, status), table `device_tokens` (token), table `users` (role). Secrets : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_ACCESS_TOKEN` (optionnel mais recommandé).
- Produces : POST `{ orderId, status }` → envoie un push Expo. Authentifie l'appelant comme `role='admin'`.

- [ ] **Step 1: Écrire la config Deno**

```json
// supabase/functions/send-order-push/deno.json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Écrire la fonction**

```ts
// supabase/functions/send-order-push/index.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

// Libellés FR par statut. Les statuts non listés ne déclenchent pas de push.
const MESSAGES: Record<string, { title: string; body: (name: string) => string }> = {
  confirmee:     { title: "Commande confirmée ✅", body: () => "Votre commande est confirmée. Nous la préparons." },
  en_preparation:{ title: "En préparation 👨‍🍳", body: () => "Votre commande est en cours de préparation." },
  en_livraison:  { title: "En route 🛵",          body: () => "Votre commande est en route vers vous !" },
  livree:        { title: "Livrée 🎉",            body: () => "Votre commande a été livrée. Merci !" },
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // 1) Authentifier l'appelant et vérifier qu'il est admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json(401, { error: "missing token" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes?.user) return json(401, { error: "invalid token" });

  const { data: profile } = await admin
    .from("users").select("role").eq("id", userRes.user.id).single();
  if (profile?.role !== "admin") return json(403, { error: "forbidden" });

  // 2) Lire la commande + statut.
  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !status) return json(400, { error: "orderId and status required" });

  const msg = MESSAGES[status];
  if (!msg) return json(200, { skipped: true, reason: "status non notifiable" });

  const { data: order } = await admin
    .from("orders").select("device_id, customer_name").eq("id", orderId).single();
  if (!order?.device_id) return json(200, { skipped: true, reason: "pas de device_id" });

  // 3) Token le plus récent pour cet appareil.
  const { data: tok } = await admin
    .from("device_tokens").select("token")
    .eq("device_id", order.device_id)
    .order("updated_at", { ascending: false }).limit(1).single();
  if (!tok?.token) return json(200, { skipped: true, reason: "pas de token" });

  // 4) Envoi via Expo Push.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (EXPO_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;

  const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: tok.token,
      title: msg.title,
      body: msg.body(order.customer_name ?? ""),
      sound: "default",
      data: { orderId, type: "status_change" },
    }),
  });
  const pushJson = await pushRes.json();

  // 5) Nettoyage des tokens morts.
  const err = pushJson?.data?.details?.error ?? pushJson?.errors?.[0]?.code;
  if (err === "DeviceNotRegistered") {
    await admin.from("device_tokens").delete().eq("token", tok.token);
  }

  return json(200, { sent: true, expo: pushJson });
});
```

- [ ] **Step 3: Déployer + secrets**

```bash
# Depuis la racine du repo (nécessite supabase CLI connecté au projet)
supabase functions deploy send-order-push
supabase secrets set EXPO_ACCESS_TOKEN=<token-expo>   # depuis expo.dev > Access tokens
# SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement par la plateforme.
```
(Alternative sans CLI : MCP `deploy_edge_function`.)

- [ ] **Step 4: Test local (gate)**

```bash
supabase functions serve send-order-push --no-verify-jwt
# Dans un autre terminal, simuler un appel (remplacer ORDER_ID par une commande ayant un device_id + token) :
curl -i -X POST http://localhost:54321/functions/v1/send-order-push \
  -H "Authorization: Bearer <JWT_ADMIN>" -H "Content-Type: application/json" \
  -d '{"orderId":"LUM-XXXX","status":"en_livraison"}'
```
Expected : `200 { "sent": true, ... }` et réception du push sur l'appareil de test ; `403` si le JWT n'est pas admin ; `200 { skipped }` si pas de token.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-order-push/
git commit -m "feat(push): edge function send-order-push (auth admin + expo push)"
```

---

## Task 5 : Mobile — installer `expo-notifications` + config app.json

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json:35-55` (plugins)

**Interfaces:**
- Produces : module `expo-notifications` disponible ; plugin configuré.

- [ ] **Step 1: Installer la dépendance (depuis la racine du monorepo)**

```bash
npx expo install expo-notifications --workspace @lumoo/mobile
```
⚠️ Ne PAS faire `npm install <pkg>` dans `apps/mobile` (casse le `.bin` du workspace). Utiliser `expo install` qui aligne la version sur SDK 54, puis si besoin réparer avec un `npm install` à la racine.

- [ ] **Step 2: Ajouter le plugin dans `app.json`**

Dans `expo.plugins`, ajouter (après le bloc `expo-location`) :
```json
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#16a34a"
        }
      ]
```

- [ ] **Step 3: Vérifier (gate)**

Run: `npx expo config --type public` (dans `apps/mobile`) — vérifier que `expo-notifications` apparaît dans les plugins sans erreur.
Expected: config résolue, plugin listé.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json package-lock.json
git commit -m "feat(push): installer expo-notifications + plugin app.json"
```

---

## Task 6 : Mobile — device_id, enregistrement du token, wiring

**Files:**
- Create: `apps/mobile/src/lib/device-id.ts`
- Create: `apps/mobile/src/lib/push.ts`
- Modify: `apps/mobile/src/app/_layout.tsx` (appel au démarrage)
- Modify: `apps/mobile/src/app/checkout.tsx:115-126` (passer deviceId)

**Interfaces:**
- Consumes : `apiRegisterDeviceToken` (core, Task 3), `AsyncStorage`, `expo-notifications`, `expo-device`, `expo-constants`.
- Produces :
  - `getDeviceId(): Promise<string>`
  - `registerForPushNotifications(): Promise<void>`

- [ ] **Step 1: `device-id.ts` — identifiant d'appareil stable**

```ts
// apps/mobile/src/lib/device-id.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lumoo.device_id";

// UUID v4 simple (sans dépendance ; suffisant pour un identifiant d'appareil non-cryptographique)
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(KEY, id);
  }
  return id;
}
```

- [ ] **Step 2: `push.ts` — permission + token + enregistrement + handlers**

```ts
// apps/mobile/src/lib/push.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiRegisterDeviceToken } from "@lumoo/core";
import { getDeviceId } from "./device-id";

// Afficher les notifications même app au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  // Le push réel nécessite un vrai appareil (pas le simulateur iOS).
  if (!Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Commandes Lumoo",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#16a34a",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return; // refus utilisateur : ne pas casser l'app

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;
  if (!projectId) return;

  const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
  const deviceId = await getDeviceId();
  await apiRegisterDeviceToken(tokenResp.data, deviceId, Platform.OS);
}
```

- [ ] **Step 3: Appeler au démarrage dans `_layout.tsx`**

Dans `apps/mobile/src/app/_layout.tsx`, importer puis appeler dans un `useEffect` du composant racine (après le montage des providers) :
```ts
import { useEffect } from "react";
import { registerForPushNotifications } from "@/lib/push";
// ...
  useEffect(() => {
    void registerForPushNotifications();
  }, []);
```
(Placer ce `useEffect` dans le composant qui rend le `Stack`/providers ; ne pas dupliquer s'il existe déjà un effet racine — y ajouter l'appel.)

- [ ] **Step 4: Passer `deviceId` à la commande (checkout)**

Dans `apps/mobile/src/app/checkout.tsx`, importer :
```ts
import { getDeviceId } from "@/lib/device-id";
```
Puis dans `submit`, juste avant `const order = await createOrder({`, récupérer l'id et l'ajouter à l'objet :
```ts
      const deviceId = await getDeviceId();
      const order = await createOrder({
        userId: user?.id,
        deviceId,
        items,
        // ...reste inchangé
```

- [ ] **Step 5: Typecheck (gate)**

Run: diagnostics LSP sur `push.ts`, `device-id.ts`, `_layout.tsx`, `checkout.tsx`
Expected: 0 erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/device-id.ts apps/mobile/src/lib/push.ts apps/mobile/src/app/_layout.tsx apps/mobile/src/app/checkout.tsx
git commit -m "feat(push): mobile - device_id, enregistrement token, wiring checkout"
```

---

## Task 7 : Mobile — tap sur la notification → suivi de commande

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes : `expo-notifications` response listener, `expo-router`.
- Produces : au tap d'une notification avec `data.orderId`, navigation vers le suivi.

- [ ] **Step 1: Ajouter le listener de réponse**

Dans `_layout.tsx`, dans le même composant racine :
```ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
// ...
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = response.notification.request.content.data?.orderId as string | undefined;
      if (orderId) router.push("/suivi");
    });
    return () => sub.remove();
  }, []);
```
(Note : on route vers `/suivi` — écran de suivi par n° + code, valable invité. Si une route `/commande/[id]` directe est souhaitée, l'utiliser à la place quand l'utilisateur est connecté.)

- [ ] **Step 2: Typecheck + commit**

Run: diagnostics LSP sur `_layout.tsx` — 0 erreur.
```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(push): mobile - tap notification ouvre le suivi de commande"
```

---

## Task 8 : Build, credentials & test bout-en-bout

**Files:** (aucun fichier de code ; configuration EAS / Expo / Supabase)

- [ ] **Step 1: Credentials push**
  - Android : configurer FCM (clé serveur / service account) via `eas credentials` ou le dashboard Expo. Sans FCM, aucun push Android livré.
  - iOS : APNs key via `eas credentials`.
  - Expo : créer un **Access Token** (expo.dev → settings) et activer l'« Enhanced Security for Push » pour le projet, puis le poser en secret de l'Edge Function (`EXPO_ACCESS_TOKEN`, Task 4 Step 3).

- [ ] **Step 2: Dev build**

```bash
cd apps/mobile
eas build --profile development --platform android
```
Installer l'APK sur un **appareil physique**.

- [ ] **Step 3: Test bout-en-bout (gate finale)**
  1. Ouvrir l'app (invité, non connecté) → accepter la permission notifications.
  2. Passer une commande (checkout) → vérifier en base que `orders.device_id` est rempli et qu'une ligne `device_tokens` existe pour ce `device_id`.
  3. Depuis l'admin web, passer la commande à `en_livraison`.
  4. **Attendu** : le téléphone reçoit le push « En route 🛵 », app fermée comprise. Le tap ouvre le suivi.
  5. Désinstaller l'app, re-changer le statut → l'Edge Function reçoit `DeviceNotRegistered` et supprime le token (vérifier la ligne disparue).

- [ ] **Step 4: Commit (docs/notes éventuelles)**

```bash
git add -A
git commit -m "docs(push): notes credentials + procedure de test bout-en-bout"
```

---

## Durcissement recommandé (hors périmètre immédiat)

- **Déclencheur par Database Webhook** : plutôt que l'invoke côté admin, brancher un **webhook Supabase** sur `UPDATE orders` (changement de `status`) qui appelle l'Edge Function. Avantage : le push part quel que soit l'émetteur (admin, `confirm_delivery` du livreur, SQL direct) et ne dépend pas du code client. Nécessite d'ajouter au handler un mode d'auth « secret webhook » en plus du JWT admin.
- **Notification « livrée »** via le chemin `confirm_delivery` (livreur) en plus des changements de statut admin.
- **Multi-appareils** : si un compte se connecte sur plusieurs téléphones, envoyer à tous les tokens du `user_id` (et plus seulement au dernier `device_id` de la commande).

## Self-Review

- **Couverture spec** : verrou « app fermée » → push Expo (Task 4/6) ✅ ; verrou « compte invité » → token par appareil + RPC verrouillée, `user_id` nullable (Task 1) ✅ ; sécurité (token jamais exposé) → RLS deny-all + lecture service_role + auth admin (Task 1/4) ✅ ; lien commande↔appareil → `orders.device_id` (Task 2/3/6) ✅ ; déclenchement au changement de statut (Task 3) ✅ ; refus de permission géré (Task 6) ✅.
- **Placeholders** : aucun — code SQL/TS/Deno complet fourni. Les seules « confirmations » (def de `track_order`, point d'export de `index.ts`, emplacement de l'effet racine) sont des vérifications, pas des trous.
- **Cohérence des types** : `apiRegisterDeviceToken(token, deviceId, platform)` et `apiSendOrderPush(orderId, status)` utilisés tels quels en Task 6/3 ; `deviceId` ajouté à `Order`/`CreateOrderInput` et consommé dans `apiCreateOrder` + `checkout.tsx`.
