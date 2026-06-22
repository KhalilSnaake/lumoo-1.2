# Notifications push + in-app pour tous (architecture triggers Postgres) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Ce plan **remplace** `2026-06-22-push-notifications-invite.md` et `2026-06-22-notifications-enrichissement.md`.

**Goal:** Notifier tout le monde (client connecté **ou** invité, admin, livreur) aux étapes clés, **immédiatement** et sur **deux canaux** : in-app (connectés) + push (tous, app fermée incluse), avec garde-fous anti-spam.

**Architecture:** **Tout est déclenché par des triggers Postgres.** Sur `INSERT/UPDATE orders` et `INSERT contact_messages`, un trigger appelle un helper SQL `enqueue_notification()` qui (1) applique les préférences, (2) insère la notif in-app si on connaît le `user_id`, (3) appelle — via `pg_net`, côté serveur — une Edge Function générique `send-push` qui résout les tokens (par `user_id` et/ou `device_id`) et envoie via Expo Push. Aucune confiance accordée au client : l'invité ne peut ni choisir le destinataire ni le contenu.

**Tech Stack:** Supabase (Postgres, RLS, `pg_net`, Edge Functions Deno), API Expo Push, Expo SDK 54 (`expo-notifications`), `@lumoo/core`, admin web.

## Global Constraints

- Expo SDK **54** uniquement (`https://docs.expo.dev/versions/v54.0.0/`). Bundle `ml.lumoo.app`, EAS `projectId` `fc31e4b2-89be-4aa9-84b0-866a6e8df670`, owner `pymalien`.
- **Token push = capacité bearer** : `device_tokens` jamais lisible côté client (RLS deny-all ; lecture service_role only ; écriture via RPC `SECURITY DEFINER`).
- **Invité** : pas de `user_id` → **pas d'in-app**, **push seulement** (via `orders.device_id`). Ne jamais insérer une notif in-app sans `user_id`.
- **Garde-fou** : opt-out par catégorie uniquement, géré **dans `enqueue_notification`**. Pas de quiet hours ni de plafond hebdo (volontairement hors périmètre).
- **Push hors Expo Go** (surtout iOS) : tester sur **dev build** EAS. Android = FCM, iOS = APNs (credentials EAS).
- **Server-to-server** : `pg_net` appelle `send-push` avec un **secret partagé** (`x-webhook-secret`), pas un JWT. La fonction est déployée `--no-verify-jwt` et gardée par ce secret.
- Pas de tests jest dans le repo → gates = typecheck (LSP/tsc), test SQL (insert/update déclenche le trigger), `curl` sur la fonction, test manuel dev build.
- Interface **français**, vert `#16a34a`. SQL appliqué manuellement (dashboard / MCP `apply_migration`).
- **Anti-doublon** : les triggers remplacent les `createNotification` applicatifs existants → les **supprimer** (Task 8) pour ne pas notifier deux fois.

---

## File Structure

**Créés (SQL, racine) :** `add_device_tokens.sql`, `add_device_id_to_orders.sql`, `add_notification_types.sql`, `add_notification_preferences.sql`, `enable_pgnet_and_settings.sql`, `notif_enqueue_and_triggers.sql`
**Créés (Edge Function) :** `supabase/functions/send-push/index.ts`, `supabase/functions/send-push/deno.json`
**Créés (mobile) :** `apps/mobile/src/lib/device-id.ts`, `apps/mobile/src/lib/push.ts`, `apps/mobile/src/components/notification-preferences.tsx`
**Modifiés (core) :** `packages/core/src/types/app.ts` (deviceId), `packages/core/src/services/api.ts` (insert device_id), `packages/core/src/services/notifications.ts` (RPC register), `packages/core/src/types/notifications.ts`, `packages/core/src/index.ts`
**Modifiés (mobile) :** `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/checkout.tsx`, `apps/mobile/src/components/account-profile.tsx`
**Modifiés (web, anti-doublon) :** `apps/web/src/components/CartBuilder.tsx`, `apps/web/src/components/AdminPanel.tsx`

---

## PHASE 1 — Fondations DB

### Task 1 : `device_tokens` + RPC d'enregistrement

**Files:** Create `add_device_tokens.sql`
**Interfaces:** Produces RPC `register_device_token(p_token, p_device_id, p_platform)`; table `device_tokens(token PK, device_id, user_id null, platform, updated_at)`.

