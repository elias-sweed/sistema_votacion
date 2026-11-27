-- ============================================================
-- MIGRACIÓN 008: PADRÓN GLOBAL Y MESAS SOLO COMO ENLACE
--
-- 1. El padrón deja de pertenecer a una mesa: un votante puede
--    votar desde el enlace de cualquier mesa activa.
-- 2. La mesa se registra en el voto según el enlace usado.
-- 3. Listados, importación y estadísticas se adaptan al padrón global.
--
-- Aplicar después de la migración 007.
-- ============================================================

-- ------------------------------------------------------------
-- 1. QUITAR LA MESA DEL PADRÓN
-- ------------------------------------------------------------
drop index if exists public.idx_votantes_mesa_id;
drop index if exists public.idx_votantes_mesa_ha_votado;

alter table public.votantes
  drop column if exists mesa_id cascade;

-- Índice para contar votos por mesa en el panel.
create index if not exists idx_votos_mesa_id on public.votos (mesa_id);

-- ------------------------------------------------------------
-- 2. VERIFICACIÓN LIMITADA AL ENLACE (SIN MESA DEL VOTANTE)
-- ------------------------------------------------------------
create or replace function public.verificar_votante_en_mesa(
  p_dni text,
  p_mesa_id uuid
)
returns table (nombre text, mesa text, puede_votar boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dni text;
  v_mesa text;
begin
  v_dni := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if v_dni is null or length(v_dni) <> 8 then
    return query select null::text, null::text, false;
    return;
  end if;

  select m.nombre into v_mesa
  from public.mesas m
  where m.id = p_mesa_id and m.activo = true;

  if v_mesa is null then
    return query select null::text, null::text, false;
    return;
  end if;

  return query
    select v.nombre, v_mesa, not v.ha_votado
    from public.votantes v
    where v.dni = v_dni;
end;
$$;

-- ------------------------------------------------------------
-- 3. VOTO REGISTRADO EN LA MESA DEL ENLACE
-- ------------------------------------------------------------
create or replace function public.emitir_voto_en_mesa(
  p_dni text,
  p_candidato_id uuid,
  p_mesa_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dni text;
  v_conf public.configuracion%rowtype;
  v_candidato_exists boolean;
begin
  v_dni := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if v_dni is null or length(v_dni) <> 8 then
    raise exception 'DNI inválido' using errcode = 'P0001';
  end if;

  if p_candidato_id is null then
    raise exception 'Candidato requerido' using errcode = 'P0002';
  end if;

  if p_mesa_id is null then
    raise exception 'Mesa requerida' using errcode = 'P0012';
  end if;

  select * into v_conf
  from public.configuracion
  where id = 1
  for share;

  if not v_conf.eleccion_abierta then
    raise exception 'La elección está cerrada' using errcode = 'P0003';
  end if;

  if not exists (
    select 1 from public.mesas where id = p_mesa_id and activo = true
  ) then
    raise exception 'Mesa inválida o inactiva' using errcode = 'P0012';
  end if;

  -- El votante pertenece al padrón global; la mesa sale del enlace.
  update public.votantes
     set ha_votado = true
   where dni = v_dni
     and ha_votado = false;

  if not found then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  end if;

  select exists (
    select 1 from public.candidatos
    where id = p_candidato_id and activo = true
    for share
  ) into v_candidato_exists;

  if not v_candidato_exists then
    raise exception 'Candidato inválido o inactivo' using errcode = 'P0005';
  end if;

  insert into public.votos (candidato_id, mesa_id)
  values (p_candidato_id, p_mesa_id);
exception
  when sqlstate 'P0001' then raise;
  when sqlstate 'P0002' then raise;
  when sqlstate 'P0003' then raise;
  when sqlstate 'P0004' then raise;
  when sqlstate 'P0005' then raise;
  when sqlstate 'P0012' then raise;
  when unique_violation then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  when foreign_key_violation then
    raise exception 'Candidato o mesa inválida' using errcode = 'P0006';
  when others then
    raise exception 'Error al procesar el voto' using errcode = 'P0000';
end;
$$;

-- ------------------------------------------------------------
-- 4. LISTADO DEL PADRÓN (SIN FILTRO NI DATO DE MESA)
-- ------------------------------------------------------------
drop function if exists public.listar_votantes(uuid, text, boolean, int, int);

create or replace function public.listar_votantes(
  p_busqueda text default null,
  p_solo_pendientes boolean default false,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  dni text,
  nombre text,
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
  if not public.is_app_admin() then
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

-- ------------------------------------------------------------
-- 5. ESTADÍSTICAS DEL PADRÓN (GLOBAL + VOTOS POR MESA)
-- ------------------------------------------------------------
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
  if not public.is_app_admin() then
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

-- ------------------------------------------------------------
-- 6. RESUMEN POR MESA (PADRÓN GLOBAL Y VOTOS DE CADA MESA)
-- ------------------------------------------------------------
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
  if not public.is_app_admin() then
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
-- 7. IMPORTACIÓN SIN MESA
-- ------------------------------------------------------------
create or replace function public.importar_votantes(
  p_votantes jsonb
)
returns table (
  insertados bigint,
  duplicados bigint,
  errores jsonb,
  detalle jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_dni text;
  v_nombre text;
  v_insertados bigint := 0;
  v_duplicados bigint := 0;
  v_errores jsonb := '[]'::jsonb;
  v_detalle jsonb := '[]'::jsonb;
  v_fila int := 0;
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if not jsonb_typeof(p_votantes) = 'array' then
    raise exception 'El parámetro debe ser un array JSON' using errcode = 'P0010';
  end if;

  if jsonb_array_length(p_votantes) > 1000 then
    raise exception 'Máximo 1000 votantes por importación' using errcode = 'P0011';
  end if;

  for v_item in select * from jsonb_array_elements(p_votantes)
  loop
    v_fila := v_fila + 1;

    v_dni := regexp_replace(coalesce(v_item->>'dni', ''), '\D', '', 'g');
    v_nombre := trim(coalesce(v_item->>'nombre', ''));

    if v_dni !~ '^[0-9]{8}$' then
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', 'DNI inválido (debe ser 8 dígitos)');
      v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'estado', 'error_dni');
      continue;
    end if;

    if v_nombre = '' then
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', 'Nombre requerido');
      v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'estado', 'error_nombre');
      continue;
    end if;

    begin
      insert into public.votantes (dni, nombre, ha_votado)
      values (v_dni, v_nombre, false)
      on conflict (dni) do nothing;

      if found then
        v_insertados := v_insertados + 1;
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'estado', 'insertado');
      else
        v_duplicados := v_duplicados + 1;
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'estado', 'duplicado');
      end if;
    exception
      when others then
        v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', sqlerrm);
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'estado', 'error_bd');
    end;
  end loop;

  return query select v_insertados, v_duplicados, v_errores, v_detalle;
