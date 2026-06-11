-- =============================================
-- LUMOO - Schéma Base de Données Supabase
-- Copiez-collez ce script dans le SQL Editor de Supabase
-- =============================================

-- 1. Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client', 'livreur')),
  avatar TEXT NOT NULL DEFAULT '👤',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table des commandes
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('orange_money', 'moov_money', 'wave', 'livraison')),
  payment_phone TEXT DEFAULT '',
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Champs pour les preuves de paiement
  payment_proof_url TEXT,
  payment_proof_file_name TEXT,
  payment_proof_uploaded_at TIMESTAMPTZ
);

-- 3. Table des articles de commande
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT ''
);

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 5. Activer RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 6. Politiques RLS - Permettre tout en lecture/écriture (publique pour l'app)
-- En production, restreignez ces politiques !
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Public insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Public delete users" ON users FOR DELETE USING (true);

CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Public delete orders" ON orders FOR DELETE USING (true);

CREATE POLICY "Public read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update order_items" ON order_items FOR UPDATE USING (true);
CREATE POLICY "Public delete order_items" ON order_items FOR DELETE USING (true);

-- 7. Table des catégories
ALTER TABLE categories DROP COLUMN IF EXISTS emoji;
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies (open for now, align with products/admin CRUD)
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admin CRUD categories" ON categories FOR ALL USING (true);

-- 8. Table des publicités
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position TEXT NOT NULL CHECK (position IN ('top', 'middle', 'sidebar', 'footer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour les publicités
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ads" ON ads FOR SELECT USING (true);
CREATE POLICY "Admin CRUD ads" ON ads FOR ALL USING (true);

-- 9. Table des messages de contact
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  responded_at TIMESTAMPTZ,
  response TEXT
);

-- Index pour les messages de contact
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read ON contact_messages(is_read);

-- RLS pour les messages de contact
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Remove any existing restrictive policies
DROP POLICY IF EXISTS "Public read contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Public insert contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Admin update contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow authenticated users to read their own messages" ON contact_messages;

-- Create new policies with proper admin access
CREATE POLICY "Allow public insert for contact form submissions"
ON contact_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin full access to contact_messages"
ON contact_messages FOR ALL
USING (true);

-- Simple policy for all users to read messages (public for admin panel)
CREATE POLICY "Public read contact_messages"
ON contact_messages FOR SELECT
USING (true);

-- 10. Insérer l'admin par défaut
INSERT INTO users (id, name, email, phone, password, role, avatar)
VALUES ('USR-ADMIN-001', 'Admin Lumoo', 'admin@lumoo.ml', '+223 77 99 68 58', 'admin123', 'admin', '👨‍💼')
ON CONFLICT (id) DO NOTHING;