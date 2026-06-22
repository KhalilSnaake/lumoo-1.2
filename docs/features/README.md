# Runbooks par feature

Un fichier par système complexe : **comment ça marche au final, comment le débugger, comment l'étendre**
(l'état réel dans ce repo, pas le plan).

| Feature | Runbook | Statut |
|---|---|---|
| Notifications push + in-app | [`notifications.md`](notifications.md) | Validé 2026-06-22 (reste dev build EAS) |

## Quoi va où

- **Runbook (ici)** = état final + maintenance d'un système (spécifique Lumoo).
- **Plan** = ce qui était à faire, daté → `docs/superpowers/plans/`.
- **Journal d'erreurs** = galères chronologiques (toutes features) → [`../JOURNAL.md`](../JOURNAL.md).
- **Playbook générique** = « comment construire ça sur n'importe quel projet » → `~/.claude/docs/`.

## Ajouter un runbook

Crée `docs/features/<feature>.md` (Vue d'ensemble · Fichiers réels · Décisions/déviations · Sécurité · Débugger · Étendre · Reste à faire), ajoute la ligne au tableau, et un pointeur mémoire si la leçon doit remonter automatiquement.
