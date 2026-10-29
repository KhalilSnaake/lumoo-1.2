-- delete_user_by_admin.sql
-- Exécuter dans Supabase → SQL Editor.
-- Permet à UN ADMIN de supprimer définitivement un client ou un livreur.
-- Sécurité : SECURITY DEFINER + vérification qu'on EST un admin (via is_admin()).
--   - Un client/livreur qui appelle la fonction reçoit une erreur et ne supprime rien.
--   - La suppression passe par l'auth (auth.users) pour ne pas laisser d'orphelins :
--     profiles.id référence auth.users(id) ON DELETE CASCADE.
--   - Les références dans orders (client et livreur) sont détachées avant
--     suppression afin de conserver l'historique sans bloquer sur une FK.
-- ⚠️ DESTRUCTIF : impossible à annuler. Utiliser le blocage si l'admin hésite.

create or replace function public.delete_user_by_admin(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_target_role text;
  v_deleted_count integer;
  v_column text;
begin
  -- 1. Seuls les admins peuvent supprimer.
  v_is_admin := public.is_admin();
  if not v_is_admin then
    raise exception 'Interdit : seuls les administrateurs peuvent supprimer un utilisateur.';
  end if;

  -- 2. Interdit de supprimer un admin (protection de l'organisation).
  select p.role into v_target_role
    from public.profiles p
    where p.id = target_id;
  if v_target_role is null then
    raise exception 'Utilisateur introuvable : %', target_id;
  end if;
  if v_target_role = 'admin' then
    raise exception 'Un administrateur ne peut pas être supprimé via cette fonction.';
  end if;

  -- 3. Détacher les références client/livreur des commandes, si ces colonnes
  --    existent. Comparer via ::text prend en charge les anciens schémas UUID
  --    et les schémas historiques où les IDs étaient stockés en texte.
  foreach v_column in array array['user_id', 'livreur_id'] loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'orders'
        and c.column_name = v_column
    ) then
      execute pg_catalog.format(
        'update public.orders set %I = null where %I::text = $1::text',
        v_column,
        v_column
      ) using target_id;
    end if;
  end loop;

  -- 4. Supprimer dans Auth : profiles et les tables avec ON DELETE CASCADE
  --    sont nettoyées par leurs clés étrangères.
  delete from auth.users u where u.id = target_id;
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then
    raise exception 'Aucun compte Auth correspondant au profil %.', target_id;
  end if;

  return true;
end;
$$;

revoke all on function public.delete_user_by_admin(uuid) from public, anon;
grant execute on function public.delete_user_by_admin(uuid) to authenticated;

-- Rafraîchir le cache de schéma PostgREST pour que supabase.rpc() découvre
-- immédiatement la fonction et son paramètre `target_id`.
notify pgrst, 'reload schema';