- [ ] **Step 1: Écrire la migration**
```sql
-- add_device_tokens.sql
CREATE TABLE IF NOT EXISTS device_tokens (
  token       TEXT PRIMARY KEY,
  device_id   TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  platform    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_device_id ON device_tokens(device_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
-- RLS active sans policy => tout accès client refusé. service_role bypass.

CREATE OR REPLACE FUNCTION register_device_token(p_token TEXT, p_device_id TEXT, p_platform TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 OR p_device_id IS NULL OR length(p_device_id) < 4 THEN
    RAISE EXCEPTION 'invalid token or device_id';
  END IF;
  INSERT INTO device_tokens (token, device_id, user_id, platform, updated_at)
  VALUES (p_token, p_device_id, auth.uid()::text, p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET device_id = EXCLUDED.device_id, user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform, updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION register_device_token(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT,TEXT,TEXT) TO anon, authenticated;
```
- [ ] **Step 2: Appliquer + vérifier (gate sécurité)** — en client `anon` : `SELECT * FROM device_tokens` doit être vide/refusé ; `SELECT register_device_token('ExponentPushToken[TESTxxxx]','dev-0001','android')` doit réussir.
- [ ] **Step 3: Commit** — `git add add_device_tokens.sql && git commit -m "feat(push): device_tokens verrouillee + RPC register"`

### Task 2 : `orders.device_id`

**Files:** Create `add_device_id_to_orders.sql`
- [ ] **Step 1:**
```sql
-- add_device_id_to_orders.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_device_id ON orders(device_id);
```
- [ ] **Step 2:** Vérifier que `track_order` (suivi invité) ne renvoie pas `device_id` (corriger seulement s'il fait `SELECT *`).
- [ ] **Step 3: Commit** — `git commit -m "feat(push): colonne orders.device_id"`

### Task 3 : Types de notif élargis + table préférences

**Files:** Create `add_notification_types.sql`, `add_notification_preferences.sql`
- [ ] **Step 1: Élargir le CHECK**
```sql
-- add_notification_types.sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_order','assignment','status_change','general','new_message','payment'));
```
- [ ] **Step 2: Préférences + RLS**
```sql
-- add_notification_preferences.sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  order_updates BOOLEAN NOT NULL DEFAULT true,
  promotions    BOOLEAN NOT NULL DEFAULT true,
  admin_ops     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON notification_preferences FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "own prefs insert" ON notification_preferences FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "own prefs update" ON notification_preferences FOR UPDATE USING (auth.uid()::text = user_id);
```
- [ ] **Step 3: Appliquer + commit** — `git commit -m "feat(notif): types elargis + preferences (RLS)"`

### Task 4 : Activer `pg_net` + settings privés

**Files:** Create `enable_pgnet_and_settings.sql`
**Interfaces:** Produces `private.app_settings(key,value)` avec `functions_base_url` et `push_webhook_secret`.
- [ ] **Step 1:**
```sql
-- enable_pgnet_and_settings.sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
ALTER TABLE private.app_settings ENABLE ROW LEVEL SECURITY; -- deny-all client

-- ⚠️ Remplacer les valeurs (PROJECT_REF + un secret aléatoire long, ex: openssl rand -hex 32) :
INSERT INTO private.app_settings(key,value) VALUES
  ('functions_base_url','https://<PROJECT_REF>.supabase.co/functions/v1'),
  ('push_webhook_secret','<SECRET_ALEATOIRE_LONG>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```
- [ ] **Step 2: Vérifier** `pg_net` présent : `SELECT * FROM pg_extension WHERE extname='pg_net';`
- [ ] **Step 3: Commit** — `git commit -m "feat(notif): pg_net + private.app_settings"`

---

## PHASE 2 — Edge Function générique `send-push`

### Task 5 : `send-push`

**Files:** Create `supabase/functions/send-push/index.ts`, `supabase/functions/send-push/deno.json`
**Interfaces:** Consumes secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUSH_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`(opt). Accepte `POST { userId?, deviceId?, title, message, data }` gardé par header `x-webhook-secret`.

- [ ] **Step 1: deno.json**
```json
{ "imports": { "@supabase/supabase-js": "npm:@supabase/supabase-js@2" } }
```
- [ ] **Step 2: index.ts**
```ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET")!;
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

const json = (s: number, d: unknown) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) return json(401, { error: "unauthorized" });

  const { userId, deviceId, title, message, data } = await req.json().catch(() => ({}));
  if (!title || !message) return json(400, { error: "title/message required" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const tokens = new Set<string>();

  if (userId) {
    const { data: rows } = await admin.from("device_tokens").select("token").eq("user_id", userId);
    rows?.forEach((r: any) => tokens.add(r.token));
  }
  if (deviceId) {
    const { data: rows } = await admin.from("device_tokens").select("token")
      .eq("device_id", deviceId).order("updated_at", { ascending: false }).limit(1);
    rows?.forEach((r: any) => tokens.add(r.token));
  }
  if (tokens.size === 0) return json(200, { skipped: true, reason: "no token" });

  const toks = [...tokens];
  const messages = toks.map((to) => ({ to, title, body: message, sound: "default", data: data ?? {} }));
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
  if (EXPO_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers, body: JSON.stringify(messages),
  });
  const body = await res.json();

  const tickets = Array.isArray(body?.data) ? body.data : [];
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i]?.details?.error === "DeviceNotRegistered") {
      await admin.from("device_tokens").delete().eq("token", toks[i]);
    }
  }
  return json(200, { sent: true, count: messages.length });
});
```
- [ ] **Step 3: Déployer + secrets**
```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set PUSH_WEBHOOK_SECRET=<MEME_SECRET_que_app_settings>
supabase secrets set EXPO_ACCESS_TOKEN=<token-expo>   # optionnel mais recommandé
```
- [ ] **Step 4: Test local (gate)** — `supabase functions serve send-push --no-verify-jwt` puis :
```bash
curl -i -X POST http://localhost:54321/functions/v1/send-push \
  -H "x-webhook-secret: <SECRET>" -H "Content-Type: application/json" \
  -d '{"deviceId":"dev-0001","title":"Test","message":"Hello"}'
