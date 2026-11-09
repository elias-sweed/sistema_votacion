-- ============================================================
-- FIX RLS: ORDEN CORRECTO (eliminar políticas ANTES de funciones)
--
-- 1. Eliminar TODAS las políticas existentes (dependen de es_admin_uuid)
-- 2. Eliminar funciones existentes
-- 3. Crear función es_admin_uuid() nueva (SECURITY DEFINER)
-- 4. Activar RLS en todas las tablas
-- 5. Crear políticas basadas en auth.uid()
-- 6. Conceder GRANTs
-- 7. Crear/actualizar funciones RPC
--
-- UUID del administrador: 1fbf5137-09fa-404f-8232-e21788a047f8
-- ============================================================

-- ------------------------------------------------------------
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ------------------------------------------------------------
drop policy if exists "admin_full_mesas" on public.mesas;
drop policy if exists "admin_full_votantes" on public.votantes;
drop policy if exists "admin_full_candidatos" on public.candidatos;
drop policy if exists "admin_full_votos" on public.votos;
drop policy if exists "admin_full_configuracion" on public.configuracion;
drop policy if exists "anon_lee_candidatos_activos" on public.candidatos;

drop policy if exists "admin_uuid_mesas_select" on public.mesas;
drop policy if exists "admin_uuid_mesas_insert" on public.mesas;
drop policy if exists "admin_uuid_mesas_update" on public.mesas;
drop policy if exists "admin_uuid_mesas_delete" on public.mesas;

drop policy if exists "admin_uuid_votantes_select" on public.votantes;
drop policy if exists "admin_uuid_votantes_insert" on public.votantes;
drop policy if exists "admin_uuid_votantes_update" on public.votantes;
drop policy if exists "admin_uuid_votantes_delete" on public.votantes;

drop policy if exists "admin_uuid_candidatos_select" on public.candidatos;
drop policy if exists "admin_uuid_candidatos_insert" on public.candidatos;
drop policy if exists "admin_uuid_candidatos_update" on public.candidatos;
drop policy if exists "admin_uuid_candidatos_delete" on public.candidatos;
drop policy if exists "anon_uuid_candidatos_select" on public.candidatos;

drop policy if exists "admin_uuid_votos_select" on public.votos;
drop policy if exists "admin_uuid_votos_insert" on public.votos;
drop policy if exists "admin_uuid_votos_update" on public.votos;
drop policy if exists "admin_uuid_votos_delete" on public.votos;
drop policy if exists "admin_read_votos" on public.votos;

drop policy if exists "admin_uuid_configuracion_select" on public.configuracion;
drop policy if exists "admin_uuid_configuracion_insert" on public.configuracion;
drop policy if exists "admin_uuid_configuracion_update" on public.configuracion;
drop policy if exists "admin_uuid_configuracion_delete" on public.configuracion;

-- ------------------------------------------------------------
-- PASO 2: ELIMINAR FUNCIONES EXISTENTES
-- ------------------------------------------------------------
drop function if exists public.es_admin_uuid();
drop function if exists public.borrar_todas_mesas();
drop function if exists public.borrar_todos_votantes();
drop function if exists public.borrar_todos_candidatos();
drop function if exists public.borrar_todo();
drop function if exists public.listar_votantes(text, boolean, int, int);
drop function if exists public.obtener_estadisticas_padron();
drop function if exists public.obtener_resumen_mesas();

-- ------------------------------------------------------------
-- PASO 3: CREAR FUNCIÓN es_admin_uuid() (SECURITY DEFINER)
-- ------------------------------------------------------------
create or replace function public.es_admin_uuid()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() = '1fbf5137-09fa-404f-8232-e21788a047f8'::uuid;
$$;

grant execute on function public.es_admin_uuid() to authenticated;
revoke execute on function public.es_admin_uuid() from public, anon;

-- ------------------------------------------------------------
-- PASO 4: ACTIVAR RLS EN TODAS LAS TABLAS
-- ------------------------------------------------------------
alter table public.mesas          enable row level security;
alter table public.votantes       enable row level security;
alter table public.candidatos     enable row level security;
alter table public.votos          enable row level security;
alter table public.configuracion enable row level security;

-- ------------------------------------------------------------
-- PASO 5: CREAR POLÍTICAS BASADAS EN auth.uid()
-- ------------------------------------------------------------

