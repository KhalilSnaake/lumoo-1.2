-- seed_admin_test.sql
-- Exécuter dans Supabase → SQL Editor (après delete_user_by_admin.sql).
-- Crée (ou réactive) un compte admin de test utilisable immédiatement
-- pour tester la suppression de clients/livreurs depuis le web admin.
--
-- ⚠️ SÉCURITÉ : Remplacer OBLIGATOIREMENT v_email et v_password par des valeurs
--    sécurisées avant exécution. Un garde-fou bloque l'exécution avec les valeurs d'exemple.

do $$
declare
  v_email       text := '<VOTRE_EMAIL_ADMIN>';
  v_password    text := '<VOTRE_MOT_DE_PASSE_FORT>';
  v_password_hash text;
  v_user_id     uuid;
begin
  if v_email = '<VOTRE_EMAIL_ADMIN>' or v_password = '<VOTRE_MOT_DE_PASSE_FORT>' or length(v_password) < 12 then
    raise exception 'SÉCURITÉ : Vous devez remplacer v_email et v_password par vos identifiants administrateur sécurisés (minimum 12 caractères).';
  end if;

  -- 1. Générer le hash bcrypt (cost 10 = standard).
  v_password_hash := crypt(v_password, gen_salt('bf', 10));

  -- 2. Insérer l'utilisateur dans auth.users (avec email confirmée,
  --    pour pouvoir se connecter sans passer par l'email de confirmation).
  insert into auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin,
    phone,
    confirmed_at,
    email_change,
    email_change_token,
    backup_codes,
    phone_change,
    phone_change_token,
    phone_change_confirmed_at
  ) values (
    (select uuid from auth.instances limit 1),
    v_email,
    v_password_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin Test","phone":"+22300000000"}'::jsonb,
    now(),
    now(),
    null,
    null,
    now(),
    null,
    null,
    '{}',
    null,
    null,
    null
  )
  returning id into v_user_id;

  -- 3. Créer le profil correspondant avec le rôle 'admin'
  --    (c'est la colonne lue par is_admin() et les RLS profiles).
  insert into public.profiles (id, name, email, phone, role, avatar, blocked)
  values (
    v_user_id,
    'Admin Test',
    v_email,
    '+22300000000',
    'admin',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    false
  )
  on conflict (id) do update
    set role = 'admin',
        blocked = false;

  raise notice 'Admin de test créé : % / %', v_email, v_password;
end;
$$;

-- ---------------------------------------------------------------------------
-- Si l'email existe déjà (un admin de test précédent a déjà été créé),
-- cette requête permet de réutiliser le même compte en forçant role='admin'
-- et en réinitialisant le mot de passe. À décommenter le cas échéant :
--
-- do $$
-- declare
--   v_email       text := 'testadmin@lumoo.ml';
--   v_password    text := 'AdminTest2026!';
--   v_user        auth.users;
-- begin
--   select * into v_user from auth.users where email = v_email;
--   if found then
--     update auth.users
--        set encrypted_password = crypt(v_password, gen_salt('bf', 10)),
--            email_confirmed_at = now(),
--            confirmed_at = now()
--      where id = v_user.id;
--     update public.profiles set role = 'admin', blocked = false where id = v_user.id;
--     raise notice 'Admin existant réactivé : %', v_email;
--   else
--     raise notice 'Aucun admin de test trouvé pour % (le INSERT ci-dessus le crée).', v_email;
--   end if;
-- end;
-- $$;
