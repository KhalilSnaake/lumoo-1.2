# Playbook — Notifications push + in-app (Expo + Supabase)

> Guide réutilisable pour de futurs projets. Tiré de l'implémentation Lumoo (juin 2026).
> Stack : Expo SDK 54 (`expo-notifications`) · Supabase (Postgres, RLS, `pg_net`) · fonction serverless d'envoi (Supabase Edge Function **ou** Vercel) · API Expo Push.
>
> 📍 Copie projet de `~/.claude/docs/push-notifications-playbook.md` — garder les deux en phase.

---

## 1. Architecture (la cible)

```
INSERT/UPDATE table métier (ex: orders)  ─┐
INSERT contact_messages / autre event    ─┼─► TRIGGER Postgres
                                          │      └─► enqueue_notification()
                                          │            ├─ applique les préférences (opt-out)
                                          │            ├─ INSERT notif IN-APP   (si user_id connu)
                                          │            └─ pg_net.http_post ─► fonction "send-push"
                                          │                                      └─ résout les tokens (par user_id et/ou device_id)
                                          │                                         └─ POST https://exp.host/--/api/v2/push/send
```

**Deux canaux, deux audiences :**
- **In-app** (cloche + liste, realtime Supabase) → **uniquement les connectés** (besoin d'un `user_id`).
- **Push** (app fermée incluse) → **tout le monde**, invités compris (via un `device_id` stocké sur la commande/entité).

> ⚠️ Un **invité n'a pas de `user_id`** → pas d'in-app possible, **push only**. C'est une limite dure, pas un bug.

**Pourquoi tout déclencher par triggers Postgres ?** Parce qu'un événement déclenché par un utilisateur peu privilégié (ex: un invité passe commande) doit pouvoir notifier un admin **sans** qu'on fasse confiance au client. Le trigger tourne côté serveur (SECURITY DEFINER) → infalsifiable, marche quel que soit l'émetteur.

---

## 2. Décisions à trancher tôt

| Décision | Options | Reco |
|---|---|---|
| Déclencheur | Triggers Postgres / appels app-level | **Triggers** (robuste, couvre tous les émetteurs) |
| Hébergement fonction d'envoi | Supabase Edge Function / Vercel serverless | Selon **l'accès dont tu disposes** (voir §7) |
| Garde-fous | opt-out catégorie / quiet hours / plafond | **opt-out catégorie** au minimum |
| In-app pour invités | impossible | assume : invité = push only |

---

## 3. Modèle de données (SQL)

```sql
-- Tokens push : VERROUILLÉ (le token est une capacité "bearer")
CREATE TABLE device_tokens (
  token      TEXT PRIMARY KEY,                 -- ExpoPushToken
  device_id  TEXT NOT NULL,                    -- id d'appareil stable (généré côté app)
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- null si invité
  platform   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;  -- RLS ON + AUCUNE policy = deny-all client

-- Enregistrement via RPC SECURITY DEFINER (le client ne touche jamais la table)
CREATE OR REPLACE FUNCTION register_device_token(p_token TEXT, p_device_id TEXT, p_platform TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO device_tokens(token, device_id, user_id, platform, updated_at)
  VALUES (p_token, p_device_id, auth.uid(), p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET device_id=EXCLUDED.device_id, user_id=EXCLUDED.user_id,
        platform=EXCLUDED.platform, updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION register_device_token(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT,TEXT,TEXT) TO anon, authenticated;

-- Lien entité -> appareil (pour pousser un invité)
ALTER TABLE orders ADD COLUMN device_id TEXT;

-- Préférences (garde-fou : opt-out par catégorie)
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  order_updates BOOLEAN NOT NULL DEFAULT true,
  promotions    BOOLEAN NOT NULL DEFAULT true,
  admin_ops     BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_sel ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p_ins ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY p_upd ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Config privée (URL fonction + secret webhook + clé anon). Schéma privé, deny-all.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
ALTER TABLE private.app_settings ENABLE ROW LEVEL SECURITY;  -- aucune policy
```

`notifications` (in-app) : table classique `(id, user_id uuid, title, message, type, order_id, read, created_at)`.
Policies **scopées** : SELECT/UPDATE/DELETE `user_id = auth.uid() OR is_admin()`. **PAS** de policy INSERT ouverte (les triggers SECURITY DEFINER insèrent quand même).

---

## 4. Sécurité (non négociable)

- **Token = bearer capability** : quiconque l'a peut pousser l'appareil (Expo n'authentifie pas l'expéditeur par défaut). → `device_tokens` **jamais lisible côté client** (RLS deny-all), lecture réservée au **service role** (la fonction d'envoi).
- **Secrets** (`app_settings`) dans un **schéma `private`** non exposé à l'API + RLS deny-all.
- **`REVOKE EXECUTE`** sur les fonctions `SECURITY DEFINER` appelées par les triggers (ex: `enqueue_notification`) **depuis PUBLIC/anon/authenticated** — sinon un client pourrait les appeler et forger des notifs/pushs. (Les triggers les appellent en interne, ça ne casse rien.)
- **Audit RLS** rapide : voir §10.

---

## 5. Serveur — helper + triggers + fonction d'envoi

**`enqueue_notification(user_id, device_id, title, message, type, order_id, category)`** (SECURITY DEFINER) :
1. si `user_id` non null → check préférences (opt-out catégorie) → sinon `INSERT INTO notifications`.
2. lit URL+secret+clé anon dans `private.app_settings`.
3. `PERFORM net.http_post(url, headers{Content-Type, Authorization: Bearer <anon>, apikey: <anon>, x-webhook-secret: <secret>}, body{userId, deviceId, title, message, data})`.

**Triggers** sur la table métier (`AFTER INSERT` → notifie admins ; `AFTER UPDATE OF status` → notifie client ; `AFTER UPDATE OF assignee` → notifie l'assigné) et sur `contact_messages`.

**Fonction `send-push`** (Deno Edge Function ou Node Vercel) :
- garde par **`x-webhook-secret`** (compare à un secret d'env).
- résout les tokens : `device_tokens WHERE user_id = $userId` (tous ses appareils) **UNION** dernier token `WHERE device_id = $deviceId`.
- POST batch vers `https://exp.host/--/api/v2/push/send` (+ `Authorization: Bearer <EXPO_ACCESS_TOKEN>` si Enhanced Security activée).
- **nettoyage** : si ticket Expo `details.error === "DeviceNotRegistered"` → `DELETE` le token.

---

## 6. Mobile (Expo)

```bash
npx expo install expo-notifications expo-dev-client    # (+ expo-device, expo-constants déjà là)
```
- `app.json` → plugin `expo-notifications` (icône/couleur) + `android.googleServicesFile` (cf. §7).
- `lib/device-id.ts` : UUID persistant en AsyncStorage.
- `lib/push.ts` : `setNotificationHandler` (foreground), `registerForPushNotifications()` =
  permission → `getExpoPushTokenAsync({ projectId })` (projectId depuis `Constants.expoConfig.extra.eas.projectId`) → `apiRegisterDeviceToken(token, deviceId, platform)`.
- **Appeler `registerForPushNotifications` au démarrage ET à la connexion** (`useEffect([user?.id])`) pour rattacher le token au `user_id`.
- Listener de tap → `Notifications.addNotificationResponseReceivedListener` → route vers le suivi via `data.orderId`.
- Au checkout : passer `deviceId` à la création de commande.

---

## 7. Build & credentials — **LA PARTIE LA PLUS PIÉGEUSE**

- ❌ **Le push ne marche PAS dans Expo Go** (SDK 53+). → **dev build** ou **preview build** (`eas build -p android --profile preview`).
- 🤖 **Android = FCM OBLIGATOIRE** (contrainte de la plateforme Google, **pas** de notre stack — Firebase ne sert QUE de « tuyau de livraison » ; le backend reste Supabase, l'hébergement Vercel). Sans ça, `getExpoPushTokenAsync` **échoue silencieusement → 0 token, même permission accordée** (confirmé sur Lumoo). FCM = **2 morceaux distincts** :
  1. **CLIENT → `google-services.json`** (permet à l'app de s'enregistrer et d'**obtenir un token**). Firebase → ajouter une app Android avec le **bon package** → télécharger → **placer dans `apps/mobile/`** (à côté de `app.json`) + `app.json` : `"android": { "googleServicesFile": "./google-services.json" }`. ⚠️ chemin relatif au dossier du `app.json` (monorepo) ; pense à le committer (l'API key dedans est publique, restreinte par package).
  2. **SERVEUR → clé de compte de service FCM V1** (permet à Expo de **livrer** le push). Firebase → ⚙️ Paramètres → **Comptes de service** → générer une clé privée (JSON) → **uploadée dans EAS** : soit `eas credentials` (Android → Push Notifications, interactif), soit le **dashboard Expo** (Project → Credentials → Android → FCM V1 → upload). Pas besoin de rebuild pour cette clé (config serveur).
  3. **Rebuild** (le `google-services.json` est embarqué au build) → réinstaller → le token s'enregistre enfin.
- 🍎 **iOS = APNs** via `eas credentials` (clé APNs).
- 🔑 **Env vars EAS par environnement** : vérifier que `EXPO_PUBLIC_*` (URL/clé Supabase…) sont définis pour l'environnement buildé (un build « development » sans env vars → app qui ne se connecte à rien).
- **Secret webhook** : poser la **même valeur** à 2-3 endroits → `private.app_settings.push_webhook_secret` = secret d'env de la fonction `PUSH_WEBHOOK_SECRET` = header `x-webhook-secret`.

---

## 8. Checklist d'implémentation (ordre conseillé)

1. SQL : `device_tokens` + RPC, `entity.device_id`, `notification_preferences`, `private.app_settings`, `pg_net`.
2. SQL : `enqueue_notification` + triggers. **`REVOKE EXECUTE`** sur enqueue.
3. Déployer la fonction `send-push` + poser les secrets. Renseigner `app_settings` (URL **complète**, secret, clé anon).
4. Mobile : install, `push.ts`, wiring (_layout démarrage + login, checkout deviceId, tap handler), écran préférences.
5. **Credentials FCM/APNs** + env vars EAS.
6. Build **preview**, installer sur **appareil réel**, accepter la permission → token enregistré.
7. Tester (cf. §10) → `sent` + notif reçue.
8. Anti-doublon : si on passe aux triggers, **supprimer les appels app-level** de création de notif.

---

## 9. Pièges rencontrés (cheatsheet — relire avant de débugger 1h)

- **0 token sur Android, permission accordée** → 99% **FCM non configuré** (cf. §7).
- **`getExpoPushTokenAsync`** : ne marche pas en Expo Go (SDK53+), ni sur simulateur iOS → appareil réel + build.
- **Supabase Edge Function créée via dashboard** → le **slug est aléatoire** (ex: `rapid-service`), pas le nom affiché ! L'URL réelle = `…/functions/v1/<slug>`. Le slug **n'est pas renommable** → soit pointer `app_settings` sur l'URL complète réelle, soit (re)déployer via CLI avec le bon nom (`supabase functions deploy <name>`).
- **Oublier de remplacer le boilerplate** : l'éditeur dashboard pré-remplit un `Deno.serve` "Hello {name}" → si on ne colle pas son code, la fonction répond `{"message":"Hello undefined!"}`.
- **Verify JWT (Edge Function Supabase)** : par défaut ON → la passerelle renvoie `401 INVALID_CREDENTIALS` si pas de JWT. Deux options : **désactiver Verify JWT**, OU **envoyer la clé anon/publishable** en `Authorization: Bearer` + `apikey` (la nouvelle clé `sb_publishable_…` est acceptée). La vraie protection reste le `x-webhook-secret`.
- **`pg_net`** : il faut l'**extension activée** (`CREATE EXTENSION pg_net`) ; les appels sont **asynchrones** (ne bloquent/échouent pas le trigger) ; le résultat est dans `net._http_response` (`status_code = null` = hôte injoignable / DNS).
- **Ordre des migrations** : `enqueue_notification` dépend de `notification_preferences`, `private.app_settings` et `pg_net` → tout créer **avant** ; `check_function_bodies` (ON par défaut) fait échouer la création si une dépendance manque.
- **`auth.users` vs table profil** : après une migration Supabase Auth, la table maison `users` peut être **supprimée** au profit de `public.profiles` (id `uuid` = `auth.users.id`). Adapter les FK (`auth.users(id)`) et les lookups de rôle (`profiles`).
- **Vercel** : pas de copier-coller (fonction = fichier `api/*.ts` déployé au push) ; il faut **accès au dashboard** pour les env vars. Si pas d'accès Vercel → préférer une **Edge Function Supabase**.
- **EAS env « development »** souvent vide → l'app dev ne se connecte à rien. Le profil **preview** charge mieux les env vars (selon config).
- **Monorepo npm** : ajouter la dépendance dans `package.json` + **`npm install` à la racine** (pas `npm install <pkg>` dans le sous-dossier, ça casse `node_modules/.bin`).
- **GitHub « secret detected » sur `google-services.json`** : c'est l'**API key Android** (`AIzaSy…`). **Faible risque** — elle est embarquée dans chaque APK, ce n'est pas un vrai secret. Fix = la **restreindre** dans Google Cloud Console (Application restrictions: Android + package + SHA‑1 ; API restrictions: Firebase/FCM), puis fermer l'alerte. Le **vrai** secret = la **clé de compte de service** (`private_key`, `type: service_account`) → **JAMAIS** dans le repo, uniquement dans EAS. (Option « zéro clé dans git » : retirer `google-services.json` du repo et l'injecter via une *file env var* EAS.)

---

## 10. Diagnostic SQL (cheatsheet)

```sql
-- Un token s'est-il enregistré ?
SELECT count(*) FROM device_tokens;
SELECT token, device_id, user_id, platform, updated_at FROM device_tokens ORDER BY updated_at DESC LIMIT 5;

-- Déclencher + voir l'appel HTTP sortant
UPDATE orders SET status='confirmee' WHERE id = '<id d''une commande liée au token>';
SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 3;
--   200 {"sent":true}            -> OK, notif envoyée
--   200 {"skipped":"no token"}   -> pipeline OK mais aucun token ne matche (commande != appareil/compte)
--   401                          -> secret/JWT
--   404                          -> mauvaise URL/slug ou fonction pas déployée
--   null                         -> hôte injoignable (URL fausse)

-- Audit sécurité RLS
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('device_tokens','notification_preferences','notifications');
SELECT schemaname,tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('device_tokens','notification_preferences','notifications');
SELECT has_function_privilege('anon','public.enqueue_notification(uuid,text,text,text,text,text,text)','EXECUTE');  -- doit être false
```

---

## TL;DR pour un nouveau projet
1. Tables + RLS (token verrouillé) + RPC d'enregistrement.
2. `enqueue_notification` + triggers (+ REVOKE).
3. Fonction `send-push` (secret + résolution token + cleanup) + `app_settings`.
4. Mobile : `expo-notifications`, register au démarrage/login, deviceId au checkout.
5. **FCM (Android) + APNs (iOS) + build preview** ← c'est là que ça coince à 90%.
6. Tester avec `net._http_response`.
