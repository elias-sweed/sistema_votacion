-- ============================================================
-- MIGRACIÓN 002: MESAS Y PADRÓN ELECTORAL - FASE 2 (CORREGIDA)
-- ============================================================
-- Objetivo: Mejorar tablas de mesas y votantes para gestión completa
-- 1. Campo 'activo' en mesas para desactivación suave
-- 2. Índices para consultas eficientes
-- 3. Funciones RPC para estadísticas y importación masiva
-- 4. Validaciones adicionales
-- 5. CORRECCIÓN: Verificación de rol admin en funciones SECURITY DEFINER
-- 6. CORRECCIÓN: SQL dinámico seguro en listar_votantes
-- ============================================================

-- ------------------------------------------------------------
-- 1. MEJORAS A TABLA MESAS
-- ------------------------------------------------------------

-- Agregar campo activo para desactivación suave (soft delete)
alter table public.mesas
  add column if not exists activo boolean not null default true;

-- Índice para consultas por estado activo
create index if not exists idx_mesas_activo on public.mesas (activo);

-- ------------------------------------------------------------
-- 2. MEJORAS A TABLA VOTANTES
-- ------------------------------------------------------------

-- Índice para filtrar por mesa (importante para listados paginados)
create index if not exists idx_votantes_mesa_id on public.votantes (mesa_id);

-- Índice para filtrar por ha_votado (estadísticas de participación)
create index if not exists idx_votantes_ha_votado on public.votantes (ha_votado);

-- Índice compuesto para consultas de padrón por mesa y estado de voto
create index if not exists idx_votantes_mesa_ha_votado on public.votantes (mesa_id, ha_votado);

