-- LUMOO - Ajouter la colonne emoji à la table order_items
-- Exécutez ce script dans le SQL Editor de Supabase si vous souhaitez que la base de données dispose de la colonne emoji.
-- Sinon, le code de l'application a été corrigé pour ne plus dépendre de cette colonne lors des insertions/mises à jour.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '📦';
