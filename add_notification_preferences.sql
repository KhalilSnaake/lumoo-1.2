-- add_notification_preferences.sql
-- Garde-fou : opt-out par catégorie. (Quiet hours / plafond hebdo : volontairement
-- hors périmètre pour l'instant.)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  order_updates BOOLEAN NOT NULL DEFAULT true,   -- suivi de commande (client)
  promotions    BOOLEAN NOT NULL DEFAULT true,   -- offres & nouveautés (phase 2)
  admin_ops     BOOLEAN NOT NULL DEFAULT true,   -- nouvelles commandes / messages (admin)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON notification_preferences FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "own prefs insert" ON notification_preferences FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "own prefs update" ON notification_preferences FOR UPDATE USING (auth.uid()::text = user_id);
