-- ============================================================================
-- secure_auth.sql — Sécurisation de l'authentification Lumoo (sans réécriture)
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase → SQL Editor.
--
-- ⚠️ NOTE SUPABASE : l'extension pgcrypto est installée dans le schéma
--    "extensions" (pas "public"). On préfixe donc crypt/gen_salt par
--    "extensions." sinon Postgres renvoie : function crypt(text, text) does not exist.
--
-- Objectif :
--   1) Hasher les mots de passe (fini le stockage en clair)
--   2) Vérifier le mot de passe CÔTÉ SERVEUR (fonction login_user) pour que la
--      clé publique (anon) ne lise jamais les mots de passe
--   3) Masquer la colonne `password` à la clé publique
--   4) Nettoyer les policies RLS récursives qui avaient cassé la connexion
--
-- ⚠️ ORDRE IMPORTANT :
--   - PARTIE 1 : sans risque. Rétablit la connexion du site ACTUEL. À lancer
--     quand vous voulez (idéalement tout de suite, elle répare la panne).
--   - PARTIE 2 : à lancer UNIQUEMENT APRÈS avoir déployé le nouveau code
--     (branche `securisation-auth`). Si on la lance avant, le site actuel
--     (qui lit encore les mots de passe en clair) cesse de fonctionner.
-- ============================================================================


-- ============================================================================
-- PARTIE 1 — SANS RISQUE — À LANCER MAINTENANT (répare la connexion)
-- ============================================================================

-- 1.1 Extension de hashage (bcrypt), dans le schéma "extensions" (standard Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1.2 Supprimer les policies RLS récursives (cause de "Erreur de connexion")
--     et revenir à l'état fonctionnel. Le verrouillage propre se fait en 2.3.
DROP POLICY IF EXISTS "Users admin can read all profiles"   ON users;
DROP POLICY IF EXISTS "Users can read their own profile"    ON users;
DROP POLICY IF EXISTS "Users admin can update all profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile"  ON users;
DROP POLICY IF EXISTS "Users public can insert"             ON users;
DROP POLICY IF EXISTS "Users anon can insert"               ON users;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 1.3 Fonction de connexion côté serveur.
--     SECURITY DEFINER = s'exécute avec les droits du propriétaire (postgres),
--     donc elle peut lire la colonne `password` même après le verrouillage 2.3.
--     Elle ne RENVOIE jamais le mot de passe.
--     Mode TRANSITION : accepte les mots de passe encore en clair OU déjà hashés,
--     pour que le nouveau code fonctionne avant ET après la PARTIE 2.
CREATE OR REPLACE FUNCTION public.login_user(identifier text, pass text)
RETURNS TABLE (
  id text,
  name text,
  email text,
  phone text,
  role text,
  avatar text,
  blocked boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar,
         COALESCE(u.blocked, false) AS blocked, u.created_at
  FROM users u
  WHERE (u.email = lower(trim(identifier)) OR u.phone = trim(identifier))
    AND (
      -- mot de passe déjà hashé (bcrypt commence par "$2")
      (u.password LIKE '$2%' AND u.password = extensions.crypt(pass, u.password))
      -- mot de passe encore en clair (avant la PARTIE 2)
      OR (u.password NOT LIKE '$2%' AND u.password = pass)
    )
  LIMIT 1;
$$;

-- Autoriser l'appel depuis le front (clé anon + utilisateurs authentifiés)
GRANT EXECUTE ON FUNCTION public.login_user(text, text) TO anon, authenticated;


-- ============================================================================
-- PARTIE 2 — À LANCER SEULEMENT APRÈS DÉPLOIEMENT DU NOUVEAU CODE
--            (sinon la connexion du site casse)
-- ============================================================================

-- 2.1 Hasher tous les mots de passe encore en clair (idempotent : ignore les déjà hashés)
UPDATE users
SET password = extensions.crypt(password, extensions.gen_salt('bf'))
WHERE password IS NOT NULL
  AND password NOT LIKE '$2%';

-- 2.2 Trigger : hasher automatiquement tout nouveau mot de passe (inscription, modif admin…)
CREATE OR REPLACE FUNCTION public.hash_user_password()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password NOT LIKE '$2%' THEN
    NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_user_password ON users;
CREATE TRIGGER trg_hash_user_password
BEFORE INSERT OR UPDATE OF password ON users
FOR EACH ROW
EXECUTE FUNCTION public.hash_user_password();

-- 2.3 Masquer la colonne `password` à la clé publique.
--     La clé anon peut toujours lire les autres colonnes (le panneau Admin marche),
--     mais ne peut PLUS lire les mots de passe, même en lisant la table directement.
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT  SELECT (id, name, email, phone, role, avatar, blocked, created_at)
  ON public.users TO anon, authenticated;


-- ============================================================================
-- PARTIE 3 — OPTIONNEL — DURCISSEMENT FINAL (une fois tout vérifié en prod)
-- ----------------------------------------------------------------------------
-- Quand vous êtes sûr que plus aucun mot de passe n'est en clair, vous pouvez
-- retirer la branche "transition" de login_user pour n'accepter QUE les hash.
-- (À décommenter et lancer plus tard.)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.login_user(identifier text, pass text)
-- RETURNS TABLE (id text, name text, email text, phone text, role text, avatar text, blocked boolean, created_at timestamptz)
-- LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
--   SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar, COALESCE(u.blocked,false), u.created_at
--   FROM users u
--   WHERE (u.email = lower(trim(identifier)) OR u.phone = trim(identifier))
--     AND u.password = extensions.crypt(pass, u.password)
--   LIMIT 1;
-- $$;
-- GRANT EXECUTE ON FUNCTION public.login_user(text, text) TO anon, authenticated;