```
Attendu : `401` sans le bon secret ; `200 {skipped|sent}` avec.
- [ ] **Step 5: Commit** — `git add supabase/functions/send-push/ && git commit -m "feat(push): edge function generique send-push (secret webhook)"`

---

## PHASE 3 — Helper SQL + triggers (le cœur)

### Task 6 : `enqueue_notification()`

**Files:** Create `notif_enqueue_and_triggers.sql` (partie 1)
**Interfaces:** Produces `enqueue_notification(p_user_id, p_device_id, p_title, p_message, p_type, p_order_id, p_category, p_critical)`.

- [ ] **Step 1: Le helper**
```sql
-- notif_enqueue_and_triggers.sql  (partie 1)
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id TEXT, p_device_id TEXT, p_title TEXT, p_message TEXT,
  p_type TEXT, p_order_id TEXT, p_category TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  pref notification_preferences%ROWTYPE;
  base TEXT; secret TEXT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO pref FROM notification_preferences WHERE user_id = p_user_id;
    IF FOUND THEN
      -- Garde-fou : opt-out par catégorie
      IF p_category = 'order'     AND pref.order_updates = false THEN RETURN; END IF;
      IF p_category = 'promo'     AND pref.promotions    = false THEN RETURN; END IF;
      IF p_category = 'admin_ops' AND pref.admin_ops     = false THEN RETURN; END IF;
    END IF;
    INSERT INTO notifications(user_id, title, message, type, order_id)
    VALUES (p_user_id, p_title, p_message, p_type, p_order_id);
  END IF;

  SELECT value INTO base   FROM private.app_settings WHERE key = 'functions_base_url';
  SELECT value INTO secret FROM private.app_settings WHERE key = 'push_webhook_secret';
  IF base IS NOT NULL THEN
    PERFORM net.http_post(
      url := base || '/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', secret),
      body := jsonb_build_object('userId', p_user_id, 'deviceId', p_device_id,
        'title', p_title, 'message', p_message,
        'data', jsonb_build_object('orderId', p_order_id, 'type', p_type))
    );
  END IF;
