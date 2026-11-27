-- ============================================================
-- MIGRACIÓN 016: BORRADO TOTAL COMPATIBLE CON SAFEUPDATE
--
-- CAUSA RAÍZ DEL PROBLEMA
-- Supabase carga la librería `safeupdate` en las conexiones de
-- PostgREST (`session_preload_libraries = supautils, safeupdate`).
-- Esa librería rechaza CUALQUIER `DELETE` o `UPDATE` sin `WHERE`,
-- incluso si la sentencia está dentro de una función
-- SECURITY DEFINER. El error que devuelve es:
--
--   code: 21000
--   message: "DELETE requires a WHERE clause"
--
-- Las funciones anteriores (011, 012, 013 y 015) usaban
-- `delete from public.tabla;` sin WHERE. Por eso el botón de la
-- app fallaba siempre, aunque el usuario fuera administrador.
--
-- Además, `es_admin_uuid()` devolvía NULL para usuarios que no
-- eran el UUID fijo. En PL/pgSQL `if not NULL then` NO lanza la
-- excepción, así que el guard de administrador fallaba abierto.
--
-- ESTA MIGRACIÓN
--   1. Hace que `es_admin_uuid()` devuelva siempre true/false.
--   2. Recrea todos los borrados con `where true` (safeupdate OK).
--   3. Añade borrado por tabla y por fila (mesa / candidato).
--   4. Restaura GRANTs y políticas RLS.
--
-- Ejecutar en Supabase SQL Editor o con:
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/016_borrado_total_safeupdate.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. HELPERS DE AUTORIZACIÓN (NUNCA DEVUELVEN NULL)
-- ------------------------------------------------------------
create or replace function public.es_admin_uuid()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    auth.uid() = '1fbf5137-09fa-404f-8232-e21788a047f8'::uuid
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or (auth.jwt() ->> 'role') = 'service_role',
    false
  );
$$;

grant execute on function public.es_admin_uuid() to authenticated, service_role;
revoke execute on function public.es_admin_uuid() from public, anon;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or (auth.jwt() ->> 'role') = 'service_role'
    or auth.uid() = '1fbf5137-09fa-404f-8232-e21788a047f8'::uuid,
    false
  );
$$;

grant execute on function public.is_app_admin() to authenticated, service_role;
revoke execute on function public.is_app_admin() from public, anon;

-- ------------------------------------------------------------
-- 2. RLS Y POLÍTICAS (IDEMPOTENTE)
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
    -- Políticas antiguas basadas en is_app_admin() o en nombres viejos.
    execute format('drop policy if exists %I on public.%I', 'admin_full_' || t, t);
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

-- Políticas antiguas de solo lectura de votos.
drop policy if exists "admin_read_votos" on public.votos;
drop policy if exists "anon_lee_candidatos_activos" on public.candidatos;
drop policy if exists "anon_uuid_candidatos_select" on public.candidatos;
create policy "anon_uuid_candidatos_select" on public.candidatos
  for select to anon using (activo = true);

-- ------------------------------------------------------------
-- 3. GRANTS (EL DELETE DE votos ERA EL QUE FALTABA)
-- ------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.mesas         to authenticated;
grant select, insert, update, delete on public.votantes      to authenticated;
grant select, insert, update, delete on public.candidatos    to authenticated;
grant select, insert, update, delete on public.votos         to authenticated;
grant select, insert, update, delete on public.configuracion to authenticated;

grant select on public.candidatos to anon;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- 4. BORRADOS MASIVOS (SIEMPRE CON WHERE)
-- ------------------------------------------------------------
create or replace function public.borrar_todos_votos()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- safeupdate exige una cláusula WHERE, aunque sea trivial.
  delete from public.votos where true;
end;
$$;

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

  delete from public.votantes where true;
end;
$$;

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

  -- Primero los votos por la FK RESTRICT; si no, el DELETE falla.
  delete from public.votos where true;
  delete from public.candidatos where true;
end;
$$;

create or replace function public.borrar_todas_mesas()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- Primero los votos por la FK RESTRICT; si no, el DELETE falla.
  delete from public.votos where true;
  delete from public.mesas where true;
end;
$$;

-- ------------------------------------------------------------
-- 5. BORRADO POR FILA (MESA / CANDIDATO)
-- ------------------------------------------------------------
create or replace function public.borrar_mesa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if p_id is null then
    raise exception 'Mesa inválida' using errcode = 'P0009';
  end if;

  delete from public.votos where mesa_id = p_id;
  delete from public.mesas where id = p_id;
