-- =============================================
-- LUMOO - Marquer certains produits comme "populaires"
-- Exécutez ce script DANS LA FENÊTRE SQL EDITOR de Supabase,
-- après avoir exécuté add_is_popular_to_products.sql
-- =============================================

-- Marquer les produits les plus vendus comme populaires
UPDATE products SET is_popular = true WHERE id IN (1, 2, 3, 4, 13, 14, 15, 25, 26, 29, 30, 32);

-- Vérification
SELECT id, name, is_popular FROM products WHERE is_popular = true ORDER BY id;