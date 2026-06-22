# Enrichissement des notifications (transactionnel + garde-fous) — Implementation Plan

> ⚠️ **SUPERSEDED** par `2026-06-22-notifications-push-unifie.md` (architecture triggers Postgres, push + in-app pour tous). Conservé pour historique.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifier tout le monde aux étapes clés (client à chaque changement de statut de commande, admin à chaque nouvelle commande/message, livreur à l'assignation), avec des garde-fous anti-spam dès le départ (opt-out par catégorie + quiet hours).

**Architecture:** Centralisation dans un helper service `apiNotify()` (couche `@lumoo/core`), appelé depuis les vrais points de déclenchement (changement de statut, création de commande, confirmation de livraison, message de contact, assignation). `apiNotify()` applique les **préférences** (`notification_preferences`) avant d'écrire la notif in-app. Le **client** reçoit aussi le **push** via le plan B (`send-order-push`). Admin/livreur = in-app en phase 1.

**Tech Stack:** Supabase (Postgres, RLS), `@lumoo/core` (services), React Native / Expo (écran préférences), web admin (déclencheurs existants à recâbler).

## Global Constraints

- **Phase 1 = transactionnel uniquement** (pas de marketing/engagement). L'engagement (panier abandonné, promos, re-engagement) = phase 2, mais l'**infrastructure de garde-fous** (préférences + quiet hours + plafond) se pose **maintenant**.
- **Garde-fous obligatoires** : opt-out par catégorie, quiet hours. Les notifs **commande** sont *critiques* → elles **ignorent** les quiet hours (un « livreur arrive » la nuit reste utile). Les notifs *engagement* (phase 2) respecteront quiet hours + plafond hebdo.
- **Invité** : pas de `user_id` → **pas de notif in-app** possible, seulement **push** (plan B). Ne jamais tenter d'insérer une notif in-app sans `user_id`.
- **Dépend du plan B** (`2026-06-22-push-notifications-invite.md`) pour le canal push client. Le push admin/livreur est hors périmètre (phase 2).
- Interface **français**, vert marque `#16a34a`. Pas de tests jest dans le repo → gates = typecheck + vérif manuelle.
- Corriger le bug : `new_message` est dans le type TS mais **absent du CHECK SQL** de `notifications`.
- SQL appliqué manuellement (dashboard / MCP `apply_migration`).

---

## File Structure

**Créés :**
- `add_notification_types.sql` — élargit le `CHECK` de `notifications.type`.
- `add_notification_preferences.sql` — table `notification_preferences` + RLS.
- `packages/core/src/services/notifications.ts` — `apiNotify`, `apiNotifyAdmins`, `notifyOrderStatus`, prefs helpers.
- `apps/mobile/src/components/notification-preferences.tsx` — UI réglages (toggles + quiet hours).

**Modifiés :**
- `packages/core/src/types/notifications.ts` — types catégorie + prefs.
- `packages/core/src/services/api.ts` — `apiCreateOrder` (notifie admins), `apiUpdateOrderStatus` (notifie client in-app).
- `packages/core/src/index.ts` — exports.
- `apps/web/src/components/CartBuilder.tsx:145-157` — **retirer** la notif admin (déplacée dans `apiCreateOrder`).
- `apps/web/src/components/AdminPanel.tsx:647` — router l'assignation via `apiNotify`.
- `apps/mobile/src/app/livraisons.tsx` — notifier le client à la confirmation de livraison.
- `apps/mobile/src/app/contact.tsx:43-60` + `apps/web/src/components/ContactForm.tsx` — notifier les admins (new_message).
- `apps/mobile/src/components/account-profile.tsx` (ou écran compte) — monter l'UI préférences.

---

## Task 1 : SQL — élargir les types + table des préférences

**Files:**
- Create: `add_notification_types.sql`, `add_notification_preferences.sql`

**Interfaces:**
- Produces : `notifications.type` accepte `'new_order','assignment','status_change','general','new_message','payment'`.
- Produces : table `notification_preferences(user_id PK, order_updates, promotions, admin_ops, quiet_start, quiet_end, updated_at)` + RLS (chacun gère sa ligne).

- [ ] **Step 1: Élargir le CHECK des types**

```sql
-- add_notification_types.sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_order','assignment','status_change','general','new_message','payment'));
```

- [ ] **Step 2: Table des préférences + RLS**

```sql
-- add_notification_preferences.sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  order_updates BOOLEAN NOT NULL DEFAULT true,   -- transactionnel commande (client) — critique
  promotions    BOOLEAN NOT NULL DEFAULT true,   -- engagement/marketing (phase 2)
  admin_ops     BOOLEAN NOT NULL DEFAULT true,   -- nouvelles commandes / messages (admin)
  quiet_start   SMALLINT,                         -- heure locale 0-23 ; NULL = pas de quiet hours
  quiet_end     SMALLINT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs select" ON notification_preferences
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "own prefs upsert" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "own prefs update" ON notification_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);
```

- [ ] **Step 3: Appliquer + vérifier + commit**

Appliquer les deux fichiers (dashboard / MCP). Vérifier : insérer une notif `new_message` ne lève plus d'erreur de contrainte.
```bash
git add add_notification_types.sql add_notification_preferences.sql
git commit -m "feat(notif): types elargis + table notification_preferences (RLS)"
```

---

## Task 2 : Core — helper `apiNotify` + préférences

**Files:**
- Create: `packages/core/src/services/notifications.ts`
- Modify: `packages/core/src/types/notifications.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes : `getSupabase()`, table `notifications`, table `notification_preferences`, table `users`.
- Produces :
  - `type NotifCategory = 'order' | 'promo' | 'admin_ops'`
  - `apiNotify(input: NotifyInput): Promise<void>` où `NotifyInput = { userId?: string; title: string; message: string; type: NotificationType; orderId?: string; category: NotifCategory; critical?: boolean }`
  - `apiNotifyAdmins(input: Omit<NotifyInput,'userId'|'category'>): Promise<void>`
  - `notifyOrderStatus(order: { id: string; userId?: string; customerName?: string }, status: OrderStatus): Promise<void>`

- [ ] **Step 1: Ajouter la catégorie au type**

Dans `packages/core/src/types/notifications.ts`, ajouter :
```ts
export type NotifCategory = 'order' | 'promo' | 'admin_ops';

export interface NotificationPreferences {
  userId: string;
  orderUpdates: boolean;
  promotions: boolean;
  adminOps: boolean;
  quietStart: number | null;
  quietEnd: number | null;
}
```

- [ ] **Step 2: Écrire le service**

```ts
// packages/core/src/services/notifications.ts
import { getSupabase } from '../lib/supabaseClient';
import type { NotificationType, NotifCategory } from '../types/notifications';
import type { OrderStatus } from '../types';

export type NotifyInput = {
  userId?: string;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  category: NotifCategory;
  critical?: boolean; // true => ignore les quiet hours (transactionnel commande)
};

// Libellés FR par statut de commande (réutilisés par le push — garder synchrone).
const ORDER_STATUS_COPY: Partial<Record<OrderStatus, { title: string; message: string }>> = {
  confirmee:      { title: 'Commande confirmée ✅', message: 'Votre commande est confirmée. Nous la préparons.' },
  en_preparation: { title: 'En préparation 👨‍🍳',   message: 'Votre commande est en cours de préparation.' },
  en_livraison:   { title: 'En route 🛵',           message: 'Votre commande est en route vers vous !' },
  livree:         { title: 'Livrée 🎉',             message: 'Votre commande a été livrée. Merci !' },
  annulee:        { title: 'Commande annulée',      message: 'Votre commande a été annulée. Contactez-nous si besoin.' },
};

function categoryAllowed(prefs: any, category: NotifCategory): boolean {
  if (!prefs) return true; // pas de prefs => défauts tous activés
  if (category === 'order') return prefs.order_updates !== false;
  if (category === 'promo') return prefs.promotions !== false;
  if (category === 'admin_ops') return prefs.admin_ops !== false;
  return true;
}

function inQuietHours(prefs: any): boolean {
  if (!prefs || prefs.quiet_start == null || prefs.quiet_end == null) return false;
  const h = new Date().getHours();
  const s = prefs.quiet_start, e = prefs.quiet_end;
  return s <= e ? (h >= s && h < e) : (h >= s || h < e); // gère le passage minuit
}

// Notif in-app pour UN utilisateur (no-op si pas de userId : invité => push seulement).
export async function apiNotify(input: NotifyInput): Promise<void> {
  if (!input.userId) return;
  const supabase = getSupabase();

  const { data: prefs } = await supabase
    .from('notification_preferences').select('*').eq('user_id', input.userId).single();

  if (!categoryAllowed(prefs, input.category)) return;
  if (!input.critical && inQuietHours(prefs)) return;

  await supabase.from('notifications').insert({
    user_id: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    order_id: input.orderId,
  });
}

// Fan-out vers tous les admins (in-app).
export async function apiNotifyAdmins(
  input: Omit<NotifyInput, 'userId' | 'category'>,
): Promise<void> {
  const supabase = getSupabase();
  const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
  if (!admins) return;
  await Promise.all(
    admins.map((a: any) => apiNotify({ ...input, userId: a.id, category: 'admin_ops' })),
  );
}

// Notif client à un changement de statut (in-app ; le push est géré par le plan B).
export async function notifyOrderStatus(
  order: { id: string; userId?: string; customerName?: string },
  status: OrderStatus,
): Promise<void> {
  const copy = ORDER_STATUS_COPY[status];
  if (!copy) return; // statuts non notifiables (ex: en_attente)
  await apiNotify({
    userId: order.userId,
    title: copy.title,
    message: copy.message,
    type: 'status_change',
    orderId: order.id,
    category: 'order',
    critical: true, // transactionnel => ignore quiet hours
  });
}
```

- [ ] **Step 3: Exporter**

Dans `packages/core/src/index.ts` :
```ts
export { apiNotify, apiNotifyAdmins, notifyOrderStatus } from './services/notifications';
export type { NotifyInput } from './services/notifications';
```

- [ ] **Step 4: Typecheck (gate) + commit**

Run: diagnostics LSP sur `notifications.ts` — 0 erreur.
```bash
git add packages/core/src/services/notifications.ts packages/core/src/types/notifications.ts packages/core/src/index.ts
git commit -m "feat(notif): helper apiNotify + preferences + notifyOrderStatus"
```

---

## Task 3 : Wire — client notifié à chaque changement de statut

**Files:**
- Modify: `packages/core/src/services/api.ts` (apiUpdateOrderStatus)
- Modify: `apps/mobile/src/app/livraisons.tsx` (confirmation de livraison)

**Interfaces:**
- Consumes : `notifyOrderStatus` (Task 2), `apiSendOrderPush` (plan B Task 3).

- [ ] **Step 1: Notif in-app à la mise à jour de statut (admin)**

Dans `api.ts`, `apiUpdateOrderStatus`, après `if (error || !data) return null;` et avant le `return` final, ajouter :
```ts
  void notifyOrderStatus({ id: orderId, userId: data.user_id, customerName: data.customer_name }, status);
```
(Le push est déjà déclenché ici par le plan B via `apiSendOrderPush`.) Ajouter l'import en tête de `api.ts` :
```ts
import { notifyOrderStatus } from './notifications';
```

- [ ] **Step 2: Notif « livrée » à la confirmation par le livreur**

Dans `apps/mobile/src/app/livraisons.tsx`, après un `apiConfirmDelivery(...)` qui renvoie `true`, ajouter (l'objet order y est disponible) :
```ts
import { notifyOrderStatus } from "@lumoo/core";
// ... après confirmation réussie :
void notifyOrderStatus({ id: order.id, userId: order.userId, customerName: order.customerName }, "livree");
```
Et déclencher le push : `void apiSendOrderPush(order.id, "livree");` (importer `apiSendOrderPush`).
⚠️ Vérifier que `apiGetLivreurOrders` renvoie bien `userId` (sinon la notif in-app sera ignorée, le push via `device_id` fonctionnera quand même).

- [ ] **Step 3: Typecheck + commit**

```bash
git add packages/core/src/services/api.ts apps/mobile/src/app/livraisons.tsx
git commit -m "feat(notif): client notifie a chaque changement de statut (+livree)"
```

---

## Task 4 : Wire — admin notifié à CHAQUE nouvelle commande (web + mobile)

**Files:**
- Modify: `packages/core/src/services/api.ts` (apiCreateOrder)
- Modify: `apps/web/src/components/CartBuilder.tsx:145-157` (retirer le doublon)

**Interfaces:**
- Consumes : `apiNotifyAdmins` (Task 2).

- [ ] **Step 1: Notifier les admins dans `apiCreateOrder`**

Dans `api.ts`, `apiCreateOrder`, juste avant le `return {...}` final, ajouter :
```ts
  void apiNotifyAdmins({
    title: '📦 Nouvelle commande !',
    message: `Commande ${orderId} — ${totalPrice.toLocaleString('fr-FR')} F par ${input.customerName}.`,
    type: 'new_order',
    orderId,
  });
```
Importer `apiNotifyAdmins` en tête de `api.ts` (mutualiser avec l'import `notifyOrderStatus`) :
```ts
import { notifyOrderStatus, apiNotifyAdmins } from './notifications';
```

- [ ] **Step 2: Retirer la notif admin dupliquée du CartBuilder**

Dans `apps/web/src/components/CartBuilder.tsx`, supprimer le bloc `// Notify Admins` (lignes ~145-157 : la boucle `for (const admin of admins) { await createNotification(...) }`) — c'est désormais géré côté `apiCreateOrder` pour TOUS les canaux (web + mobile). Laisser le reste (`setCreatedOrderId`, etc.) intact.

- [ ] **Step 3: Vérifier (gate)**

Passer une commande depuis le mobile → un admin doit recevoir « 📦 Nouvelle commande ! » (ce qui n'arrivait pas avant). Depuis le web → une seule notif (pas de doublon).
```bash
git add packages/core/src/services/api.ts apps/web/src/components/CartBuilder.tsx
git commit -m "feat(notif): admin notifie pour toute commande (web+mobile), suppr. doublon"
```

---

## Task 5 : Wire — admin notifié des messages de contact (new_message)

**Files:**
- Modify: `apps/mobile/src/app/contact.tsx:43-60`
- Modify: `apps/web/src/components/ContactForm.tsx` (après l'insert `contact_messages`)

**Interfaces:**
- Consumes : `apiNotifyAdmins` (Task 2).

- [ ] **Step 1: Mobile — notifier après l'insert**

Dans `apps/mobile/src/app/contact.tsx`, dans `submit()`, après l'insert `contact_messages` réussi, ajouter :
```ts
import { apiNotifyAdmins } from "@lumoo/core";
// ... après insert OK :
void apiNotifyAdmins({
  title: "✉️ Nouveau message",
  message: `${name} vous a écrit.`,
  type: "new_message",
});
```

- [ ] **Step 2: Web — idem dans ContactForm**

Dans `apps/web/src/components/ContactForm.tsx`, après l'insert `contact_messages` réussi, même appel `apiNotifyAdmins({ title: '✉️ Nouveau message', message: ..., type: 'new_message' })`.

- [ ] **Step 3: Vérifier + commit**

Envoyer un message de contact → les admins reçoivent « ✉️ Nouveau message » (et plus d'erreur de contrainte sur `new_message`).
```bash
git add apps/mobile/src/app/contact.tsx apps/web/src/components/ContactForm.tsx
git commit -m "feat(notif): admin notifie des nouveaux messages de contact"
```

---

## Task 6 : Wire — assignation livreur via `apiNotify`

**Files:**
- Modify: `apps/web/src/components/AdminPanel.tsx:647`

**Interfaces:**
- Consumes : `apiNotify` (Task 2).

- [ ] **Step 1: Remplacer le `createNotification` direct**

Dans `AdminPanel.tsx`, remplacer la ligne 647 par un appel `apiNotify` (centralise + prêt pour le push livreur en phase 2) :
```ts
await apiNotify({
  userId: livreurId,
  title: '🛵 Nouvelle mission !',
  message: `La commande ${order.id} vous a été assignée.`,
  type: 'assignment',
  orderId: order.id,
  category: 'admin_ops',
  critical: true,
});
```
Importer `apiNotify` depuis `@lumoo/core`.

- [ ] **Step 2: Vérifier + commit**

Assigner un livreur → il reçoit toujours sa mission (comportement inchangé, code centralisé).
```bash
git add apps/web/src/components/AdminPanel.tsx
git commit -m "refactor(notif): assignation livreur via apiNotify centralise"
```

---

## Task 7 : Garde-fous — écran de préférences (mobile)

**Files:**
- Create: `apps/mobile/src/components/notification-preferences.tsx`
- Modify: `apps/mobile/src/components/account-profile.tsx` (monter la section)

**Interfaces:**
- Consumes : table `notification_preferences` (Task 1), `useAuth`.

- [ ] **Step 1: Composant préférences (toggles + quiet hours)**

```tsx
// apps/mobile/src/components/notification-preferences.tsx
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useAuth, getSupabase } from "@lumoo/core";

export function NotificationPreferences() {
  const { user } = useAuth();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("notification_preferences").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) { setOrderUpdates(data.order_updates); setPromotions(data.promotions); }
      });
  }, [user]);

  async function save(patch: { order_updates?: boolean; promotions?: boolean }) {
    if (!user) return;
    await getSupabase().from("notification_preferences").upsert({
      user_id: user.id, order_updates: orderUpdates, promotions, ...patch,
    });
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
(Quiet hours : champ optionnel à ajouter ensuite avec un sélecteur d'heures ; la colonne existe déjà et `apiNotify` la respecte. On peut livrer les toggles d'abord.)

- [ ] **Step 2: Monter dans l'écran Compte**

Dans `apps/mobile/src/components/account-profile.tsx`, importer et rendre `<NotificationPreferences />` dans la liste des sections (pour un utilisateur connecté).

- [ ] **Step 3: Typecheck + commit**

```bash
git add apps/mobile/src/components/notification-preferences.tsx apps/mobile/src/components/account-profile.tsx
git commit -m "feat(notif): ecran preferences (opt-out par categorie)"
```

---

## Task 8 : Vérification bout-en-bout

- [ ] **Step 1: Scénarios (gate finale)**
  1. **Client connecté** : commander → admin notifié ; changer le statut depuis l'admin → le client reçoit la notif in-app (et le push, plan B). Désactiver « Suivi de mes commandes » dans les préférences → plus de notif in-app au statut suivant (mais push critique conservé selon réglage souhaité).
  2. **Client invité** : commander → pas de notif in-app (normal), push reçu (plan B).
  3. **Contact** : envoyer un message → admins notifiés « ✉️ Nouveau message » (plus d'erreur SQL).
  4. **Livreur** : assignation → mission reçue ; confirmation de livraison → client notifié « Livrée 🎉 ».
  5. **Web** : commande via builder → une seule notif admin (pas de doublon).

- [ ] **Step 2: Commit final éventuel (notes)**

```bash
git add -A && git commit -m "docs(notif): procedure de verification bout-en-bout"
```

---

## Phase 2 (hors périmètre — noté pour la suite)

- **Engagement** : panier abandonné, re-engagement (N jours sans commande), promos/nouveaux produits, fidélité. Respect strict de `promotions` + quiet hours + **plafond hebdo** (à ajouter dans `apiNotify` : compter les notifs `promo` des 7 derniers jours avant d'envoyer).
- **Push admin/livreur** : fonction `send-user-push` résolvant les tokens par `user_id` (pas par `device_id` de commande).
- **Durcissement** : déplacer les déclencheurs vers des **triggers Postgres** (status change, INSERT order, INSERT contact_messages) → notifs garanties quel que soit l'émetteur, et resserrer la policy d'INSERT de `notifications` (actuellement `WITH CHECK (true)` = trop permissive).

## Self-Review

- **Couverture** : client à chaque statut (Task 3) ✅ ; livrée (Task 3) ✅ ; admin toute commande web+mobile + suppression doublon (Task 4) ✅ ; contact/new_message + fix CHECK (Task 1/5) ✅ ; assignation centralisée (Task 6) ✅ ; garde-fous opt-out + quiet hours (Task 1/2/7) ✅ ; invité = push only (contrainte respectée dans `apiNotify`) ✅.
- **Placeholders** : code SQL/TS/TSX complet. Restent des vérifications explicites (`apiGetLivreurOrders` renvoie-t-il `userId`, emplacement exact des inserts contact) — signalées, pas des trous.
- **Cohérence types** : `apiNotify({userId?,title,message,type,orderId?,category,critical?})`, `apiNotifyAdmins`, `notifyOrderStatus(order,status)` utilisés tels quels en Tasks 3-6. Catégories `'order'|'promo'|'admin_ops'` alignées entre `categoryAllowed` et les appels.
