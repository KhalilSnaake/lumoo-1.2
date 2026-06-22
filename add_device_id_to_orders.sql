-- add_device_id_to_orders.sql
-- Lien commande -> appareil (non sensible). Permet de pousser un client invité
-- (sans compte) via le token du device utilisé au checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_device_id ON orders(device_id);
