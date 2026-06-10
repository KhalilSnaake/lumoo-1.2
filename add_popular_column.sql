-- =============================================
-- LUMOO - Ajout de la colonne is_popular aux produits
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Ajouter la colonne is_popular (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- 2. (Optionnel) Index pour optimiser les requêtes de produits populaires
CREATE INDEX IF NOT EXISTS idx_products_is_popular ON products(is_popular) WHERE is_popular = true;

-- 3. Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'is_popular';
