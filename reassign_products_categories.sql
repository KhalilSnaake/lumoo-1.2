-- =============================================
-- LUMOO - Réassignation de produits vers Épices & Produits laitiers
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Créer les nouvelles catégories (idempotent)
INSERT INTO categories (name, slug)
VALUES ('Épices', 'epices')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug)
VALUES ('Produits laitiers', 'produits-laitiers')
ON CONFLICT (slug) DO NOTHING;

-- 2. Récupérer les IDs
DO $$
DECLARE
  cat_alim_id    INTEGER;
  cat_epices_id  INTEGER;
  cat_lait_id    INTEGER;
BEGIN
  SELECT id INTO cat_alim_id   FROM categories WHERE slug = 'alimentaire'       LIMIT 1;
  SELECT id INTO cat_epices_id FROM categories WHERE slug = 'epices'           LIMIT 1;
  SELECT id INTO cat_lait_id   FROM categories WHERE slug = 'produits-laitiers' LIMIT 1;

  IF cat_epices_id IS NULL OR cat_lait_id IS NULL OR cat_alim_id IS NULL THEN
    RAISE EXCEPTION 'Catégories manquantes (alimentaire / epices / produits-laitiers)';
  END IF;

  -- 3. Déplacer des produits d'ALIMENTAIRE → ÉPICES
  --    (basé sur le nom du produit : tout ce qui contient "piment", "épice", "curry", "gingembre", etc.)
  UPDATE products
  SET category_id = cat_epices_id
  WHERE category_id = cat_alim_id
    AND (
      LOWER(name) LIKE '%piment%'
      OR LOWER(name) LIKE '%épice%'
      OR LOWER(name) LIKE '%epice%'
      OR LOWER(name) LIKE '%curry%'
      OR LOWER(name) LIKE '%gingembre%'
      OR LOWER(name) LIKE '%curcuma%'
      OR LOWER(name) LIKE '%cannelle%'
      OR LOWER(name) LIKE '%poivre%'
      OR LOWER(name) LIKE '%thé%'
      OR LOWER(name) LIKE '%the%'
    );

  -- 4. Déplacer des produits d'ALIMENTAIRE → PRODUITS LAITIERS
  --    (basé sur le nom : "lait", "beurre", "fromage", "yaourt", "crème")
  UPDATE products
  SET category_id = cat_lait_id
  WHERE category_id = cat_alim_id
    AND (
      LOWER(name) LIKE '%lait%'
      OR LOWER(name) LIKE '%beurre%'
      OR LOWER(name) LIKE '%fromage%'
      OR LOWER(name) LIKE '%yaourt%'
      OR LOWER(name) LIKE '%yogourt%'
      OR LOWER(name) LIKE '%crème%'
      OR LOWER(name) LIKE '%creme%'
      OR LOWER(name) LIKE '%fromage%'
    );

  RAISE NOTICE 'Migration des produits terminée.';
END $$;

-- 5. Résumé final : nombre de produits par catégorie
SELECT
  c.slug AS categorie,
  c.name AS nom,
  COUNT(p.id) AS nombre_produits
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY c.slug;

-- 6. Détail des produits dans les nouvelles catégories
SELECT id, name, price, unit, category_id
FROM products
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('epices', 'produits-laitiers')
)
ORDER BY category_id, name;
