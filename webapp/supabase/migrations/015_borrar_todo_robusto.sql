-- ============================================================
-- MIGRACIÓN 015: BORRADO TOTAL ROBUSTO
--
-- Hace que es_admin_uuid() acepte tanto el UUID fijo del admin
-- como el claim app_metadata.role = 'admin', de modo que el
-- borrado total funcione aunque el JWT no traiga el UUID o la
-- migración 013 no se haya aplicado todavía.
--
-- Aplicar después de la migración 014.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FUNCIÓN es_admin_uuid() TOLERANTE
-- ------------------------------------------------------------
create or replace function public.es_admin_uuid()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() = '1fbf5137-09fa-404f-8232-e21788a047f8'::uuid
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

grant execute on function public.es_admin_uuid() to authenticated;
revoke execute on function public.es_admin_uuid() from public, anon;

-- ------------------------------------------------------------
-- 2. RLS Y POLÍTICAS (idempotente)
--
-- Se recrean las políticas basadas en es_admin_uuid() para que el
-- borrado funcione aunque la migración 013 no se haya aplicado.
-- ------------------------------------------------------------
alter table public.mesas          enable row level security;
alter table public.votantes       enable row level security;
alter table public.candidatos     enable row level security;
alter table public.votos          enable row level security;
alter table public.configuracion  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['mesas', 'votantes', 'candidatos', 'votos', 'configuracion']
  loop
    execute format('drop policy if exists %I on public.%I', 'admin_uuid_' || t || '_select', t);
    execute format('drop policy if exists %I on public.%I', 'admin_uuid_' || t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', 'admin_uuid_' || t || '_update', t);
    execute format('drop policy if exists %I on public.%I', 'admin_uuid_' || t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.es_admin_uuid())',
      'admin_uuid_' || t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.es_admin_uuid())',
      'admin_uuid_' || t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid())',
      'admin_uuid_' || t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.es_admin_uuid())',
      'admin_uuid_' || t || '_delete', t
    );
  end loop;
end $$;

drop policy if exists "anon_uuid_candidatos_select" on public.candidatos;
create policy "anon_uuid_candidatos_select" on public.candidatos
  for select to anon using (activo = true);

grant select, insert, update, delete on public.mesas         to authenticated;
grant select, insert, update, delete on public.votantes      to authenticated;
grant select, insert, update, delete on public.candidatos    to authenticated;
grant select, insert, update, delete on public.votos         to authenticated;
grant select, insert, update, delete on public.configuracion to authenticated;
grant select on public.candidatos to anon;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- 3. BORRADO TOTAL
-- ------------------------------------------------------------
drop function if exists public.borrar_todo();
create or replace function public.borrar_todo()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- El orden importa por las claves foráneas
  delete from public.votos;
  delete from public.votantes;
  delete from public.candidatos;
  delete from public.mesas;

  -- Limpiar el registro de intentos (rate limiting) si la tabla existe
  if to_regclass('public.rate_limit_intentos') is not null then
    delete from public.rate_limit_intentos;
  end if;

  -- Restablecer configuración a valores por defecto
  update public.configuracion
  set
    eleccion_abierta = false,
    titulo = 'Elección de Municipios Escolares',
    centro = 'I.E. Jimenez Pimentel',
    logo_url = null,
    actualizado_en = now()
  where id = 1;
end;
$$;

grant execute on function public.borrar_todo() to authenticated;
revoke execute on function public.borrar_todo() from public, anon;

-- ------------------------------------------------------------
-- 4. BORRADOS PARCIALES
-- ------------------------------------------------------------
drop function if exists public.borrar_todos_votantes();
create or replace function public.borrar_todos_votantes()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;
  delete from public.votantes;
end;
$$;

drop function if exists public.borrar_todos_candidatos();
create or replace function public.borrar_todos_candidatos()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;
  delete from public.candidatos;
end;
$$;

grant execute on function public.borrar_todos_votantes() to authenticated;
grant execute on function public.borrar_todos_candidatos() to authenticated;
revoke execute on function public.borrar_todos_votantes() from public, anon;
revoke execute on function public.borrar_todos_candidatos() from public, anon;

-- ------------------------------------------------------------
-- 5. VERIFICACIÓN
-- ------------------------------------------------------------
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('borrar_todo', 'borrar_todos_votantes', 'borrar_todos_candidatos')
order by routine_name;