end;
$$;

create or replace function public.validar_importacion_votantes(
  p_votantes jsonb
)
returns table (
  validos bigint,
  invalidos bigint,
  errores jsonb,
  preview jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_dni text;
  v_nombre text;
  v_validos bigint := 0;
  v_invalidos bigint := 0;
  v_errores jsonb := '[]'::jsonb;
  v_preview jsonb := '[]'::jsonb;
  v_fila int := 0;
  v_dni_existe boolean;
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if not jsonb_typeof(p_votantes) = 'array' then
    raise exception 'El parámetro debe ser un array JSON' using errcode = 'P0010';
  end if;

  if jsonb_array_length(p_votantes) > 1000 then
    raise exception 'Máximo 1000 votantes por validación' using errcode = 'P0011';
  end if;

  for v_item in select * from jsonb_array_elements(p_votantes)
  loop
    v_fila := v_fila + 1;

    v_dni := regexp_replace(coalesce(v_item->>'dni', ''), '\D', '', 'g');
    v_nombre := trim(coalesce(v_item->>'nombre', ''));
    v_dni_existe := v_dni ~ '^[0-9]{8}$' and exists (select 1 from public.votantes where dni = v_dni);

    if v_dni !~ '^[0-9]{8}$' then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', 'DNI inválido (debe ser 8 dígitos)');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'valido', false, 'motivo', 'DNI inválido');
    elsif v_nombre = '' then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', 'Nombre requerido');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'valido', false, 'motivo', 'Nombre requerido');
    elsif v_dni_existe then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'error', 'DNI ya existe en el padrón');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'valido', false, 'motivo', 'DNI duplicado');
    else
      v_validos := v_validos + 1;
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'valido', true, 'motivo', null);
    end if;
  end loop;

  return query select v_validos, v_invalidos, v_errores, v_preview;
end;
$$;

-- ------------------------------------------------------------
-- 8. PERMISOS
-- ------------------------------------------------------------
grant execute on function public.listar_votantes(text, boolean, int, int) to authenticated;
revoke execute on function public.listar_votantes(text, boolean, int, int) from anon, public;

-- ------------------------------------------------------------
-- 9. VERIFICACIÓN
-- ------------------------------------------------------------
select
  (select count(*) from public.votantes) as votantes,
  (select count(*) from public.mesas) as mesas,
  (select count(*) from public.votos) as votos;