-- MESAS
create policy "admin_uuid_mesas_select" on public.mesas
  for select to authenticated using (public.es_admin_uuid());
create policy "admin_uuid_mesas_insert" on public.mesas
  for insert to authenticated with check (public.es_admin_uuid());
create policy "admin_uuid_mesas_update" on public.mesas
  for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid());
create policy "admin_uuid_mesas_delete" on public.mesas
  for delete to authenticated using (public.es_admin_uuid());

-- VOTANTES
create policy "admin_uuid_votantes_select" on public.votantes
  for select to authenticated using (public.es_admin_uuid());
create policy "admin_uuid_votantes_insert" on public.votantes
  for insert to authenticated with check (public.es_admin_uuid());
create policy "admin_uuid_votantes_update" on public.votantes
  for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid());
create policy "admin_uuid_votantes_delete" on public.votantes
  for delete to authenticated using (public.es_admin_uuid());

-- CANDIDATOS
create policy "admin_uuid_candidatos_select" on public.candidatos
  for select to authenticated using (public.es_admin_uuid());
create policy "admin_uuid_candidatos_insert" on public.candidatos
  for insert to authenticated with check (public.es_admin_uuid());
create policy "admin_uuid_candidatos_update" on public.candidatos
  for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid());
create policy "admin_uuid_candidatos_delete" on public.candidatos
  for delete to authenticated using (public.es_admin_uuid());
create policy "anon_uuid_candidatos_select" on public.candidatos
  for select to anon using (activo = true);

-- VOTOS
create policy "admin_uuid_votos_select" on public.votos
  for select to authenticated using (public.es_admin_uuid());
create policy "admin_uuid_votos_insert" on public.votos
  for insert to authenticated with check (public.es_admin_uuid());
create policy "admin_uuid_votos_update" on public.votos
  for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid());
create policy "admin_uuid_votos_delete" on public.votos
  for delete to authenticated using (public.es_admin_uuid());

-- CONFIGURACIÓN
create policy "admin_uuid_configuracion_select" on public.configuracion
  for select to authenticated using (public.es_admin_uuid());
create policy "admin_uuid_configuracion_insert" on public.configuracion
  for insert to authenticated with check (public.es_admin_uuid());
create policy "admin_uuid_configuracion_update" on public.configuracion
  for update to authenticated using (public.es_admin_uuid()) with check (public.es_admin_uuid());
create policy "admin_uuid_configuracion_delete" on public.configuracion
  for delete to authenticated using (public.es_admin_uuid());

-- ------------------------------------------------------------
-- PASO 6: CONCEDER PERMISOS (GRANT)
-- ------------------------------------------------------------
grant select, insert, update, delete on public.mesas to authenticated;
grant select, insert, update, delete on public.votantes to authenticated;
grant select, insert, update, delete on public.candidatos to authenticated;
grant select, insert, update, delete on public.votos to authenticated;
grant select, insert, update, delete on public.configuracion to authenticated;
grant select on public.candidatos to anon;

-- Secuencias
grant usage, select on sequence public.votos_id_seq to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- PASO 7: CREAR FUNCIONES RPC
-- ------------------------------------------------------------
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
  delete from public.votos;
  delete from public.mesas;
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
  delete from public.votantes;
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
  delete from public.candidatos;
end;
$$;

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
  delete from public.votos;
  delete from public.votantes;
  delete from public.candidatos;
  delete from public.mesas;
  update public.configuracion
  set eleccion_abierta = false,
      titulo = 'Elección de Municipios Escolares',
      centro = 'I.E. Jimenez Pimentel',
      logo_url = null,
      actualizado_en = now()
  where id = 1;
end;
$$;

