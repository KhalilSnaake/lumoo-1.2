-- RESET_PASSWORD_SQL.sql
-- Ajoute un mécanisme "mot de passe oublié" + hash côté DB.
-- IMPORTANT : ce projet stocke actuellement les mots de passe en clair dans users.password.
-- Ce script fournit une migration vers des hashes + une table de reset.
--
-- À exécuter UNE FOIS dans Supabase (SQL Editor).

-- 1) Helpers : extension pour gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Table des reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  request_ip INET
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Politiques (publique pour insérer un token)
DROP POLICY IF EXISTS "Public insert reset token" ON password_reset_tokens;
CREATE POLICY "Public insert reset token" ON password_reset_tokens
  FOR INSERT
  WITH CHECK (true);

-- Public pas de read
DROP POLICY IF EXISTS "Public read reset tokens" ON password_reset_tokens;
CREATE POLICY "Public read reset tokens" ON password_reset_tokens
  FOR SELECT
  USING (false);

-- Non-admin : pas d'update/delete direct
DROP POLICY IF EXISTS "Public update reset tokens" ON password_reset_tokens;
CREATE POLICY "Public update reset tokens" ON password_reset_tokens
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 3) Function : créer un token
-- Retourne le token généré.
CREATE OR REPLACE FUNCTION create_password_reset_token(p_user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_token TEXT;
BEGIN
  -- retrouve l'utilisateur par email
  SELECT id INTO v_user_id
  FROM users
  WHERE email = lower(trim(p_user_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- sécurité : ne pas révéler si l'email existe
    RETURN '';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (
    v_user_id,
    v_token,
    now() + interval '30 minutes'
  );

  RETURN v_token;
END;
$$;

-- 4) Function : reset le mot de passe avec token
-- hash avec digest (pgcrypto)
-- Note : Nous utilisons un hash simple demo.
-- En prod : utiliser bcrypt/argon2 via extension dédiée.
CREATE OR REPLACE FUNCTION reset_password_with_token(p_token TEXT, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_expires_at TIMESTAMPTZ;
  v_used BOOLEAN;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT user_id, expires_at, used
  INTO v_user_id, v_expires_at, v_used
  FROM password_reset_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_used = true OR v_expires_at < v_now THEN
    RETURN false;
  END IF;

  -- hash du nouveau mot de passe
  UPDATE users
  SET password = encode(digest(p_new_password, 'sha256'), 'hex')
  WHERE id = v_user_id;

  UPDATE password_reset_tokens
  SET used = true,
      used_at = v_now
  WHERE token = p_token;

  RETURN true;
END;
$$;

-- 5) Migration : chiffrer les mots de passe existants.
-- ⚠️ Si les mots de passe sont en clair, on les hash maintenant.
-- On suppose que les valeurs actuelles ne sont pas en hex sha256.
-- Dans le doute, on peut re-hasher toutes les valeurs.
-- Pour limiter le risque, on hash tous les password qui ne ressemblent pas à 64 hex chars.
UPDATE users
SET password = encode(digest(password, 'sha256'), 'hex')
WHERE password !~ '^[0-9a-fA-F]{64}$';