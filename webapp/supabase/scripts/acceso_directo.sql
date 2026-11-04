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
--
-- Si al ejecutarlo aparece:
--   ERROR 42501: permission denied for schema public
-- el rol del SQL Editor no puede crear funciones. Alternativas:
--   1) node supabase/scripts/aplicar_sql.mjs  (Management API con PAT)
--   2) Asignar app_metadata {"role":"admin"} al usuario en
--      Authentication -> Users (no requiere SQL).
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
