# 🚀 Déployer la fonction SQL `delete_user_by_admin` sur Supabase

## ✅ Statut actuel
- **Code web/core** : ✅ Déployé sur GitHub (`feat(web): enable admin-only user and driver deletion`)
- **Fonction SQL** : ⏳ À déployer manuellement sur Supabase

## 📋 Étapes de déploiement

### 1. Accéder à Supabase SQL Editor
1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet **lumoo-1.2**
3. Cliquez sur **SQL Editor** (volet gauche)

### 2. Copier et exécuter la migration
1. Copiez le contenu entier de ce fichier (voir **Migration SQL** ci-dessous)
2. Collez-le dans l'éditeur SQL
3. Cliquez sur **Run** (ou `Ctrl+Enter`)
4. Vérifiez que **0 erreurs** s'affichent (devrait afficher "Success. No rows returned.")

### 3. Vérifier le déploiement
Exécutez cette requête de test dans l'éditeur SQL :
```sql
-- Vérifier que la fonction existe et est accessible
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'delete_user_by_admin'
) AS fonction_existe;
```
**Résultat attendu** : `fonction_existe = true`

---

## 📄 Migration SQL

```sql
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
```

---

## 🧪 Test de la suppression (après déploiement)

Une fois la fonction déployée, testez-la via RPC :

```typescript
// Dans apps/web/src/components/UserManagement.tsx
// ou directement via Supabase Studio

const { error } = await supabase.rpc('delete_user_by_admin', { 
  target_id: 'uuid-de-lutilisateur-a-supprimer' 
});

if (error) {
  console.error('Erreur de suppression:', error.message);
} else {
  console.log('✅ Utilisateur supprimé avec succès');
}
```

---

## 📞 Support

- Si vous voyez **"Could not find the function..."** → La migration n'a pas été exécutée correctement
- Si vous voyez **"Permission denied"** → La fonction a été déployée, mais l'authentification n'est pas correcte
- Si vous voyez **"Un administrateur ne peut pas être supprimé..."** → Protection OK, tentez de supprimer un client normal

---

## ✅ Checklist finale

- [ ] Migration SQL exécutée sans erreurs
- [ ] Requête de vérification retourne `true`
- [ ] Test de suppression admin réussi sur un utilisateur test
- [ ] Suppression d'admin bloquée correctement
- [ ] Historique des commandes préservé

