-- Suivi de commande invité : numéro seul OU numéro + code de livraison.
--  * numéro + code → vue complète (comme avant) ;
--  * numéro seul   → vue LIMITÉE : statut, articles, total, ville. Aucun nom, adresse, GPS,
--    téléphone du livreur ni code de livraison.
-- Le code seul n'est volontairement PAS accepté : 4 chiffres = 10 000 combinaisons, donc
-- énumérable (fuite de données clients) et ambigu (collisions entre commandes).

drop function if exists public.track_order(text, text) cascade;
drop function if exists public.track_order cascade;

create or replace function public.track_order(p_order_id text, p_delivery_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_items jsonb;
  v_livreur jsonb := null;
  v_full boolean := nullif(trim(coalesce(p_delivery_code, '')), '') is not null;
begin
  if nullif(trim(coalesce(p_order_id, '')), '') is null then
    return null;
  end if;

  select o.* into v_order
  from public.orders o
  where upper(trim(o.id)) = upper(trim(p_order_id))
    and (not v_full or trim(o.delivery_code) = trim(p_delivery_code));

  if not found then
    return null;
  end if;

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

  if not v_full then
    return jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'city', v_order.city,
      'paymentMethod', v_order.payment_method,
      'totalPrice', v_order.total_price,
      'createdAt', v_order.created_at,
      'limited', true,
      'items', v_items
    );
  end if;

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

notify pgrst, 'reload schema';