END; $$;
```
- [ ] **Step 2: Appliquer** (la suite des triggers en Task 7, même fichier).

### Task 7 : Triggers `orders` + `contact_messages`

**Files:** `notif_enqueue_and_triggers.sql` (partie 2)
- [ ] **Step 1: Trigger commandes**
```sql
CREATE OR REPLACE FUNCTION trg_orders_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE title TEXT; msg TEXT; adm RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR adm IN SELECT id FROM users WHERE role = 'admin' LOOP
      PERFORM enqueue_notification(adm.id, NULL, '📦 Nouvelle commande !',
        'Commande ' || NEW.id || ' — ' || NEW.total_price || ' F par ' || NEW.customer_name || '.',
        'new_order', NEW.id, 'admin_ops');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'confirmee'      THEN title := 'Commande confirmée ✅'; msg := 'Votre commande est confirmée. Nous la préparons.';
      WHEN 'en_preparation' THEN title := 'En préparation 👨‍🍳';  msg := 'Votre commande est en cours de préparation.';
      WHEN 'en_livraison'   THEN title := 'En route 🛵';          msg := 'Votre commande est en route vers vous !';
      WHEN 'livree'         THEN title := 'Livrée 🎉';            msg := 'Votre commande a été livrée. Merci !';
      WHEN 'annulee'        THEN title := 'Commande annulée';     msg := 'Votre commande a été annulée. Contactez-nous si besoin.';
      ELSE title := NULL;
    END CASE;
    IF title IS NOT NULL THEN
      PERFORM enqueue_notification(NEW.user_id, NEW.device_id, title, msg, 'status_change', NEW.id, 'order');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.livreur_id IS DISTINCT FROM OLD.livreur_id AND NEW.livreur_id IS NOT NULL THEN
    PERFORM enqueue_notification(NEW.livreur_id, NULL, '🛵 Nouvelle mission !',
      'La commande ' || NEW.id || ' vous a été assignée.', 'assignment', NEW.id, 'admin_ops');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_notify_ins ON orders;
CREATE TRIGGER orders_notify_ins AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION trg_orders_notify();
DROP TRIGGER IF EXISTS orders_notify_upd ON orders;
CREATE TRIGGER orders_notify_upd AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trg_orders_notify();
```
- [ ] **Step 2: Trigger contact**
```sql
CREATE OR REPLACE FUNCTION trg_contact_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE adm RECORD;
BEGIN
  FOR adm IN SELECT id FROM users WHERE role = 'admin' LOOP
    PERFORM enqueue_notification(adm.id, NULL, '✉️ Nouveau message',
      COALESCE(NEW.name,'Un client') || ' vous a écrit.', 'new_message', NULL, 'admin_ops');
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS contact_notify_ins ON contact_messages;
CREATE TRIGGER contact_notify_ins AFTER INSERT ON contact_messages FOR EACH ROW EXECUTE FUNCTION trg_contact_notify();
```
- [ ] **Step 3: Test (gate)** — Dans le SQL editor : `UPDATE orders SET status='en_livraison' WHERE id='LUM-...';` puis vérifier (a) une ligne `notifications` créée pour le `user_id`, (b) une requête sortante dans `net._http_response` (pg_net). `INSERT` une commande de test → notifs admins.
- [ ] **Step 4: Commit** — `git add notif_enqueue_and_triggers.sql && git commit -m "feat(notif): enqueue + triggers orders/contact (push+in-app)"`

---

## PHASE 4 — Core & Mobile

### Task 8 : Core — deviceId commande + RPC register + anti-doublon

**Files:** Modify `packages/core/src/types/app.ts`, `services/api.ts`, `services/notifications.ts` (créer si besoin), `index.ts`, `apps/web/src/components/CartBuilder.tsx`, `apps/web/src/components/AdminPanel.tsx`
- [ ] **Step 1: Types** — ajouter `deviceId?: string;` à `Order` (après `userId?`) et à `CreateOrderInput` (après `userId?`).
- [ ] **Step 2: Insert device_id** — dans `apiCreateOrder` (`api.ts`), objet `.insert({...})` orders, ajouter `device_id: input.deviceId,` après `user_id: input.userId,`.
- [ ] **Step 3: RPC register** — créer `packages/core/src/services/notifications.ts` :
```ts
import { getSupabase } from '../lib/supabaseClient';
export async function apiRegisterDeviceToken(token: string, deviceId: string, platform: string): Promise<boolean> {
  const { error } = await getSupabase().rpc('register_device_token', {
    p_token: token, p_device_id: deviceId, p_platform: platform,
  });
  return !error;
}
```
et exporter dans `index.ts` : `export { apiRegisterDeviceToken } from './services/notifications';`
- [ ] **Step 4: Anti-doublon (web)** — Supprimer le bloc `// Notify Admins` (boucle `createNotification`) de `CartBuilder.tsx:145-157` (le trigger INSERT s'en charge). Supprimer le `await createNotification({... type:'assignment' ...})` de `AdminPanel.tsx:647` (le trigger UPDATE livreur_id s'en charge). Laisser le reste intact.
- [ ] **Step 5: Typecheck + commit** — diagnostics LSP 0 erreur. `git commit -m "feat(notif): core deviceId + register; suppr. createNotification (triggers prennent le relais)"`

