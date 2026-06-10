-- =============================================
-- LUMOO - Supprimer la colonne emoji de la table categories
-- Exécutez ce script dans le SQL Editor de Supabase
-- =============================================

-- Supprimer la colonne emoji si elle existe
ALTER TABLE categories DROP COLUMN IF EXISTS emoji;

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'categories' ORDER BY ordinal_position;