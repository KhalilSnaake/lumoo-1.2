-- add_notification_types.sql
-- Élargit les types autorisés (corrige le bug : 'new_message' était dans le code TS
-- mais absent du CHECK -> insertion impossible).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_order','assignment','status_change','general','new_message','payment'));
