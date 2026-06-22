# Runbook — Notifications (push + in-app) · **état réel Lumoo**

> Ce document décrit **comment le système tourne réellement dans CE repo** : les vrais fichiers,
> le vrai déploiement, les déviations par rapport au plan, et comment débugger/étendre.
>
> - **Le « comment construire ça ailleurs » (générique, réutilisable)** → `~/.claude/docs/push-notifications-playbook.md`.
> - **Le « ce qui était à faire » (plans datés)** → `docs/superpowers/plans/2026-06-22-notifications-push-unifie.md` (les 2 autres plans notif sont *superseded*).
> - **Les galères chronologiques** → `docs/JOURNAL.md`.
>
> Validé bout-en-bout le **2026-06-22** sur **appareil réel** (push **connecté + invité** reçus). FCM Android configuré + **build preview** faits. Reste surtout à **merger `react-native-terrain` → `main`** (sinon doublon de notifs en prod — voir §Reste à faire).

---

## Vue d'ensemble

Tout est déclenché **côté serveur par des triggers Postgres** (infalsifiable, marche quel que soit l'émetteur : invité, admin, livreur, SQL direct). Deux canaux :

- **In-app** (table `notifications`, cloche) → **connectés uniquement** (besoin d'un `user_id`).
- **Push** (app fermée incluse) → **tout le monde**, invités via `orders.device_id`.

```
INSERT/UPDATE orders ─┐
INSERT contact_messages ─┼─► trigger ─► enqueue_notification()
                         │                ├─ opt-out par catégorie (notification_preferences)
                         │                ├─ INSERT notifications (si user_id)
                         │                └─ pg_net.http_post ─► Edge Function send-push (slug rapid-service)
                         │                                         └─ résout tokens (user_id + device_id) ─► Expo Push
```

## Fichiers réels

**SQL (racine, appliqués manuellement via dashboard / MCP `apply_migration`) :**
- `add_device_tokens.sql` — table `device_tokens` (RLS deny-all) + RPC `register_device_token`.
- `add_device_id_to_orders.sql` — `orders.device_id`.
- `add_notification_types.sql` — élargit le `CHECK` de `notifications.type`.
- `add_notification_preferences.sql` — table prefs + RLS (chacun sa ligne).
- `enable_pgnet_and_settings.sql` — `pg_net` + schéma `private` + `private.app_settings`.
- `notif_enqueue_and_triggers.sql` — **le cœur** : `enqueue_notification` + triggers `orders`/`contact_messages` + durcissement (REVOKE).

**Edge Function :** `supabase/functions/send-push/index.ts` (+ `deno.json`).

**Core (`packages/core`) :** `services/notifications.ts` (`apiRegisterDeviceToken`), `deviceId` sur `Order`/`CreateOrderInput` (`types/app.ts`), insert `device_id` dans `apiCreateOrder` (`services/api.ts`).

**Mobile (`apps/mobile/src`) :** `lib/device-id.ts`, `lib/push.ts`, wiring dans `app/_layout.tsx` (register au démarrage **et** à la connexion + **tap → détail (connecté) / suivi avec code local (invité) + cold start** via `useLastNotificationResponse` + `useRootNavigationState`), `deviceId` au `app/checkout.tsx`, écran `components/notification-preferences.tsx`.

## Déploiement réel (⚠️ déviations vs plan)

Le plan disait Vercel ; **la réalité est différente** — voir `docs/JOURNAL.md` (3 entrées du 2026-06-22) :

1. **`send-push` est une Edge Function Supabase** (pas Vercel) — pas d'accès au dashboard Vercel.
2. **Slug réel = `rapid-service`** (≠ nom `send-push`) car créée via dashboard → slug aléatoire, non renommable.
   → `private.app_settings.functions_base_url` = **URL complète** `https://<PROJECT_REF>.supabase.co/functions/v1/rapid-service`.
3. **Verify JWT est ON** → `enqueue_notification` envoie aussi la **clé anon** (`private.app_settings.anon_key`) en `Authorization: Bearer` + `apikey`. La vraie garde reste **`x-webhook-secret`**.

**Secrets à aligner (même valeur partout) :** `private.app_settings.push_webhook_secret` = secret de fonction `PUSH_WEBHOOK_SECRET` = header `x-webhook-secret`.

**Clés de `private.app_settings` :** `functions_base_url`, `push_webhook_secret`, `anon_key`.

## Sécurité (verrous en place)

- `device_tokens` : RLS **deny-all** côté client (token = capacité bearer). Écriture via RPC `register_device_token` (`SECURITY DEFINER`), lecture **service_role** seulement (la fonction d'envoi).
- `private.app_settings` : schéma privé + RLS deny-all (secrets jamais exposés à l'API).
- `enqueue_notification` : **`REVOKE EXECUTE` du public** (appelée uniquement par les triggers).
- `notifications` : **pas** de policy INSERT ouverte (seuls les triggers `SECURITY DEFINER` insèrent).

> Note schéma : les triggers lisent les admins dans **`profiles`** (`role='admin'`), pas `users` — héritage de la migration Supabase Auth. `user_id` est de type **`uuid`**.

## Débugger (cheatsheet)

```sql
-- Un token s'est-il enregistré ?
SELECT token, device_id, user_id, platform, updated_at FROM device_tokens ORDER BY updated_at DESC LIMIT 5;

-- Déclencher + voir l'appel HTTP sortant (pg_net est asynchrone)
UPDATE orders SET status='confirmee' WHERE id = '<commande liée au token>';
SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 3;
--  200 {"sent":true}          -> OK
--  200 {"skipped":"no token"} -> pipeline OK mais aucun token ne matche (commande ≠ appareil/compte)
--  401                        -> secret/clé (Verify JWT) — cf. JOURNAL 2026-06-22
--  404                        -> mauvais slug/URL (cf. rapid-service) ou fonction non déployée
--  null                       -> hôte injoignable / DNS (URL fausse)

-- Audit RLS
SELECT has_function_privilege('anon','public.enqueue_notification(uuid,text,text,text,text,text,text)','EXECUTE'); -- doit être false
```

Pièges complets (FCM, Expo Go, cold start, device_id réinstall…) : **playbook §9** — ne pas redébugger 1h sans l'avoir relu.

## Étendre

- **Nouveau type de notif** : ajouter au `CHECK` (`add_notification_types.sql`) + un `PERFORM enqueue_notification(...)` dans le bon trigger (catégorie `order`/`promo`/`admin_ops`).
- **Nouvel événement** (autre table) : nouveau trigger `AFTER INSERT/UPDATE` qui appelle `enqueue_notification`.
- **Marketing/engagement (phase 2)** : catégorie `promo` (déjà opt-out-able). Quiet hours / plafond hebdo = volontairement **hors périmètre** pour l'instant (à réintroduire dans `enqueue_notification` + table prefs si on pousse du volume).
- **Anti-doublon** : les triggers remplacent les `createNotification` applicatifs → ne pas les réintroduire côté app.

## Fait depuis la validation
- ✅ **FCM Android** configuré (`google-services.json` dans `apps/mobile/` + clé de compte de service dans EAS) + **build preview** → push **connecté ET invité** reçus sur appareil réel.
- ✅ **Tap notif → détail** (connecté) / **suivi** avec code local (invité) + **cold start** ; publié en **OTA** (canal preview).
- ✅ Accusé de réception **« Commande reçue ✅ »** à la création (trigger `INSERT`).
- ✅ Web : icône « Créer mon panier » (PC) = caddie (cohérence) — hors notif, dans le même lot.

## Reste à faire

- [ ] **Merger `react-native-terrain` → `main`** : SQL/triggers déjà en prod, mais le **web prod tourne l'ancien code** → **doublon de notifs admin/livreur** tant que pas mergé. (PR à créer côté GitHub.)
- [ ] Credentials **APNs** (iOS) si un build iOS est visé (Android FCM = fait).
- [ ] (Optionnel) Engagement/marketing : catégorie `promo` + quiet hours/plafond (hors périmètre pour l'instant).