-- ------------------------------------------------------------
-- 3. FUNCIÓN: ESTADÍSTICAS DEL PADRÓN
-- ------------------------------------------------------------
-- Devuelve totales globales y por mesa para el dashboard admin
-- SOLO ADMIN: verifica is_app_admin() al inicio
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
  -- Verificar que el usuario es admin
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
          count(v.dni) as total,
          count(v.dni) filter (where v.ha_votado = true) as votaron,
          count(v.dni) filter (where v.ha_votado = false) as pendientes,
          case
            when count(v.dni) > 0
            then round((count(v.dni) filter (where v.ha_votado = true)::numeric / count(v.dni)) * 100, 2)
            else 0
          end as participacion_pct
        from public.mesas m
        left join public.votantes v on v.mesa_id = m.id
        where m.activo = true
        group by m.id, m.nombre
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
-- 4. FUNCIÓN: LISTAR VOTANTES CON FILTROS Y PAGINACIÓN
-- ------------------------------------------------------------
-- Para la UI de padrón con búsqueda, filtro por mesa, paginación
-- SOLO ADMIN: verifica is_app_admin() al inicio
-- USA CONSULTA ESTÁTICA CON CONDICIONALES (sin SQL dinámico)
create or replace function public.listar_votantes(
  p_mesa_id uuid default null,
  p_busqueda text default null,
  p_solo_pendientes boolean default false,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  dni text,
  nombre text,
  mesa_id uuid,
  mesa_nombre text,
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
  -- Verificar que el usuario es admin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- Validar límites
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Límite inválido (1-200)' using errcode = 'P0009';
  end if;
  if p_offset < 0 then
    raise exception 'Offset inválido' using errcode = 'P0009';
  end if;

  -- Contar total (para paginación) - consulta con los mismos filtros
  select count(*) into v_total
  from public.votantes v
  where (p_mesa_id is null or v.mesa_id = p_mesa_id)
    and (p_busqueda is null or p_busqueda = '' or v.dni ilike '%' || p_busqueda || '%' or v.nombre ilike '%' || p_busqueda || '%')
    and (not p_solo_pendientes or v.ha_votado = false);

  -- Query principal con join a mesas - usa los mismos filtros
  return query
    select
      v.dni,
      v.nombre,
      v.mesa_id,
      m.nombre as mesa_nombre,
      v.ha_votado,
      v.creado_en,
      v_total as total_count
    from public.votantes v
    join public.mesas m on m.id = v.mesa_id
    where (p_mesa_id is null or v.mesa_id = p_mesa_id)
      and (p_busqueda is null or p_busqueda = '' or v.dni ilike '%' || p_busqueda || '%' or v.nombre ilike '%' || p_busqueda || '%')
      and (not p_solo_pendientes or v.ha_votado = false)
    order by v.nombre
    limit p_limit offset p_offset;
end;
$$;

-- ------------------------------------------------------------
-- 5. FUNCIÓN: IMPORTAR VOTANTES DESDE CSV/EXCEL (BULK INSERT)
-- ------------------------------------------------------------
-- Inserta múltiples votantes en una transacción, validando cada uno
-- Devuelve resumen: insertados, duplicados, errores por fila
-- SOLO ADMIN: verifica is_app_admin() al inicio
create or replace function public.importar_votantes(
  p_votantes jsonb  -- array de objetos {dni, nombre, mesa_id}
)
returns table (
  insertados bigint,
  duplicados bigint,
  errores jsonb,  -- array de {fila, dni, nombre, mesa_id, error}
  detalle jsonb   -- array de {dni, nombre, mesa_id, estado}
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_dni text;
  v_nombre text;
  v_mesa_id uuid;
  v_insertados bigint := 0;
  v_duplicados bigint := 0;
  v_errores jsonb := '[]'::jsonb;
  v_detalle jsonb := '[]'::jsonb;
  v_fila int := 0;
  v_mesa_existe boolean;
  v_dni_valido boolean;
  v_dni_existe boolean;
begin
  -- Verificar que el usuario es admin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- Validar que p_votantes es un array
  if not jsonb_typeof(p_votantes) = 'array' then
    raise exception 'El parámetro debe ser un array JSON' using errcode = 'P0010';
  end if;

  -- Validar tamaño máximo del array (protección contra DoS)
  if jsonb_array_length(p_votantes) > 1000 then
    raise exception 'Máximo 1000 votantes por importación' using errcode = 'P0011';
  end if;

  -- Iterar sobre cada votante
  for v_item in select * from jsonb_array_elements(p_votantes)
  loop
    v_fila := v_fila + 1;

    -- Extraer campos
    v_dni := regexp_replace(coalesce(v_item->>'dni', ''), '\D', '', 'g');
    v_nombre := trim(coalesce(v_item->>'nombre', ''));
    v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;

    -- Validaciones por fila
    v_dni_valido := v_dni ~ '^[0-9]{8}$';
    v_mesa_existe := v_mesa_id is not null and exists (select 1 from public.mesas where id = v_mesa_id and activo = true);

    if not v_dni_valido then
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'DNI inválido (debe ser 8 dígitos)');
      v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'error_dni');
      continue;
    end if;

    if not v_mesa_existe then
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'Mesa inválida o inactiva');
      v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'error_mesa');
      continue;
    end if;

    if v_nombre = '' then
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'Nombre requerido');
      v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'error_nombre');
      continue;
    end if;

    -- Verificar si el DNI ya existe (para dar feedback claro)
    v_dni_existe := exists (select 1 from public.votantes where dni = v_dni);

    -- Intentar insertar (ON CONFLICT para detectar duplicados)
    begin
      insert into public.votantes (dni, nombre, mesa_id, ha_votado)
      values (v_dni, v_nombre, v_mesa_id, false)
      on conflict (dni) do nothing;

      if found then
        v_insertados := v_insertados + 1;
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'insertado');
      else
        v_duplicados := v_duplicados + 1;
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'duplicado');
      end if;
    exception
      when others then
        v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', sqlerrm);
        v_detalle := v_detalle || jsonb_build_object('dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'estado', 'error_bd');
    end;
  end loop;

  return query select v_insertados, v_duplicados, v_errores, v_detalle;
end;
$$;

-- ------------------------------------------------------------
-- 6. FUNCIÓN: VALIDAR ARCHIVO CSV ANTES DE IMPORTAR (PREVIEW)
-- ------------------------------------------------------------
-- Valida estructura y datos sin insertar, para vista previa
-- SOLO ADMIN: verifica is_app_admin() al inicio
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
  v_mesa_id uuid;
  v_validos bigint := 0;
  v_invalidos bigint := 0;
  v_errores jsonb := '[]'::jsonb;
  v_preview jsonb := '[]'::jsonb;
  v_fila int := 0;
  v_mesa_existe boolean;
  v_dni_valido boolean;
  v_dni_existe boolean;
  v_mesa_nombre text;
begin
  -- Verificar que el usuario es admin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  if not jsonb_typeof(p_votantes) = 'array' then
    raise exception 'El parámetro debe ser un array JSON' using errcode = 'P0010';
  end if;

  -- Validar tamaño máximo
  if jsonb_array_length(p_votantes) > 1000 then
    raise exception 'Máximo 1000 votantes por validación' using errcode = 'P0011';
  end if;

  for v_item in select * from jsonb_array_elements(p_votantes)
  loop
    v_fila := v_fila + 1;

    v_dni := regexp_replace(coalesce(v_item->>'dni', ''), '\D', '', 'g');
    v_nombre := trim(coalesce(v_item->>'nombre', ''));
    v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;

    v_dni_valido := v_dni ~ '^[0-9]{8}$';
    v_mesa_existe := v_mesa_id is not null and exists (select 1 from public.mesas where id = v_mesa_id and activo = true);
    v_dni_existe := v_dni_valido and exists (select 1 from public.votantes where dni = v_dni);

    if v_mesa_existe then
      select nombre into v_mesa_nombre from public.mesas where id = v_mesa_id;
    else
      v_mesa_nombre := 'Mesa inválida';
    end if;

    if not v_dni_valido then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'DNI inválido (debe ser 8 dígitos)');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'mesa_nombre', v_mesa_nombre, 'valido', false, 'motivo', 'DNI inválido');
    elsif not v_mesa_existe then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'Mesa inválida o inactiva');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'mesa_nombre', v_mesa_nombre, 'valido', false, 'motivo', 'Mesa inválida');
    elsif v_nombre = '' then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'Nombre requerido');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'mesa_nombre', v_mesa_nombre, 'valido', false, 'motivo', 'Nombre requerido');
    elsif v_dni_existe then
      v_invalidos := v_invalidos + 1;
      v_errores := v_errores || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'error', 'DNI ya existe en el padrón');
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'mesa_nombre', v_mesa_nombre, 'valido', false, 'motivo', 'DNI duplicado');
    else
      v_validos := v_validos + 1;
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'mesa_id', v_mesa_id, 'mesa_nombre', v_mesa_nombre, 'valido', true, 'motivo', null);
    end if;
  end loop;

  return query select v_validos, v_invalidos, v_errores, v_preview;
end;
$$;

-- ------------------------------------------------------------
-- 7. PERMISOS PARA NUEVAS FUNCIONES Y TABLAS ACTUALIZADAS
-- ------------------------------------------------------------
-- Las funciones son SECURITY DEFINER y verifican is_app_admin() internamente.
-- Se concede execute a authenticated, pero la función rechazará si no es admin.
grant execute on function public.obtener_estadisticas_padron() to authenticated;
grant execute on function public.listar_votantes(uuid, text, boolean, int, int) to authenticated;
grant execute on function public.importar_votantes(jsonb) to authenticated;
grant execute on function public.validar_importacion_votantes(jsonb) to authenticated;

-- Revocar de anon y public (defensa en profundidad)
revoke execute on function public.obtener_estadisticas_padron() from anon, public;
revoke execute on function public.listar_votantes(uuid, text, boolean, int, int) from anon, public;
revoke execute on function public.importar_votantes(jsonb) from anon, public;
revoke execute on function public.validar_importacion_votantes(jsonb) from anon, public;

-- ============================================================
-- FIN DE MIGRACIÓN 002
-- ============================================================