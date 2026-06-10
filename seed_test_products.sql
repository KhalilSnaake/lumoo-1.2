-- =============================================
-- LUMOO - Insertion de produits de test
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. S'assurer que les catégories existent
INSERT INTO categories (name, slug)
VALUES ('Alimentaire', 'alimentaire')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug)
VALUES ('Légumes', 'legumes')
ON CONFLICT (slug) DO NOTHING;

-- 2. Récupérer les IDs des catégories
DO $$
DECLARE
  cat_alim_id INTEGER;
  cat_leg_id INTEGER;
BEGIN
  SELECT id INTO cat_alim_id FROM categories WHERE slug = 'alimentaire' LIMIT 1;
  SELECT id INTO cat_leg_id FROM categories WHERE slug = 'legumes' LIMIT 1;

  -- 3. Insérer des produits de test pour ALIMENTAIRE
  INSERT INTO products (name, description, price, unit, category_id, image_url, labels, stock_quantity, bg_color, in_stock, published)
  VALUES
    ('Riz Premium 5kg', 'Riz parfumé de haute qualité, idéal pour tous vos plats.', 4500, 'sac 5kg', cat_alim_id, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=300&h=300&fit=crop', 'Top, Qualité', 100, 'linear-gradient(135deg, #fef3c7, #fefce8)', true, true),
    ('Sucre Blanc 1kg', 'Sucre raffiné de première qualité.', 750, 'kg', cat_alim_id, 'https://images.unsplash.com/photo-1581448670542-a058d2a6a617?q=80&w=300&h=300&fit=crop', '', 100, 'linear-gradient(135deg, #fce7f3, #fff1f2)', true, true),
    ('Huile Végétale 5L', 'Huile de cuisine pure pour tous vos besoins.', 6500, 'bidon 5L', cat_alim_id, 'https://images.unsplash.com/photo-1474979266404-7eaacfbca12b?q=80&w=300&h=300&fit=crop', 'Essentiel', 100, 'linear-gradient(135deg, #d9f99d, #f0fdf4)', true, true)
  ON CONFLICT DO NOTHING;

  -- 4. Insérer des produits de test pour LEGUMES
  INSERT INTO products (name, description, price, unit, category_id, image_url, labels, stock_quantity, bg_color, in_stock, published)
  VALUES
    ('Tomates Fraîches', 'Tomates mûres et juteuses, parfaites pour vos salades.', 500, 'kg', cat_leg_id, 'https://images.unsplash.com/photo-1518977676601-b53f02bad6d5?q=80&w=300&h=300&fit=crop', 'Frais, Top', 100, 'linear-gradient(135deg, #fecaca, #fff1f2)', true, true),
    ('Oignons', 'Oignons frais de qualité, essentiels en cuisine.', 400, 'kg', cat_leg_id, 'https://images.unsplash.com/photo-1508747703725-7197771375a0?q=80&w=300&h=300&fit=crop', '', 100, 'linear-gradient(135deg, #fef3c7, #fefce8)', true, true),
    ('Patates Douces', 'Patates douces locales, chair orange et sucrée.', 450, 'kg', cat_leg_id, 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=300&h=300&fit=crop', 'Bio, Local', 100, 'white', true, true)
  ON CONFLICT DO NOTHING;
END $$;

-- 5. Vérification
SELECT
  c.slug AS categorie,
  COUNT(p.id) AS nombre_produits
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.slug
ORDER BY c.slug;
