-- =============================================
-- LUMOO - Script de mise à jour : ajout du champ is_popular à la table products
-- Exécutez ce script dans le SQL Editor de Supabase
-- =============================================

-- 1. Ajouter la colonne is_popular (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- 2. Index pour optimiser les requêtes de produits populaires
CREATE INDEX IF NOT EXISTS idx_products_is_popular ON products(is_popular) WHERE is_popular = true;

-- 3. (Optionnel) Marquer certains produits comme populaires
-- Décommentez et modifiez les IDs selon vos besoins :
-- UPDATE products SET is_popular = true WHERE id IN (1, 2, 3, 4, 5);

-- 4. Vérification : afficher la structure de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'is_popular';