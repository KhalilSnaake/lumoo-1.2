-- enable_pgnet_and_settings.sql
-- pg_net : permet aux triggers d'appeler l'Edge Function send-push (HTTP) côté serveur.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Settings privés (URL fonction + secret webhook). Schéma privé + RLS deny-all.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
ALTER TABLE private.app_settings ENABLE ROW LEVEL SECURITY; -- aucune policy => accès client refusé

-- ⚠️ À RENSEIGNER avant d'appliquer :
--   <PROJECT_REF>           = la référence du projet Supabase (ex: abcd1234)
--   <SECRET_ALEATOIRE_LONG> = un secret aléatoire (ex: openssl rand -hex 32)
--   Ce MÊME secret doit être posé comme secret de fonction PUSH_WEBHOOK_SECRET (send-push).
INSERT INTO private.app_settings(key, value) VALUES
  ('functions_base_url', 'https://<PROJECT_REF>.supabase.co/functions/v1'),
  ('push_webhook_secret', '<SECRET_ALEATOIRE_LONG>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
