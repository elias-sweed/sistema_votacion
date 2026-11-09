-- ============================================================
-- MIGRACIÓN 011: FUNCIONES DE BORRADO MASIVO SEGURO
--
-- 1. Funciones SECURITY DEFINER para borrar datos masivamente
--    sin depender de filtros WHERE en el endpoint REST.
-- 2. Solo ejecutables por usuarios con rol app_metadata.admin.
--
-- Aplicar después de la migración 010.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BORRAR TODAS LAS MESAS Y SUS VOTOS
-- ------------------------------------------------------------
create or replace function public.borrar_todas_mesas()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- Primero borrar los votos (por la FK restrict), luego las mesas.
  delete from public.votos;
  delete from public.mesas;
end;
$$;

-- ------------------------------------------------------------
-- 2. BORRAR TODOS LOS VOTANTES
-- ------------------------------------------------------------
create or replace function public.borrar_todos_votantes()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  delete from public.votantes;
end;
$$;

-- ------------------------------------------------------------
-- 3. BORRAR TODOS LOS CANDIDATOS
-- ------------------------------------------------------------
create or replace function public.borrar_todos_candidatos()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  delete from public.candidatos;
end;
$$;

-- ------------------------------------------------------------
-- 4. PERMISOS
-- ------------------------------------------------------------
grant execute on function public.borrar_todas_mesas() to authenticated;
revoke execute on function public.borrar_todas_mesas() from anon, public;

grant execute on function public.borrar_todos_votantes() to authenticated;
revoke execute on function public.borrar_todos_votantes() from anon, public;

grant execute on function public.borrar_todos_candidatos() to authenticated;
revoke execute on function public.borrar_todos_candidatos() from anon, public;

-- ------------------------------------------------------------
-- 5. VERIFICACIÓN
-- ------------------------------------------------------------
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'borrar_%'
order by routine_name;
