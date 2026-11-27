-- ============================================================
-- MIGRACIÓN 018: OPERADORES CON PERMISOS LIMITADOS Y AUDITORÍA
--
-- Aplicar DESPUÉS de 016 y 017. Idempotente: se puede ejecutar varias veces.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/018_operadores_auditoria.sql
--
-- Modelo:
--   admin    -> acceso completo (UUID fijo o app_metadata.role = 'admin')
--   operador -> candidatos: ver/agregar/editar/activar (NO eliminar)
--               mesa: solo ver
--               padrón: ver/agregar/importar/eliminar
--               nada más
-- ============================================================

-- 1. Helpers de rol -------------------------------------------------------
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'operador'
    and exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and (u.banned_until is null or u.banned_until <= now())
    ),
    false
  );
$$;

create or replace function public.puede_padron()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.es_admin_uuid() or public.es_operador();
$$;

create or replace function public.puede_ver_mesas()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.es_admin_uuid() or public.es_operador();
$$;

revoke execute on function public.es_operador() from public, anon;
grant execute on function public.es_operador() to authenticated, service_role;
revoke execute on function public.puede_padron() from public, anon;
grant execute on function public.puede_padron() to authenticated, service_role;
revoke execute on function public.puede_ver_mesas() from public, anon;
grant execute on function public.puede_ver_mesas() to authenticated, service_role;

-- 2. RLS: permisos mínimos del operador ----------------------------------
drop policy if exists operador_candidatos_select on public.candidatos;
create policy operador_candidatos_select on public.candidatos
  for select to authenticated using (public.es_operador());

drop policy if exists operador_candidatos_insert on public.candidatos;
create policy operador_candidatos_insert on public.candidatos
  for insert to authenticated with check (public.es_operador());

drop policy if exists operador_candidatos_update on public.candidatos;
create policy operador_candidatos_update on public.candidatos
  for update to authenticated using (public.es_operador()) with check (public.es_operador());
-- No hay política DELETE para operador: borrar candidato sigue siendo solo admin.

drop policy if exists operador_mesas_select on public.mesas;
create policy operador_mesas_select on public.mesas
  for select to authenticated using (public.es_operador());
-- Sin INSERT/UPDATE/DELETE/RPC de token para operador.

drop policy if exists operador_votantes_select on public.votantes;
create policy operador_votantes_select on public.votantes
  for select to authenticated using (public.es_operador());

drop policy if exists operador_votantes_insert on public.votantes;
create policy operador_votantes_insert on public.votantes
  for insert to authenticated with check (public.es_operador());

drop policy if exists operador_votantes_delete on public.votantes;
create policy operador_votantes_delete on public.votantes
  for delete to authenticated using (public.es_operador());

-- 3. Auditoría -----------------------------------------------------------
create table if not exists public.auditoria_operador (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  actor_uuid uuid,
  actor_email text,
  rol text,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb not null default '{}'::jsonb
);

create index if not exists auditoria_operador_creado_en_idx
  on public.auditoria_operador (creado_en desc);

alter table public.auditoria_operador enable row level security;

drop policy if exists auditoria_solo_admin on public.auditoria_operador;
create policy auditoria_solo_admin on public.auditoria_operador
  for select to authenticated using (public.es_admin_uuid());

revoke all on table public.auditoria_operador from public, anon;
grant select on table public.auditoria_operador to authenticated;

-- El inserter es SECURITY DEFINER: ni admin ni operador pueden escribir
-- directamente el historial, solo los triggers de esta migración.
create or replace function public.registrar_movimiento(
  p_accion text,
  p_entidad text,
  p_entidad_id text,
  p_detalle jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rol text := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));
begin
  if v_rol not in ('admin', 'operador') then
    return;
  end if;

  insert into public.auditoria_operador
    (actor_uuid, actor_email, rol, accion, entidad, entidad_id, detalle)
  values
    (
      nullif(auth.jwt() ->> 'sub', '')::uuid,
      coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'),
      v_rol,
      p_accion,
      p_entidad,
      p_entidad_id,
      coalesce(p_detalle, '{}'::jsonb)
    );
end;
$$;