### Task 9 : Mobile — installer expo-notifications + config

**Files:** Modify `apps/mobile/package.json`, `apps/mobile/app.json`
- [ ] **Step 1:** `npx expo install expo-notifications --workspace @lumoo/mobile` (⚠️ pas `npm install` direct dans apps/mobile).
- [ ] **Step 2:** Ajouter dans `expo.plugins` (après `expo-location`) :
```json
[ "expo-notifications", { "icon": "./assets/images/icon.png", "color": "#16a34a" } ]
```
- [ ] **Step 3:** `npx expo config --type public` (dans apps/mobile) → plugin listé, pas d'erreur.
- [ ] **Step 4: Commit** — `git commit -m "feat(push): installer expo-notifications + plugin"`

### Task 10 : Mobile — device_id, enregistrement token, wiring

**Files:** Create `apps/mobile/src/lib/device-id.ts`, `apps/mobile/src/lib/push.ts`; Modify `_layout.tsx`, `checkout.tsx`
- [ ] **Step 1: device-id.ts**
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "lumoo.device_id";
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY);
  if (!id) { id = uuid(); await AsyncStorage.setItem(KEY, id); }
  return id;
}
```
- [ ] **Step 2: push.ts**
```ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiRegisterDeviceToken } from "@lumoo/core";
import { getDeviceId } from "./device-id";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Commandes Lumoo", importance: Notifications.AndroidImportance.HIGH, lightColor: "#16a34a",
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRegisterDeviceToken(token, await getDeviceId(), Platform.OS);
}
```
- [ ] **Step 3: _layout.tsx** — dans le composant racine, ajouter un effet (et **réenregistrer à la connexion** pour lier le token au `user_id`) :
```ts
import { useEffect } from "react";
import { registerForPushNotifications } from "@/lib/push";
import { useAuth } from "@lumoo/core";
// ...
const { user } = useAuth();
useEffect(() => { void registerForPushNotifications(); }, [user?.id]);
```
- [ ] **Step 4: checkout.tsx** — importer `getDeviceId` et passer `deviceId` :
```ts
import { getDeviceId } from "@/lib/device-id";
// dans submit, avant createOrder :
const deviceId = await getDeviceId();
const order = await createOrder({ userId: user?.id, deviceId, items, /* ...inchangé */ });
```
- [ ] **Step 5: Typecheck + commit** — `git commit -m "feat(push): mobile device_id + register token + wiring checkout/login"`

### Task 11 : Mobile — tap notification → suivi

**Files:** Modify `_layout.tsx`
- [ ] **Step 1:**
```ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const orderId = r.notification.request.content.data?.orderId as string | undefined;
    if (orderId) router.push("/suivi");
  });
  return () => sub.remove();
}, []);
```
- [ ] **Step 2: Commit** — `git commit -m "feat(push): tap notification ouvre le suivi"`

### Task 12 : Mobile — écran préférences (garde-fous)

**Files:** Create `apps/mobile/src/components/notification-preferences.tsx`; Modify `account-profile.tsx`
- [ ] **Step 1: Composant**
```tsx
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useAuth, getSupabase } from "@lumoo/core";

