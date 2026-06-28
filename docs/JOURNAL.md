# Journal d'erreurs — Lumoo

> But : **ne pas refaire la même galère.** À chaque vrai blocage résolu (pas les petites coquilles),
> on ajoute une entrée courte. La règle d'or : **symptôme → cause racine → fix → prévention**.
> La prévention est la ligne la plus importante : c'est elle qu'on relit la prochaine fois.

## Comment s'en servir

- **Avant de débugger** un sujet déjà touché (notif, RLS, build EAS, Supabase, Vercel…), `Ctrl+F` ici d'abord.
- **Une galère = une entrée.** Courte. Pour les détails profonds, on **lie** vers le runbook concerné
  (`docs/features/…`) ou le playbook générique, on ne recopie pas.
- Les entrées les plus récentes en **haut**.
- Détails approfondis notif : voir [`docs/features/notifications.md`](features/notifications.md)
  et le playbook réutilisable [`docs/notifications-playbook.md`](notifications-playbook.md) (§9 = cheatsheet pièges) — copie cross-projet maintenue en phase dans `~/.claude/docs/`.

## Modèle d'entrée (copier-coller)

```md
### YYYY-MM-DD — <Domaine> — <titre court>
- **Symptôme** : ce qu'on voyait (message d'erreur, comportement).
- **Cause racine** : le vrai pourquoi (pas le symptôme).
- **Fix** : ce qui a corrigé (+ `commit` ou fichier).
- **Prévention** : la règle actionnable pour ne plus retomber dedans.
- **Voir aussi** : lien runbook / playbook (optionnel).
```

---

## Entrées

### 2026-06-28 — Icônes & Splash Android/iOS — coins blancs + splash rogné
- **Symptôme** : (1) icône d'app laisse du **blanc dans les coins** sur certains téléphones ; (2) **splash** affiche le logo **coupé** à droite (« …de Proximi**té** » tronqué).
- **Cause racine** :
  - **Icône adaptative Android** : `adaptiveIcon.backgroundColor` était `#ffffff` + premier plan = **cercle** vert sur transparent. Les launchers à masque **carré/squircle** montrent le fond blanc dans les coins (un masque rond, lui, le cachait → « seulement certains téléphones »).
  - **Icône iOS** (`icon.png`) : image **opaque** cercle-sur-carré-blanc → iOS masque en carré arrondi et révèle les coins blancs.
  - **Splash Android 12+** : le plugin `expo-splash-screen` compose l'image dans un canevas **288 dp**, puis Android l'affiche en `windowSplashScreenAnimatedIcon` **masqué en cercle ~192 dp**. Tout ce qui dépasse ce cercle est rogné. Un logo **large ou haut** + un `imageWidth` trop grand (260) → déborde du cercle → coupé.
  - **Icône de notif** : pointait sur `icon.png` (opaque) → Android n'utilise que l'alpha → **carré blanc** (cf. playbook §9).
- **Fix** (commit à venir) : `adaptiveIcon.backgroundColor` = **`#A0C20C`** (vert exact du panier) + premier plan = **panier blanc seul** ; `icon.png` refait en **vert plein cadre** ; splash en **fond blanc** + logo empilé carré centré **dans la zone sûre** + `imageWidth` **260 → 165** (tout tient dans le cercle) ; notif → `notification-icon.png` (panier **blanc/transparent**).
  - ⚠️ **Mesuré sur appareil** : le cercle visible réel était **~168 dp** (pas 192 dp), donc `imageWidth` 200 rognait encore les extrémités basses (« L » de Lumoo à gauche, fin du logo à droite). Valeur retenue **165**. Le point le plus loin du centre dans ce logo est à **0,433 × largeur** (bas-droite = fin « moo »/tagline) ⇒ `imageWidth × 0,433` doit rester **< rayon visible**.
- **Prévention** :
  - **Icône adaptative** = fond **plein** (couleur ou image full-bleed), jamais blanc derrière un premier plan qui ne remplit pas le canevas. Le premier plan = le **mark seul** sur transparent.
  - **Splash Android 12** = penser **cercle ~192 dp** : le logo doit **tenir dans un cercle centré**, pas juste dans un carré. Un logo large/haut sera rogné. `imageWidth` ≈ 200 max pour ce logo ; idéalement viser un **mark rond** (remplit le cercle) ou réduire jusqu'à ce que tout rentre. Fond = même couleur que le padding du logo → un éventuel rognage de bord devient invisible.
  - Tout ça = **assets natifs → rebuild EAS** (jamais OTA / jamais visible dans Expo Go).
- **Voir aussi** : playbook §9 (piège icône notif) ; `app.json` (`adaptiveIcon`, `expo-splash-screen`, `expo-notifications`).

