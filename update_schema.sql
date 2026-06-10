-- Add blocked column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;

-- Add GPS columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- Add products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('alimentaire', 'legumes')),
  emoji TEXT NOT NULL,
  bg_color TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin CRUD products" ON products FOR ALL USING (true);
