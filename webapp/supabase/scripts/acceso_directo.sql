-- ============================================================
-- ACCESO DIRECTO AL PANEL (parte SQL)
--
-- El usuario NO se crea aquí: auth.users está protegido y el
-- SQL Editor puede no tener permiso. Créalo desde:
--   Supabase Dashboard -> Authentication -> Users -> Add user
--   (marca "Auto Confirm User")
-- o ejecuta: node supabase/scripts/crear_usuario.mjs
--
-- Este script solo hace que cualquier usuario autenticado
-- cuente como administrador, sin app_metadata ni metadata.
-- ============================================================

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    auth.uid() is not null
    or (auth.jwt() ->> 'role') = 'service_role',
    false
  );
$$;

grant execute on function public.is_app_admin() to authenticated, service_role;