### 2026-06-22 — Notif/FCM — 0 token sur Android malgré permission accordée
- **Symptôme** : `device_tokens` reste vide même avec la permission notifications **acceptée** ; aucun push possible.
- **Cause racine** : **FCM non configuré**. Sur Android, `getExpoPushTokenAsync` a besoin du `google-services.json` (côté app) pour obtenir un token → sans lui il **échoue silencieusement** (l'appel est en `void`, l'erreur passe inaperçue).
- **Fix** : projet Firebase + app `ml.lumoo.app` → `google-services.json` dans `apps/mobile/` + `app.json` `android.googleServicesFile` (commit `822d495`) ; **clé de compte de service** uploadée dans EAS (FCM V1) ; **rebuild preview**.
- **Prévention** : Android push = **FCM obligatoire**, en **2 morceaux** (`google-services.json` côté app = token ; clé service account dans EAS = livraison). « Permission accordée » ≠ « token obtenu ». Toujours tester sur **dev/preview build** (jamais Expo Go SDK 53+).
- **Voir aussi** : [runbook notif](features/notifications.md) · playbook §7.

### 2026-06-22 — Notif/FCM — EAS refuse la clé (`"private_key": Required`)
- **Symptôme** : upload « FCM V1 Service Account Key » dans EAS → erreur `"private_key": Required`.
- **Cause racine** : mauvais fichier — on a uploadé `google-services.json` (config **client**, sans `private_key`) au lieu de la **clé de compte de service**.
- **Fix** : uploader le JSON Firebase → Paramètres → **Comptes de service** → « Générer une clé privée » (contient `"type":"service_account"` + `"private_key"`).
- **Prévention** : 2 JSON différents et faciles à confondre — `google-services.json` (client → va dans l'app) vs clé de compte de service (serveur → va dans EAS).

### 2026-06-22 — Notif/Invité — push invité « skipped: no token »
- **Symptôme** : push OK en connecté, **rien en invité** ; `net._http_response` = `200 {"skipped":"no token"}`.
- **Cause racine** : l'invité est résolu par `device_id` ; les commandes invité testées avaient `device_id` **NULL** (passées avant le build qui l'enregistre) ou **différent** — la **désinstallation régénère** le `device_id` (stocké en AsyncStorage).
- **Fix** : tester avec une commande invité **passée depuis le build courant** → son `orders.device_id` = `device_tokens.device_id`.
- **Prévention** : pour viser un invité, la commande doit avoir le **même `device_id`** qu'un token. Réinstaller l'app = nouveau device_id → anciennes commandes invité orphelines.
- **Voir aussi** : playbook §9.

### 2026-06-22 — Notif/Sécurité — `enqueue_notification` appelable par le client + INSERT notifs ouvert
- **Symptôme** : audit — une fonction `SECURITY DEFINER` (`enqueue_notification`) était exécutable par `anon`/`authenticated`, et la table `notifications` avait une policy d'INSERT ouverte (`WITH CHECK (true)`).
- **Cause racine** : un client pouvait donc **forger des notifs in-app et des pushs** (la fonction tourne avec les droits du définisseur).
- **Fix** : `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` sur `enqueue_notification` + `DROP POLICY "notifications_insert_any"` (commit `8863681`). Les triggers l'appellent en interne → rien ne casse.
- **Prévention** : toute fonction `SECURITY DEFINER` appelée **uniquement par des triggers** → `REVOKE EXECUTE` du public. Une table alimentée par triggers ne doit **pas** avoir de policy INSERT client.
- **Voir aussi** : [runbook notif §Sécurité](features/notifications.md) · playbook §4.

### 2026-06-22 — Notif/Edge Function — l'appel `pg_net` vers `send-push` renvoyait 401/404
- **Symptôme** : trigger OK mais `net._http_response` montrait `404` (puis `401`) ; aucun push.
- **Cause racine** : deux pièges cumulés. (1) Une Edge Function **créée via le dashboard** reçoit un **slug aléatoire** (`rapid-service`), **pas** le nom affiché `send-push` → l'URL `…/functions/v1/send-push` n'existe pas. (2) **Verify JWT est ON** par défaut → la passerelle exige une clé/JWT, d'où le `401`.
- **Fix** : `private.app_settings.functions_base_url` = **URL complète réelle** (`…/functions/v1/rapid-service`) + ajout d'une clé `anon_key` envoyée en `Authorization: Bearer` **et** `apikey` (commit `9b57446`). La vraie protection reste le header `x-webhook-secret`.
- **Prévention** : après déploiement d'une Edge Function, **copier l'URL réelle** depuis le dashboard (slug ≠ nom). Si Verify JWT est ON, joindre la clé anon/publishable. Sinon, (re)déployer en CLI avec le bon nom et `--no-verify-jwt`.
- **Voir aussi** : [runbook notif §Déploiement](features/notifications.md) · playbook §9.

### 2026-06-22 — Notif/Déploiement — `send-push` prévu sur Vercel, impossible à configurer
- **Symptôme** : plan initial = fonction serverless Vercel (`api/send-push.ts`). Blocage : impossible de poser les env vars (`SERVICE_ROLE_KEY`, secret…).
- **Cause racine** : **pas d'accès au dashboard Vercel** du projet → on ne pouvait ni poser les secrets ni vérifier le déploiement. Le choix d'hébergement avait été fait sans valider l'accès.
- **Fix** : `send-push` **repassé en Edge Function Supabase** (Deno) — compte Supabase, lui, accessible (commit `9f8f2eb`).
- **Prévention** : avant de choisir **où** héberger une fonction, valider qu'on a **l'accès opérationnel** (dashboard + secrets + logs) à cette plateforme. « Ça marche en théorie » ≠ « je peux le déployer et le débugger ».
- **Voir aussi** : playbook §7.
