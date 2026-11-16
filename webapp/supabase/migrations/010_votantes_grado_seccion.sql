-- ============================================================
-- MIGRACIÓN 010: GRADO Y SECCIÓN EN EL PADRÓN
--
-- 1. Agrega columnas grado y seccion a la tabla votantes.
--    Se capturan al agregar un estudiante (manual o CSV) solo
--    como referencia informativa; no restringen en qué mesa
--    puede votar (el padrón es global).
-- 2. Actualiza listar_votantes para devolver grado y seccion.
-- 3. Actualiza importar_votantes y validar_importacion_votantes
--    para aceptar grado y seccion opcionales en el CSV.
--
-- Aplicar después de la migración 008.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NUEVAS COLUMNAS EN VOTANTES
-- ------------------------------------------------------------
alter table public.votantes
  add column if not exists grado text;

alter table public.votantes
  add column if not exists seccion text;

-- ------------------------------------------------------------
-- 2. LISTAR VOTANTES CON GRADO Y SECCIÓN
-- ------------------------------------------------------------
drop function if exists public.listar_votantes(text, boolean, int, int);

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

-- ------------------------------------------------------------
-- 3. IMPORTACIÓN CON GRADO Y SECCIÓN OPCIONALES
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
  v_grado text;
  v_seccion text;
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
    v_grado := trim(coalesce(v_item->>'grado', ''));
    v_seccion := trim(coalesce(v_item->>'seccion', ''));

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
      insert into public.votantes (dni, nombre, grado, seccion, ha_votado)
      values (v_dni, v_nombre, nullif(v_grado, ''), nullif(v_seccion, ''), false)
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
  v_grado text;
  v_seccion text;
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
    v_grado := trim(coalesce(v_item->>'grado', ''));
    v_seccion := trim(coalesce(v_item->>'seccion', ''));
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
      v_preview := v_preview || jsonb_build_object('fila', v_fila, 'dni', v_dni, 'nombre', v_nombre, 'grado', v_grado, 'seccion', v_seccion, 'valido', true, 'motivo', null);
    end if;
  end loop;

  return query select v_validos, v_invalidos, v_errores, v_preview;
end;
$$;

-- ------------------------------------------------------------
-- 4. PERMISOS
-- ------------------------------------------------------------
grant execute on function public.listar_votantes(text, boolean, int, int) to authenticated;
revoke execute on function public.listar_votantes(text, boolean, int, int) from anon, public;

-- ------------------------------------------------------------
-- 5. VERIFICACIÓN
-- ------------------------------------------------------------
select
  column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'votantes'
order by ordinal_position;
