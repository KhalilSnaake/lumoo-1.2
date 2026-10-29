-- ============================================================================
-- Migration : 20260101000004_security_hardening.sql
-- Description : Durcissement complet de la sécurité de la base de données Lumoo
-- À exécuter dans Supabase → SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. PROFILES : Protection contre l'élévation de privilèges vers 'admin'
-- ============================================================================
drop trigger if exists trg_protect_profile_role on public.profiles;
drop function if exists public.protect_profile_role() cascade;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seul un admin existant peut modifier le rôle ou bloquer/débloquer un compte
  if (new.role is distinct from old.role or new.blocked is distinct from old.blocked) and not public.is_admin() then
    raise exception 'Interdit : la modification du rôle ou du statut bloqué est réservée aux administrateurs.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Mise à jour des politiques RLS de profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ============================================================================
-- 2. COMMANDES (ORDERS) & ARTICLES (ORDER_ITEMS) : Protection PII & RLS
-- ============================================================================
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Nettoyage des anciennes politiques permissives
drop policy if exists "Public read orders" on public.orders;
drop policy if exists "Public insert orders" on public.orders;
drop policy if exists "Public update orders" on public.orders;
drop policy if exists "Public delete orders" on public.orders;
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

-- Politiques RLS strictes sur orders
create policy "orders_select" on public.orders
  for select using (user_id::text = auth.uid()::text or public.is_admin());

create policy "orders_insert" on public.orders
  for insert with check (user_id is null or user_id::text = auth.uid()::text);

create policy "orders_update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy "orders_delete" on public.orders
  for delete using (public.is_admin());

-- Politiques RLS strictes sur order_items
drop policy if exists "Public read order_items" on public.order_items;
drop policy if exists "Public insert order_items" on public.order_items;
drop policy if exists "Public update order_items" on public.order_items;
drop policy if exists "Public delete order_items" on public.order_items;
drop policy if exists "order_items_select" on public.order_items;
drop policy if exists "order_items_insert" on public.order_items;
drop policy if exists "order_items_update" on public.order_items;
drop policy if exists "order_items_delete" on public.order_items;

create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id::text = auth.uid()::text or public.is_admin())
    )
  );

create policy "order_items_insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id is null or o.user_id::text = auth.uid()::text)
    )
  );

create policy "order_items_update" on public.order_items
  for update using (public.is_admin()) with check (public.is_admin());

create policy "order_items_delete" on public.order_items
  for delete using (public.is_admin());

-- ============================================================================
-- 3. INTÉGRITÉ DES PRIX : Validation serveur anti-falsification
-- ============================================================================
drop trigger if exists trg_validate_order_item_price on public.order_items;
drop function if exists public.validate_order_item_price() cascade;

create or replace function public.validate_order_item_price()
returns trigger as $$
declare
  v_real_price integer;
  v_promo_price integer;
begin
  select price, promo_price into v_real_price, v_promo_price
  from public.products
  where id = new.product_id;

  if v_real_price is null then
    raise exception 'Produit introuvable : %', new.product_id;
  end if;

  -- Détermine le prix officiel du catalogue
  if v_promo_price is not null and v_promo_price > 0 and v_promo_price < v_real_price then
    v_real_price := v_promo_price;
  end if;

  -- Écrase systématiquement le prix avec le prix catalogue garanti côté serveur
  new.price := v_real_price;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_validate_order_item_price on public.order_items;
create trigger trg_validate_order_item_price
  before insert or update on public.order_items
  for each row execute function public.validate_order_item_price();

-- ============================================================================
-- 4. FONCTIONS RPC SÉCURISÉES (Track order, Livreur, Suppression compte)
-- ============================================================================

