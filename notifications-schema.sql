-- 1. Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_order', 'assignment', 'status_change', 'general')),
  order_id TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;

-- 3. Activer RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS sécurisées
DROP POLICY IF EXISTS "Users can see their own notifications" ON notifications;
DROP POLICY IF EXISTS "Internal insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id::text = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (user_id::text = auth.uid()::text OR public.is_admin());

-- Seuls les triggers serveur (SECURITY DEFINER) et les admins peuvent insérer des notifications
CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT WITH CHECK (public.is_admin());