export function NotificationPreferences() {
  const { user } = useAuth();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSupabase().from("notification_preferences").select("*").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) { setOrderUpdates(data.order_updates); setPromotions(data.promotions); } });
  }, [user]);

  async function save(patch: { order_updates?: boolean; promotions?: boolean }) {
    if (!user) return;
    await getSupabase().from("notification_preferences")
      .upsert({ user_id: user.id, order_updates: orderUpdates, promotions, ...patch });
  }
  if (!user) return null;
  return (
    <View className="rounded-2xl border border-gray-100 bg-white p-4">
      <Text className="mb-3 font-display text-base text-gray-900">Notifications</Text>
      <Row label="Suivi de mes commandes" value={orderUpdates}
        onChange={(v) => { setOrderUpdates(v); void save({ order_updates: v }); }} />
      <Row label="Offres & nouveautés" value={promotions}
        onChange={(v) => { setPromotions(v); void save({ promotions: v }); }} />
    </View>
  );
}
function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="min-h-11 flex-row items-center justify-between py-2">
      <Text className="flex-1 font-body text-gray-700">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: "#16a34a" }} />
    </View>
  );
}
```
- [ ] **Step 2:** Monter `<NotificationPreferences />` dans `account-profile.tsx` (section visible si connecté).
- [ ] **Step 3: Commit** — `git commit -m "feat(notif): ecran preferences (opt-out par categorie)"`

---

## PHASE 5 — Build, credentials & test bout-en-bout

### Task 13 : Ops + e2e
- [ ] **Step 1: Credentials** — FCM (Android) + APNs (iOS) via `eas credentials`. Access token Expo + activer Enhanced Security push (secret `EXPO_ACCESS_TOKEN`, Task 5).
- [ ] **Step 2: Dev build** — `cd apps/mobile && eas build --profile development --platform android`, installer sur appareil **physique**.
- [ ] **Step 3: e2e (gate finale)**
  1. **Invité** : autoriser notifs → commander (vérifier `orders.device_id` + ligne `device_tokens`). L'admin reçoit push+in-app « 📦 Nouvelle commande ! ». Changer statut depuis l'admin → l'invité reçoit le **push** (app fermée). Pas d'in-app (normal).
  2. **Client connecté** : changer statut → **in-app + push**. Désactiver « Suivi de mes commandes » → plus rien au statut suivant.
  3. **Contact** : envoyer message → admins push+in-app « ✉️ Nouveau message ».
  4. **Livreur** : assignation → push+in-app « 🛵 Nouvelle mission ! ». Confirmation livraison (UPDATE status=livree) → client notifié « Livrée 🎉 ».
  5. **Anti-doublon** : commande via builder web → une seule notif admin.
  6. Désinstaller l'app, re-déclencher → `send-push` reçoit `DeviceNotRegistered` et supprime le token.
- [ ] **Step 4: Commit** — `git commit -m "docs(notif): credentials + procedure e2e"`

---

## Durcissement / suite (hors périmètre immédiat)

- **Engagement (phase 2)** : panier abandonné, re-engagement, promos → catégorie `promo` (déjà couverte par l'opt-out `promotions`). **Quiet hours et plafond hebdo : écartés** pour l'instant — à réintroduire dans `enqueue_notification` (et la table des préférences) seulement si on pousse du volume marketing.
- **Resserrer** la policy d'INSERT de `notifications` (actuellement `WITH CHECK (true)`) : désormais seules les fonctions `SECURITY DEFINER` insèrent → on peut restreindre aux rôles serveur.
- **Batch Expo** : si beaucoup de tokens, découper en lots de 100 (limite API Expo).

## Self-Review

- **Couverture** : push+in-app pour tous, immédiat (triggers) ✅ ; invité = push via device_id (enqueue gère p_user_id NULL) ✅ ; admin/livreur push+in-app maintenant (resolve par user_id dans send-push) ✅ ; sécurité token (RLS deny-all + secret webhook) ✅ ; garde-fou opt-out par catégorie (enqueue) ✅ ; quiet hours/plafond écartés (scope) ✅ ; anti-doublon (suppression des createNotification, Task 8) ✅ ; livrée via UPDATE status (couvre confirm_delivery) ✅.
- **Placeholders** : code SQL/TS/Deno/TSX complet. Restent à renseigner : `<PROJECT_REF>`, `<SECRET>` (Task 4), credentials (Task 13) — valeurs d'environnement, pas des trous de logique.
- **Cohérence** : `enqueue_notification(8 args)` appelée identiquement par les 2 triggers ; `send-push` lit `device_tokens` par `user_id`/`device_id` cohérent avec `register_device_token` ; `x-webhook-secret` = `private.app_settings.push_webhook_secret` = secret de fonction `PUSH_WEBHOOK_SECRET` (même valeur aux 3 endroits).
```