-- Suivi invité sécurisé : une commande n'est renvoyée que si le code de livraison correspond
drop function if exists public.track_order(text, text) cascade;
drop function if exists public.track_order cascade;
create or replace function public.track_order(p_order_id text, p_delivery_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_items jsonb;
  v_livreur jsonb := null;
begin
  select o.* into v_order
  from public.orders o
  where upper(trim(o.id)) = upper(trim(p_order_id))
    and trim(o.delivery_code) = trim(p_delivery_code);

  if not found then
    return null;
  end if;

  -- Articles
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', oi.name,
    'emoji', oi.emoji,
    'price', oi.price,
    'quantity', oi.quantity,
    'unit', oi.unit
  )), '[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;
  -- Livreur (si assigné)
  if v_order.livreur_id is not null then
    select jsonb_build_object('name', p.name, 'phone', p.phone)
    into v_livreur
    from public.profiles p
    where p.id::text = v_order.livreur_id::text;
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'deliveryCode', v_order.delivery_code,
    'customerName', v_order.customer_name,
    'address', v_order.address,
    'city', v_order.city,
    'gps_lat', v_order.gps_lat,
    'gps_lng', v_order.gps_lng,
    'paymentMethod', v_order.payment_method,
    'totalPrice', v_order.total_price,
    'createdAt', v_order.created_at,
    'livreur', v_livreur,
    'items', v_items
  );
end;
$$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- Livraisons assignées au livreur connecté (le code de livraison est MASQUÉ pour sécurité)
drop function if exists public.get_livreur_orders() cascade;
drop function if exists public.get_livreur_orders cascade;
create or replace function public.get_livreur_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'user_id', o.user_id,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'address', o.address,
    'city', o.city,
    'gps_lat', o.gps_lat,
    'gps_lng', o.gps_lng,
    'payment_method', o.payment_method,
    'payment_phone', o.payment_phone,
    'total_price', o.total_price,
    'status', o.status,
    'livreur_id', o.livreur_id,
    'delivery_code', '', -- SÉCURITÉ : Masqué au livreur jusqu'à remise par le client
    'received_by', o.received_by,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id,
        'name', oi.name,
        'emoji', oi.emoji,
        'price', oi.price,
        'quantity', oi.quantity,
        'unit', oi.unit
      ))
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  into v_result
  from public.orders o
  where o.livreur_id::text = auth.uid()::text or public.is_admin();

  return v_result;
end;
$$;
revoke all on function public.get_livreur_orders() from public, anon;
grant execute on function public.get_livreur_orders() to authenticated;

alter table public.orders add column if not exists delivery_attempts integer not null default 0;

-- Validation de livraison côté serveur par le livreur
drop function if exists public.confirm_delivery(text, text, text) cascade;
drop function if exists public.confirm_delivery cascade;
create or replace function public.confirm_delivery(
  p_order_id text,
  p_delivery_code text,
  p_received_by text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where upper(trim(id)) = upper(trim(p_order_id))
    and (livreur_id::text = auth.uid()::text or public.is_admin())
  for update;
  if not found then return false; end if;

  -- Anti force brute (code à 4 chiffres) : verrouillage après 5 échecs.
  if coalesce(v_order.delivery_attempts, 0) >= 5 and not public.is_admin() then
    return false;
  end if;

  if trim(v_order.delivery_code) <> trim(p_delivery_code) then
    update public.orders set delivery_attempts = coalesce(delivery_attempts, 0) + 1 where id = v_order.id;
    return false;
  end if;

  update public.orders
  set status = 'livree',
      received_by = trim(p_received_by),
      updated_at = now()
  where id = v_order.id;
  return true;
end;
$$;
revoke all on function public.confirm_delivery(text, text, text) from public, anon;
grant execute on function public.confirm_delivery(text, text, text) to authenticated;

-- Suppression de son propre compte (RGPD / Google Play)
drop function if exists public.delete_my_account() cascade;
drop function if exists public.delete_my_account cascade;
create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Détacher les références dans les commandes pour préserver l'historique
  update public.orders set user_id = null where user_id = v_user_id;

  -- Supprimer dans auth.users (la cascade nettoiera public.profiles)
  delete from auth.users where id = v_user_id;
  return true;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- 5. CATALOGUE & PUBLICITÉS : Lecture publique, écriture admin uniquement
-- ============================================================================
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.ads enable row level security;

-- Products
drop policy if exists "Public read products" on public.products;
drop policy if exists "Admin CRUD products" on public.products;
drop policy if exists "Admin insert products" on public.products;
drop policy if exists "Admin update products" on public.products;
drop policy if exists "Admin delete products" on public.products;

create policy "Public read products" on public.products for select using (true);
create policy "Admin insert products" on public.products for insert with check (public.is_admin());
create policy "Admin update products" on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete products" on public.products for delete using (public.is_admin());

-- Categories
drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Admin CRUD categories" on public.categories;
drop policy if exists "Admin insert categories" on public.categories;
drop policy if exists "Admin update categories" on public.categories;
drop policy if exists "Admin delete categories" on public.categories;

create policy "Public read categories" on public.categories for select using (true);
create policy "Admin insert categories" on public.categories for insert with check (public.is_admin());
create policy "Admin update categories" on public.categories for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete categories" on public.categories for delete using (public.is_admin());

-- Ads
drop policy if exists "Public read ads" on public.ads;
drop policy if exists "Admin CRUD ads" on public.ads;
drop policy if exists "Admin insert ads" on public.ads;
drop policy if exists "Admin update ads" on public.ads;
drop policy if exists "Admin delete ads" on public.ads;

create policy "Public read ads" on public.ads for select using (true);
create policy "Admin insert ads" on public.ads for insert with check (public.is_admin());
create policy "Admin update ads" on public.ads for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete ads" on public.ads for delete using (public.is_admin());

-- ============================================================================
-- 6. CONTACT MESSAGES & NOTIFICATIONS : Protection des données
-- ============================================================================
alter table public.contact_messages enable row level security;

drop policy if exists "Public read contact_messages" on public.contact_messages;
drop policy if exists "Public insert contact_messages" on public.contact_messages;
drop policy if exists "Admin update contact_messages" on public.contact_messages;
drop policy if exists "Allow authenticated users to read their own messages" on public.contact_messages;
drop policy if exists "Allow admin full access to contact messages" on public.contact_messages;
drop policy if exists "Allow all authenticated users to read messages" on public.contact_messages;
drop policy if exists "Admins can view all contact messages" on public.contact_messages;
drop policy if exists "Admins can update contact messages" on public.contact_messages;
drop policy if exists "Allow public insert for contact form submissions" on public.contact_messages;
drop policy if exists "Allow admin select contact messages" on public.contact_messages;
drop policy if exists "Allow admin delete contact messages" on public.contact_messages;

create policy "Allow public insert for contact form submissions"
on public.contact_messages for insert with check (true);

create policy "Allow admin select contact messages"
on public.contact_messages for select using (public.is_admin());

create policy "Allow admin update contact messages"
on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());

