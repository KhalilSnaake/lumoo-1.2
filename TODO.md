# TODO

- [x] Supprimer la colonne `emoji` de la table `categories` dans `supabase-schema.sql`.
- [x] Supprimer la colonne `emoji` de la table `categories` dans `update_schema.sql`.
- [x] Mettre à jour `src/types/category.ts` pour supprimer `emoji` du type.
- [x] Mettre à jour `src/context/CategoryContext.tsx` (type, add/update, mapping rowToCategory).
- [x] Mettre à jour l’UI (`AdminPanel.tsx` n’utilisait pas `emoji` sur les catégories).
- [x] Rechercher et corriger toute autre occurrence de `c.emoji` / `emoji` lié aux catégories.
- [x] Corriger `ProductContext.tsx` : `addProduct` récupérait mal `category_id` (causait l’échec de création).
- [x] Corriger `ProductContext.tsx` : `updateProduct` faisait un `select('*')` sans la jointure `category`.
- [x] Corriger `ProductContext.tsx` : `seedProducts` insérait `emoji` dans `categories` (colonne supprimée).
- [ ] Vérifier le build/typecheck.

