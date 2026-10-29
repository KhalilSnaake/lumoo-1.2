-- create_livreur_verifications.sql
-- Exécuter dans Supabase → SQL Editor.
--
-- Crée la table `livreur_verifications` (1 ligne par livreur) + le bucket
-- storage privé `livreur-identities` + les politiques RLS nécessaires.
-- Cette table stocke le dossier d'identité du livreur (pièce du livreur +
-- pièce du garant + coordonnées du garant) utilisée par le panneau admin
-- (AdminPanel.tsx → LivreurEditModal / dossier livreur).

-- ============================================================
-- 1. Table
-- ============================================================
create table if not exists public.livreur_verifications (
  courier_id            uuid primary key references public.profiles(id) on delete cascade,
  -- Chemins dans le bucket storage `livreur-identities` (bucket privé).
  identity_document_path         text,
  guarantor_identity_document_path text,
  -- Coordonnées du garant.
  guarantor_name          text,
  guarantor_phone         text,
  guarantor_address       text,
  guarantor_consent       boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.livreur_verifications enable row level security;

-- ============================================================
-- 2. RLS : seuls les admins peuvent lire / écrire le dossier.
--    (on réutilise is_admin(), SECURITY DEFINER, déjà déployée.)
--    Le livreur ne peut pas consulter ses propres justificatifs ici ;
--    l'accès est réservé aux admins.
-- ============================================================
drop policy if exists "livreur_verif_admin_select" on public.livreur_verifications;
create policy "livreur_verif_admin_select" on public.livreur_verifications
  for select using (public.is_admin());

drop policy if exists "livreur_verif_admin_insert" on public.livreur_verifications;
create policy "livreur_verif_admin_insert" on public.livreur_verifications
  for insert with check (public.is_admin());

drop policy if exists "livreur_verif_admin_update" on public.livreur_verifications;
create policy "livreur_verif_admin_update" on public.livreur_verifications
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "livreur_verif_admin_delete" on public.livreur_verifications;
create policy "livreur_verif_admin_delete" on public.livreur_verifications
  for delete using (public.is_admin());

-- ============================================================
-- 3. Bucket storage privé pour les justificatifs (non public :
--    accès via URL signées — c'est déjà ce que fait AdminPanel).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('livreur-identities', 'livreur-identities', false)
on conflict (id) do nothing;

-- ============================================================
-- 4. Politiques storage (RLS sur storage.objects) : seuls les admins
--    peuvent lire/écrire dans le bucket `livreur-identities`.
--    Le bucket est privé : l'accès aux fichiers passe par des URL signées
--    (createSignedUrl) générées par l'admin.
-- ============================================================
drop policy if exists "livreur_id_admin_insert" on storage.objects;
create policy "livreur_id_admin_insert" on storage.objects
  for insert with check (bucket_id = (select id from storage.buckets where name = 'livreur-identities') and public.is_admin());

drop policy if exists "livreur_id_admin_select" on storage.objects;
create policy "livreur_id_admin_select" on storage.objects
  for select using (bucket_id = (select id from storage.buckets where name = 'livreur-identities') and public.is_admin());

drop policy if exists "livreur_id_admin_update" on storage.objects;
create policy "livreur_id_admin_update" on storage.objects
  for update using (bucket_id = (select id from storage.buckets where name = 'livreur-identities') and public.is_admin());

drop policy if exists "livreur_id_admin_delete" on storage.objects;
create policy "livreur_id_admin_delete" on storage.objects
  for delete using (bucket_id = (select id from storage.buckets where name = 'livreur-identities') and public.is_admin());
