-- Add blocked column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;

-- Add GPS columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- Add categories table (used by CategoryContext)
ALTER TABLE categories DROP COLUMN IF EXISTS emoji;
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);



ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admin CRUD categories" ON categories FOR ALL USING (true);

-- Add products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  image_url TEXT,
  labels TEXT,
  stock_quantity INTEGER,
  bg_color TEXT,
  in_stock BOOLEAN DEFAULT true,
  published BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration idempotente : ajoute is_popular aux bases déjà créées
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_is_popular ON products(is_popular) WHERE is_popular = true;


-- Enable RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin CRUD products" ON products FOR ALL USING (true);
