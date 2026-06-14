-- supabase_auth_migration.sql
-- Migration vers Supabase Auth. À exécuter dans Supabase → SQL Editor.
-- ⚠️ TESTER D'ABORD sur une branche Supabase avant la prod.
-- ⚠️ La PARTIE B est DESTRUCTIVE (efface les commandes/notifications de test).

-- ============================================================
-- PARTIE A — Table profiles + sécurité
-- ============================================================

-- A.1 Table profiles (1 ligne par compte auth)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text,
  phone      text,
  role       text not null default 'client' check (role in ('admin','client','livreur')),
  avatar     text,
  blocked    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A.2 Fonction is_admin() : SECURITY DEFINER => s'exécute en tant que owner,
--     contourne la RLS de profiles => PAS de récursion (le bug rencontré avant).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- A.3 RLS profiles : chacun sa ligne, l'admin toutes
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

-- A.4 Trigger : créer le profile à l'inscription.
--     SÉCURITÉ : on force role='client'. On n'utilise JAMAIS un role venant
--     des métadonnées d'inscription (un utilisateur pourrait sinon se déclarer admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone, role, avatar, blocked)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'client',
    coalesce(
      new.raw_user_meta_data->>'avatar',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=client'
    ),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- PARTIE B — Re-key orders/notifications + retrait ancien système
-- ⚠️ EFFACE les données de test. Ne lancer qu'après contrôle du volume :
--    select (select count(*) from public.users)         as users,
--           (select count(*) from public.orders)        as orders,
--           (select count(*) from public.notifications) as notifs;
-- ============================================================

-- B.1 Effacer les données de test liées aux anciens IDs maison
truncate table public.notifications;
truncate table public.orders;

-- B.2 orders.user_id : text 'USR-...' -> uuid (références auth.users)
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  alter column user_id type uuid using null;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- B.3 notifications.user_id : text -> uuid
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  alter column user_id type uuid using null;
alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- B.4 Retrait de l'ancien dispositif maison (sécurisation précédente)
drop trigger if exists trg_hash_user_password on public.users;
drop function if exists public.hash_user_password();
drop function if exists public.login_user(text, text);
drop table if exists public.users cascade;

-- NB : la RLS fine "chacun ne voit que ses commandes" n'est PAS posée ici
-- (les commandes/notifications gardent leur accès actuel pour ne pas casser
-- le tunnel de commande). C'est une amélioration ultérieure documentée.
