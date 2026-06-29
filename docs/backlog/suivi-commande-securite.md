# Backlog — Suivi de commande : sécurité du couple n° + code

> **Statut** : à reprendre. Décision d'orientation prise (garder 2 facteurs), reste à
> **vérifier le rate-limiting** puis décider du durcissement / du suivi à 2 niveaux.
> Ouvert le 2026-06-29.

## Question posée
Faut-il suivre une commande avec **le n° de commande seul**, ou **n° + code de livraison** (comme aujourd'hui) ?

## État actuel (vérifié dans le code)
- Le suivi **exige déjà les deux** : `track_order(p_order_id, p_delivery_code)`.
  - UI : `apps/mobile/src/app/suivi.tsx` (les 2 champs sont obligatoires ; auto-rempli via lien profond `?id=…&code=…`).
  - Contrat : `packages/core/src/services/api.ts` → `apiTrackOrder()` (RPC `track_order`).
- **Génération du n°** (`api.ts` `generateOrderId`) : `LUM-${Date.now() en base36}-${4 car. Math.random()}`.
  - ⇒ 1ʳᵉ moitié = **heure de commande → prévisible / quasi-séquentielle** ; seule la 2ᵉ moitié (~1,7 M, et `Math.random` non-crypto) est « secrète ».
- **Code livraison** (`api.ts` `apiCreateOrder`) : `Math.floor(1000 + Math.random()*9000)` = **4 chiffres** (9000 combinaisons, `Math.random`).
- Le code a un **double rôle** : (1) ouvrir le suivi, (2) **preuve de réception** donnée au livreur. La page de suivi **affiche** ce code.
- Le suivi expose : nom, **adresse, GPS**, tél. livreur, contenu, montant, **+ le code**.
- `track_order` = fonction **SECURITY DEFINER en base** (issue de la sécurisation RLS, **pas dans les `.sql` du repo**).

## Décision d'orientation : **garder les 2 facteurs** (ne PAS passer au n° seul)
1. **Le n° fuite** (WhatsApp, reçus, captures, support) → mauvaise clé d'accès unique.
2. Le suivi expose de la **PII sensible** (adresse + GPS + tél + « paie cash ») → risque vol/sécurité réel à Bamako → mérite une serrure.
3. **Décisif** : le code est **aussi** la preuve de réception, et la page l'**affiche**. Si le n° seul donnait accès, n'importe qui lisant le n° lirait le code → la confirmation de livraison ne vaut plus rien. Les 2 rôles sont **couplés**.
- → n° seul = **régression de sécurité sans gain UX** (chemin courant déjà auto-rempli).

## À corriger (indépendamment du choix)
- **A. Secrets faibles / `Math.random`** → générer code (et partie aléatoire du n°) **côté serveur, CSPRNG** (`gen_random_bytes`). Le client ne doit pas pouvoir prédire/choisir.
- **B. Brute-force — PRIORITÉ #1 À VÉRIFIER** : `track_order` limite-t-il les tentatives (lock après N codes faux / throttle IP) ? 9000 combinaisons + n° devinable = cassable en secondes **sans** rate-limiting. Un code 4 chiffres n'est OK **qu'avec** verrouillage strict.
- **C. Fuite par lien/capture** : le code est en clair dans l'URL et affiché → captures partagées sur WhatsApp = fuite. Mitiger : code derrière un tap (« Afficher mon code » + avertissement), ne pas mettre le code dans une URL partageable.

## Option recommandée : suivi à **2 niveaux**
- **N° seul** → **statut + barre de progression uniquement** (zéro PII). Partageable, sans danger.
- **N° + code** → débloque les **détails complets** (adresse, GPS, contact livreur, code).
- Donne le confort du « n° seul » pour « où en est ma commande ? » tout en gardant la PII derrière le code.

## Piste plus propre (si on investit) : **découpler les 2 rôles**
- **Token de suivi** long, aléatoire, généré serveur → accès lecture du suivi.
- **PIN de livraison** 4 chiffres → handover uniquement, visible **seulement** par le propriétaire connecté (jamais sur une page atteignable par lien).

## Prochaines étapes (à la reprise)
1. **Lire la définition de `track_order` en base** (via Supabase MCP) → confirmer/infirmer le rate-limiting (point B).
2. Selon B : ajouter verrouillage anti-brute-force si absent.
3. Décider : suivi à 2 niveaux (option reco) et/ou découplage token/PIN.
4. Durcir A (CSPRNG serveur) + C (ne pas exposer le code via URL/capture).

## Voir aussi
- [`apps/mobile/src/app/suivi.tsx`](../../apps/mobile/src/app/suivi.tsx) · [`packages/core/src/services/api.ts`](../../packages/core/src/services/api.ts)
- Sécurisation RLS / code livreur : `docs/superpowers/plans/2026-06-15-rls-securisation.md`