end;
$$;

create or replace function public.borrar_candidato(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if p_id is null then
    raise exception 'Candidato inválido' using errcode = 'P0009';
  end if;

  delete from public.votos where candidato_id = p_id;
  delete from public.candidatos where id = p_id;
end;
$$;

-- ------------------------------------------------------------
-- 6. BORRADO GENÉRICO POR TABLA
--    Solo permite una lista blanca de tablas del sistema.
-- ------------------------------------------------------------
create or replace function public.borrar_tabla(p_tabla text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tabla text := lower(trim(coalesce(p_tabla, '')));
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if v_tabla = 'votos' then
    delete from public.votos where true;

  elsif v_tabla = 'votantes' then
    delete from public.votantes where true;

  elsif v_tabla = 'candidatos' then
    delete from public.votos where true;
    delete from public.candidatos where true;

  elsif v_tabla = 'mesas' then
    delete from public.votos where true;
    delete from public.mesas where true;

  elsif v_tabla = 'configuracion' then
    update public.configuracion
    set
      eleccion_abierta = false,
      titulo = 'Elección de Municipios Escolares',
      centro = 'I.E. Jimenez Pimentel',
      logo_url = null,
      actualizado_en = now()
    where id = 1;

  elsif v_tabla = 'rate_limit_intentos' then
    if to_regclass('public.rate_limit_intentos') is not null then
      delete from public.rate_limit_intentos where true;
    end if;

  else
    raise exception 'Tabla no permitida: %', coalesce(p_tabla, '(vacío)') using errcode = 'P0009';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 7. BORRADO TOTAL
-- ------------------------------------------------------------
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

  -- El orden importa por las claves foráneas.
  -- Cada DELETE lleva WHERE para cumplir con safeupdate.
  delete from public.votos where true;
  delete from public.votantes where true;
  delete from public.candidatos where true;
  delete from public.mesas where true;

  if to_regclass('public.rate_limit_intentos') is not null then
    delete from public.rate_limit_intentos where true;
  end if;

  update public.configuracion
  set
    eleccion_abierta = false,
    titulo = 'Elección de Municipios Escolares',
    centro = 'I.E. Jimenez Pimentel',
    logo_url = null,
    actualizado_en = now()
  where id = 1;

  -- Reiniciar el contador de votos para que la siguiente elección
  -- empiece en 1. No es obligatorio, pero deja la base limpia.
  if pg_get_serial_sequence('public.votos', 'id') is not null then
    perform setval(pg_get_serial_sequence('public.votos', 'id'), 1, false);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 8. PERMISOS DE LAS FUNCIONES
-- ------------------------------------------------------------
grant execute on function public.borrar_todos_votos()      to authenticated, service_role;
grant execute on function public.borrar_todos_votantes()   to authenticated, service_role;
grant execute on function public.borrar_todos_candidatos() to authenticated, service_role;
grant execute on function public.borrar_todas_mesas()      to authenticated, service_role;
grant execute on function public.borrar_mesa(uuid)         to authenticated, service_role;
grant execute on function public.borrar_candidato(uuid)    to authenticated, service_role;
grant execute on function public.borrar_tabla(text)        to authenticated, service_role;
grant execute on function public.borrar_todo()             to authenticated, service_role;

revoke execute on function public.borrar_todos_votos()      from public, anon;
revoke execute on function public.borrar_todos_votantes()   from public, anon;
revoke execute on function public.borrar_todos_candidatos() from public, anon;
revoke execute on function public.borrar_todas_mesas()      from public, anon;
revoke execute on function public.borrar_mesa(uuid)         from public, anon;
revoke execute on function public.borrar_candidato(uuid)    from public, anon;
revoke execute on function public.borrar_tabla(text)        from public, anon;
revoke execute on function public.borrar_todo()             from public, anon;

-- Hacer que PostgREST recargue el esquema y vea las funciones nuevas.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 9. VERIFICACIÓN
-- ------------------------------------------------------------
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'borrar_todo',
    'borrar_tabla',
    'borrar_todos_votos',
    'borrar_todos_votantes',
    'borrar_todos_candidatos',
    'borrar_todas_mesas',
    'borrar_mesa',
    'borrar_candidato'
  )
order by routine_name;