-- Ni admin ni operador pueden llamar a este RPC directamente: solo lo
-- invocan los triggers. El propietario de la función conserva EXECUTE.
revoke all on function public.registrar_movimiento(text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function public.auditar_candidatos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_movimiento(
      'alta', 'candidato', new.id::text,
      jsonb_build_object('nombre', new.nombre, 'activo', new.activo)
    );
  elsif tg_op = 'UPDATE' then
    if old.activo is distinct from new.activo then
      perform public.registrar_movimiento(
        case when new.activo then 'activar' else 'desactivar' end,
        'candidato', new.id::text,
        jsonb_build_object('nombre', new.nombre, 'activo', new.activo)
      );
    else
      perform public.registrar_movimiento(
        'editar', 'candidato', new.id::text,
        jsonb_build_object('nombre', new.nombre, 'activo', new.activo)
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform public.registrar_movimiento(
      'eliminar', 'candidato', old.id::text,
      jsonb_build_object('nombre', old.nombre)
    );
  end if;
  return null;
end;
$$;

revoke all on function public.auditar_candidatos() from public, anon, authenticated;

drop trigger if exists candidatos_auditoria on public.candidatos;
create trigger candidatos_auditoria
after insert or update or delete on public.candidatos
for each row execute function public.auditar_candidatos();

create or replace function public.auditar_votantes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_movimiento(
      'alta', 'votante', new.dni,
      jsonb_build_object('nombre', new.nombre, 'grado', new.grado, 'seccion', new.seccion)
    );
  elsif tg_op = 'DELETE' then
    perform public.registrar_movimiento(
      'eliminar', 'votante', old.dni,
      jsonb_build_object('nombre', old.nombre)
    );
  end if;
  return null;
end;
$$;

revoke all on function public.auditar_votantes() from public, anon, authenticated;

drop trigger if exists votantes_auditoria on public.votantes;
create trigger votantes_auditoria
after insert or delete on public.votantes
for each row execute function public.auditar_votantes();

-- 4. RPC del padrón: admin u operador ------------------------------------
-- Se recrean con el mismo nombre/firma para que el front siga usando las
-- mismas funciones. La lógica es la de 017; cambia únicamente el guard.

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
  if not public.puede_padron() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador' using errcode = 'P0008';
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
    select v.dni, v.nombre, v.grado, v.seccion, v.ha_votado, v.creado_en, v_total
    from public.votantes v
    where (p_busqueda is null or p_busqueda = '' or v.dni ilike '%' || p_busqueda || '%' or v.nombre ilike '%' || p_busqueda || '%')
      and (not p_solo_pendientes or v.ha_votado = false)
    order by v.nombre
    limit p_limit offset p_offset;
end;
$$;

create or replace function public.validar_importacion_votantes(p_votantes jsonb)
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
  if not public.puede_padron() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador' using errcode = 'P0008';
  end if;

  if jsonb_typeof(p_votantes) <> 'array' then
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

create or replace function public.importar_votantes(p_votantes jsonb)
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
  if not public.puede_padron() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador' using errcode = 'P0008';
  end if;

  if jsonb_typeof(p_votantes) <> 'array' then
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

drop function if exists public.obtener_estadisticas_padron();
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
  if not public.puede_padron() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador' using errcode = 'P0008';
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

drop function if exists public.obtener_resumen_mesas();
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
  if not public.puede_ver_mesas() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador' using errcode = 'P0008';
  end if;

  select count(*) into v_total from public.votantes;
  select count(*) into v_votaron from public.votantes where ha_votado = true;

  return query
    select
      m.id, m.nombre, m.activo, v_total, v_votaron, v_total - v_votaron,
      case when v_total > 0 then round((v_votaron::numeric / v_total) * 100, 2) else 0 end,
      (select count(*) from public.votos vo where vo.mesa_id = m.id)
    from public.mesas m
    order by m.nombre;
end;
$$;

-- 5. Permisos ------------------------------------------------------------
revoke execute on function public.listar_votantes(text, boolean, int, int) from public, anon;
grant execute on function public.listar_votantes(text, boolean, int, int) to authenticated, service_role;
revoke execute on function public.validar_importacion_votantes(jsonb) from public, anon;
grant execute on function public.validar_importacion_votantes(jsonb) to authenticated, service_role;
revoke execute on function public.importar_votantes(jsonb) from public, anon;
grant execute on function public.importar_votantes(jsonb) to authenticated, service_role;
revoke execute on function public.obtener_estadisticas_padron() from public, anon;
grant execute on function public.obtener_estadisticas_padron() to authenticated, service_role;
revoke execute on function public.obtener_resumen_mesas() from public, anon;
grant execute on function public.obtener_resumen_mesas() to authenticated, service_role;

notify pgrst, 'reload schema';

-- 6. Verificación --------------------------------------------------------
-- Debe devolver: es_operador, puede_padron, puede_ver_mesas, auditoria_operador.
select public.es_operador() as operador, public.puede_padron() as padron, public.puede_ver_mesas() as mesas;
select count(*) as filas_auditoria from public.auditoria_operador;
