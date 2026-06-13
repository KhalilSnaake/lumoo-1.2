-- SECURITY_USER_RLS.sql
-- Renforce la sécurité RLS pour la table users.
--
-- Objectif :
--  A) un user connecté non-admin peut lire/mettre à jour UNIQUEMENT son propre profil
--  B) un admin peut lire/mettre à jour tous les profils
--
-- ⚠️ À exécuter dans le SQL Editor Supabase.

-- 0) Pré-requis
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1) Supprimer les politiques actuelles trop permissives
DROP POLICY IF EXISTS "Public read users" ON users;
DROP POLICY IF EXISTS "Public insert users" ON users;
DROP POLICY IF EXISTS "Public update users" ON users;
DROP POLICY IF EXISTS "Public delete users" ON users;

-- 2) Policies SELECT
-- Admin : peut lire tous
CREATE POLICY "Users admin can read all profiles"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id::text = auth.uid()::text
      AND u.role = 'admin'
  )
);

-- Non-admin : peut lire uniquement son profil
CREATE POLICY "Users can read their own profile"
ON users FOR SELECT
USING (
  id::text = auth.uid()::text
);

-- 3) Policies UPDATE
-- Admin : peut mettre à jour tous
CREATE POLICY "Users admin can update all profiles"
ON users FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id::text = auth.uid()::text
      AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id::text = auth.uid()::text
      AND u.role = 'admin'
  )
);

-- Non-admin : peut mettre à jour uniquement son profil
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (
  id::text = auth.uid()::text
)
WITH CHECK (
  id::text = auth.uid()::text
);

-- 4) Policies DELETE (optionnel)
-- Par sécurité, on empêche la suppression.
DROP POLICY IF EXISTS "Users admin can delete profiles" ON users;