create policy "Allow admin delete contact messages"
on public.contact_messages for delete using (public.is_admin());

-- Notifications
alter table public.notifications enable row level security;
drop policy if exists "Users can see their own notifications" on public.notifications;
drop policy if exists "Internal insert notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;
drop policy if exists "Users can delete their own notifications" on public.notifications;
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;

create policy "notifications_select" on public.notifications
  for select using (user_id::text = auth.uid()::text or public.is_admin());

create policy "notifications_update" on public.notifications
  for update using (user_id::text = auth.uid()::text or public.is_admin())
  with check (user_id::text = auth.uid()::text or public.is_admin());

create policy "notifications_delete" on public.notifications
  for delete using (user_id::text = auth.uid()::text or public.is_admin());

create policy "notifications_insert_admin" on public.notifications
  for insert with check (public.is_admin());

-- ============================================================================
-- 7. STORAGE POLICIES : Protection contre la suppression arbitraire de fichiers
-- ============================================================================
-- Bucket documents (preuves de paiement) : PRIVÉ, accès admin uniquement,
-- consultation via URL signée (createSignedUrl).
update storage.buckets set public = false where id = 'documents';

drop policy if exists "Allow authenticated upload to documents bucket" on storage.objects;
drop policy if exists "Allow public read from documents bucket" on storage.objects;
drop policy if exists "Allow authenticated update to documents bucket" on storage.objects;
drop policy if exists "Allow authenticated delete to documents bucket" on storage.objects;
drop policy if exists "documents_upload_policy" on storage.objects;
drop policy if exists "documents_read_policy" on storage.objects;
drop policy if exists "documents_admin_insert" on storage.objects;
drop policy if exists "documents_admin_select" on storage.objects;
drop policy if exists "documents_admin_update" on storage.objects;
drop policy if exists "documents_admin_delete" on storage.objects;

create policy "documents_admin_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_admin());
create policy "documents_admin_select" on storage.objects
  for select using (bucket_id = 'documents' and public.is_admin());
create policy "documents_admin_update" on storage.objects
  for update using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());
create policy "documents_admin_delete" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_admin());

-- Rafraîchir le cache de schéma PostgREST
notify pgrst, 'reload schema';
