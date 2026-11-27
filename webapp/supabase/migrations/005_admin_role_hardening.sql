-- ============================================================
-- MIGRACIÓN 005: RESTAURAR EL CONTROL DE ACCESO POR ROL

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'service_role',
    false
  );
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- ------------------------------------------------------------
-- DIAGNÓSTICO
-- Ejecuta esto después de aplicar la migración para comprobar
-- qué usuarios tienen realmente el rol admin.
-- ------------------------------------------------------------
select
  u.email,
  u.raw_app_meta_data ->> 'role' as rol
from auth.users u
where (u.raw_app_meta_data ->> 'role') = 'admin'
order by u.email;

-- Si la lista está vacía, otorga el rol con supabase/scripts/acceso_directo.sql
-- y luego cierra sesión y vuelve a entrar para refrescar el JWT.
