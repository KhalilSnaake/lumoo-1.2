-- =============================================
-- LUMOO - Migration products.category TEXT → category_id INTEGER
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Vérifier la structure actuelle de la table products
-- (décommentez pour voir la structure)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;

-- 2. Si la colonne "category" existe en TEXT/STRING, on la convertit
DO $$
BEGIN
  -- Cas 1 : la colonne s'appelle "category" (TEXT) — on la renomme en "category_id"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category' AND data_type IN ('text', 'character varying')
  ) THEN
    -- D'abord on ajoute la colonne category_id (INTEGER) si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'category_id'
    ) THEN
      ALTER TABLE products ADD COLUMN category_id INTEGER;
    END IF;

    -- On mappe les valeurs textuelles 'alimentaire' et 'legumes' vers les IDs des catégories
    UPDATE products p
    SET category_id = c.id
    FROM categories c
    WHERE p.category::text = c.slug;

    -- Pour les produits dont la valeur ne matche aucun slug, on tente avec le nom
    UPDATE products p
    SET category_id = c.id
    FROM categories c
    WHERE p.category_id IS NULL
      AND LOWER(p.category::text) = LOWER(c.name);

    -- On supprime l'ancienne colonne
    ALTER TABLE products DROP COLUMN category;

    RAISE NOTICE 'Colonne category (TEXT) migrée vers category_id (INTEGER)';
  END IF;

  -- Cas 2 : category_id existe déjà mais sans foreign key, on l'ajoute
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name LIKE '%category_id%fkey%'
  ) THEN
    -- On tente d'ajouter la foreign key (peut échouer si les données ne sont pas cohérentes)
    BEGIN
      ALTER TABLE products
        ADD CONSTRAINT products_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES categories(id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK non ajoutée (données incohérentes) : %', SQLERRM;
    END;
  END IF;
END $$;

-- 3. S'assurer que RLS est activé et que les policies existent
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Admin CRUD products" ON products;

CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin CRUD products" ON products FOR ALL USING (true);

-- 4. Vérification finale
SELECT
  c.slug AS categorie,
  c.name AS nom,
  COUNT(p.id) AS nombre_produits
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY c.slug;