create or replace function public.listar_votantes(
  p_busqueda text default null,
  p_solo_pendientes boolean default false,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  dni text,
  nombre text,
  grado text,
  seccion text,
  ha_votado boolean,
  creado_en timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_total bigint;
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'Límite inválido (1-200)' using errcode = 'P0009';
  end if;
  if p_offset < 0 then
    raise exception 'Offset inválido' using errcode = 'P0009';
  end if;

  select count(*) into v_total
  from public.votantes v
  where (p_busqueda is null or p_busqueda = '' or v.dni ilike '%' || p_busqueda || '%' or v.nombre ilike '%' || p_busqueda || '%')
    and (not p_solo_pendientes or v.ha_votado = false);

  return query
    select
      v.dni,
      v.nombre,
      v.grado,
      v.seccion,
      v.ha_votado,
      v.creado_en,
      v_total as total_count
    from public.votantes v
    where (p_busqueda is null or p_busqueda = '' or v.dni ilike '%' || p_busqueda || '%' or v.nombre ilike '%' || p_busqueda || '%')
      and (not p_solo_pendientes or v.ha_votado = false)
    order by v.nombre
    limit p_limit offset p_offset;
end;
$$;

create or replace function public.obtener_estadisticas_padron()
returns table (
  total_votantes bigint,
  total_votaron bigint,
  total_pendientes bigint,
  participacion_pct numeric,
  por_mesa jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  return query
    with totales as (
      select
        count(*) as total_votantes,
        count(*) filter (where ha_votado = true) as total_votaron,
        count(*) filter (where ha_votado = false) as total_pendientes
      from public.votantes
    ),
    por_mesa_agg as (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as por_mesa
      from (
        select
          m.id as mesa_id,
          m.nombre as mesa_nombre,
          votos.cantidad as total,
          votos.cantidad as votaron,
          0::bigint as pendientes,
          case
            when (select count(*) from public.votos) > 0
            then round((votos.cantidad::numeric / (select count(*) from public.votos)) * 100, 2)
            else 0
          end as participacion_pct
        from public.mesas m
        cross join lateral (
          select count(*) as cantidad from public.votos v where v.mesa_id = m.id
        ) votos
        where m.activo = true
        order by m.nombre
      ) t
    )
    select
      t.total_votantes,
      t.total_votaron,
      t.total_pendientes,
      case when t.total_votantes > 0 then round((t.total_votaron::numeric / t.total_votantes) * 100, 2) else 0 end,
      p.por_mesa
    from totales t, por_mesa_agg p;
end;
$$;

create or replace function public.obtener_resumen_mesas()
returns table (
  mesa_id uuid,
  nombre text,
  activo boolean,
  total_padron bigint,
  votaron bigint,
  pendientes bigint,
  participacion_pct numeric,
  votos_emitidos bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_total bigint;
  v_votaron bigint;
begin
  if not public.es_admin_uuid() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  select count(*) into v_total from public.votantes;
  select count(*) into v_votaron from public.votantes where ha_votado = true;

  return query
    select
      m.id,
      m.nombre,
      m.activo,
      v_total,
      v_votaron,
      v_total - v_votaron,
      case when v_total > 0 then round((v_votaron::numeric / v_total) * 100, 2) else 0 end,
      (select count(*) from public.votos vo where vo.mesa_id = m.id)
    from public.mesas m
    order by m.nombre;
end;
$$;

-- ------------------------------------------------------------
-- PASO 8: PERMISOS DE FUNCIONES
-- ------------------------------------------------------------
grant execute on function public.es_admin_uuid() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.listar_votantes(text, boolean, int, int) to authenticated;
grant execute on function public.obtener_estadisticas_padron() to authenticated;
grant execute on function public.importar_votantes(jsonb) to authenticated;
grant execute on function public.validar_importacion_votantes(jsonb) to authenticated;
grant execute on function public.obtener_resumen_mesas() to authenticated;
grant execute on function public.rotar_token_mesa(uuid) to authenticated;
grant execute on function public.borrar_todas_mesas() to authenticated;
grant execute on function public.borrar_todos_votantes() to authenticated;
grant execute on function public.borrar_todos_candidatos() to authenticated;
grant execute on function public.borrar_todo() to authenticated;
grant execute on function public.verificar_votante_con_limite(text, uuid, inet, text) to service_role;
grant execute on function public.emitir_voto_con_limite(text, uuid, uuid, inet, text) to service_role;

-- Resultados
grant select on public.resultados to authenticated;
revoke all on public.resultados from public, anon;

-- ------------------------------------------------------------
-- PASO 9: VERIFICACIÓN
-- ------------------------------------------------------------
select 'POLITICA' as tipo, tablename as objeto, policyname as detalle, cmd as operacion
from pg_policies
where schemaname = 'public'
  and policyname like 'admin_uuid_%'
union all
select 'RLS', tablename, rowsecurity::text, ''
from pg_tables
where schemaname = 'public'
  and tablename in ('mesas', 'votantes', 'candidatos', 'votos', 'configuracion')
order by tipo, objeto;
