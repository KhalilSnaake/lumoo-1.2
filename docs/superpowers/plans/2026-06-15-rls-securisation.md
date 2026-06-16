# Plan de remédiation — Sécurisation RLS (Supabase)

**Date :** 2026-06-15
**Projet :** Lumoo (lumoo.ml) — e-commerce Mali, Supabase + clé `anon` publique
**Contexte :** pré-lancement (0 commande, 0 client) → fenêtre idéale pour durcir sans casser de flux réel.

## 1. Problème confirmé (état LIVE)

La clé `anon` est publique (présente dans le JS web + l'app mobile). La **RLS est la seule protection**. Or toutes les tables ont des politiques `USING (true)` / sans restriction :

| Table | Politiques actuelles | Risque |
|---|---|---|
| `orders` / `order_items` | read/insert/update/**delete** = `true` | Lecture/modif/suppression de **toutes** les commandes (nom, tél, GPS, preuves de paiement) par quiconque a la clé anon |
| `products` | `Admin CRUD … USING(true)` | Modification/suppression du catalogue par n'importe qui |
| `notifications` | ALL `true` | Lecture/écriture de toutes les notifs |
| `contact_messages` | read/update/delete `true` | Lecture/suppression des messages clients |

Comportement réel : `apiGetOrders()` charge **toutes** les commandes côté client (sans filtre) → fuite effective, pas seulement théorique.

## 2. Flux à préserver (vérifiés dans le code)

- **Checkout invité** : `createOrder({ userId: user?.id, ... })` → `user_id` peut être `null` (pas connecté). L'INSERT `orders`/`order_items` doit rester possible pour `anon`.
- **Notification de commande** : le checkout insère une notification adressée à l'admin → l'INSERT `notifications` doit rester possible pour `anon`.
- **Formulaire de contact** : INSERT `contact_messages` public.
- **Catalogue** : SELECT `products` public.
- **Admin panel** : passe par la session de l'admin + `is_admin()` (fonction de la migration auth) → conservé.

## 3. Conception RLS cible

Principe : **INSERT** large là où un invité doit pouvoir agir (checkout, contact, notif) ; **lecture/écriture sensible** restreinte au **propriétaire** (`user_id = auth.uid()`) ou à l'**admin** (`is_admin()`).

| Table | INSERT | SELECT | UPDATE | DELETE |
|---|---|---|---|---|
| `products` | admin | public | admin | admin |
| `orders` | invité/own (`user_id null` ou `= auth.uid()`) | owner + admin | admin | admin |
| `order_items` | autorisé | via commande parente (owner + admin) | admin | admin |
| `notifications` | autorisé | destinataire + admin | destinataire + admin | admin |
| `contact_messages` | public | admin | admin | admin |

## 4. Conséquence : suivi de commande (Phase 2)

Verrouiller `orders.SELECT` casse le suivi invité (qui lit aujourd'hui toutes les commandes en mémoire). **Phase 2** (après le verrouillage) : fonction `SECURITY DEFINER` `track_order(order_id, delivery_code)` qui renvoie **une seule** commande si le code de livraison correspond, + adaptation de `OrderTracker` pour l'appeler. Décision produit à prendre : exiger le **code de livraison** en plus du n° (recommandé — sinon n'importe qui devine/énumère les n°).

Pré-lancement (0 commande) → le suivi « cassé » temporairement n'impacte aucun client réel.

## 5. Application & tests

1. Appliquer le SQL (Phase 1) dans le SQL Editor de la prod.
2. Tester :
   - Checkout invité (créer une commande sans être connecté) → ✅ fonctionne.
   - Admin connecté → voit toutes les commandes, change un statut → ✅.
   - Catalogue visible sans connexion → ✅.
   - Un compte **non-admin** ne voit **pas** les commandes des autres (vérifier via `select * from orders` connecté en client) → renvoie 0/own.
3. Phase 2 : fonction `track_order` + `OrderTracker`.

## 6. Rollback

Chaque bloc `drop policy if exists` + `create policy` est rejouable. En cas de blocage d'un flux, ré-ouvrir temporairement la politique concernée (`using (true)`) le temps de corriger.
```
```
```sql
-- exemple de réouverture d'urgence d'une seule table
-- create policy "tmp_open_select" on public.orders for select using (true);
```
