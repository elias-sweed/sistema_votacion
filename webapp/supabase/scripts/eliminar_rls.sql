-- ============================================================
-- ELIMINAR RLS DE TODAS LAS TABLAS (SIN PERMISOS DE ADMIN)
--
-- Este script quita toda la seguridad de filas para que cualquier
-- usuario autenticado pueda borrar, insertar y editar sin problemas.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. DESACTIVAR RLS EN TODAS LAS TABLAS
-- ------------------------------------------------------------
alter table public.mesas         disable row level security;
alter table public.votantes      disable row level security;
alter table public.candidatos    disable row level security;
alter table public.votos         disable row level security;
alter table public.configuracion disable row level security;

-- ------------------------------------------------------------
-- 2. ELIMINAR TODAS LAS POLÍTICAS RLS EXISTENTES
-- ------------------------------------------------------------
drop policy if exists "admin_full_mesas" on public.mesas;
drop policy if exists "admin_full_votantes" on public.votantes;
drop policy if exists "admin_full_candidatos" on public.candidatos;
drop policy if exists "admin_full_votos" on public.votos;
drop policy if exists "admin_full_configuracion" on public.configuracion;
drop policy if exists "anon_lee_candidatos_activos" on public.candidatos;

-- ------------------------------------------------------------
-- 3. CONCEDER PERMISOS DIRECTOS A USUARIOS AUTENTICADOS
-- ------------------------------------------------------------
grant select, insert, update, delete on public.mesas to authenticated;
grant select, insert, update, delete on public.votantes to authenticated;
grant select, insert, update, delete on public.candidatos to authenticated;
grant select, insert, update, delete on public.votos to authenticated;
grant select, insert, update, delete on public.configuracion to authenticated;

-- También permitir al rol anon (kioscos) leer candidatos
grant select on public.candidatos to anon;

-- ------------------------------------------------------------
-- 4. VERIFICACIÓN: RLS DESACTIVADO
-- ------------------------------------------------------------
select
  schemaname,
  tablename,
  rowsecurity as rls_activado
from pg_tables
where schemaname = 'public'
  and tablename in ('mesas', 'votantes', 'candidatos', 'votos', 'configuracion')
order by tablename;
