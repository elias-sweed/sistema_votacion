-- ============================================================
-- MIGRACIÓN 003: CORRECCIÓN is_app_admin() PARA SERVICE_ROLE
-- ============================================================
-- Objetivo: Permitir que service_role (clave de servicio) pase la verificación de admin
-- Esto es necesario para:
-- 1. Tests automatizados que usan service_role key
-- 2. Edge Functions y backend services que usan service_role
-- 3. Scripts de mantenimiento administrativo
-- ============================================================

-- ------------------------------------------------------------
-- ACTUALIZAR is_app_admin() PARA PERMITIR SERVICE_ROLE
-- ------------------------------------------------------------
-- service_role es un rol de PostgreSQL de confianza que bypassea RLS.
-- Debería tener acceso administrativo implícito.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    -- 1. Verificar claim JWT (para usuarios normales logueados via Supabase Auth)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    -- 2. Verificar si es service_role (para backend, tests, Edge Functions)
    current_user = 'service_role',
    -- 3. Verificar si tiene rol postgres 'app_admin' (para compatibilidad futura)
    pg_has_role(current_user, 'app_admin'::name),
    false
  );
$$;

-- ------------------------------------------------------------
-- VERIFICACIÓN
-- ------------------------------------------------------------
-- Ejecutar como service_role: SELECT public.is_app_admin(); -- debe retornar true
-- Ejecutar como anon: SELECT public.is_app_admin(); -- debe retornar false
-- Ejecutar como usuario autenticado sin claim admin: false
-- Ejecutar como usuario autenticado con claim admin: true
-- ============================================================