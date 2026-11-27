-- ============================================================
-- MIGRACIÓN 006: CONFIGURACIÓN DE ELECCIÓN Y ENLACES POR MESA
--
-- 1. Centro educativo y fecha de actualización en configuracion.
-- 2. Token secreto por mesa para abrir el kiosco en una máquina.
-- 3. Verificación y voto restringidos a la mesa del enlace.
-- 4. Resumen de participación y votos por mesa.
-- 5. Rotación de enlaces por mesa.
--
-- Aplicar después de las migraciones 001–005.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONFIGURACIÓN DE LA ELECCIÓN
-- ------------------------------------------------------------
alter table public.configuracion
  add column if not exists centro text not null default 'I.E. Jimenez Pimentel';

alter table public.configuracion
  add column if not exists actualizado_en timestamptz not null default now();

create or replace function public.configuracion_touch()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_configuracion_touch on public.configuracion;
create trigger trg_configuracion_touch
  before update on public.configuracion
  for each row execute function public.configuracion_touch();

-- ------------------------------------------------------------
-- 2. TOKEN DE ACCESO POR MESA
-- ------------------------------------------------------------
-- Un token distinto por máquina. Quien tenga el enlace puede abrir el
-- kiosco de esa mesa, pero igual necesita un DNI válido del padrón.
alter table public.mesas
  add column if not exists token_acceso text;

alter table public.mesas
  add column if not exists token_actualizado_en timestamptz not null default now();

-- Rellenar mesas existentes con tokens aleatorios de 128 bits.
update public.mesas
set token_acceso = encode(gen_random_bytes(16), 'hex')
where token_acceso is null;

alter table public.mesas
  alter column token_acceso set default encode(gen_random_bytes(16), 'hex');

alter table public.mesas
  alter column token_acceso set not null;

create unique index if not exists idx_mesas_token_acceso
  on public.mesas (token_acceso);

-- ------------------------------------------------------------
-- 3. VERIFICACIÓN LIMITADA A UNA MESA
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
begin
  v_dni := regexp_replace(p_dni, '\D', '', 'g');

  if v_dni is null or length(v_dni) <> 8 or v_dni ~ '\D' then
    return query select null::text, null::text, false;
    return;
  end if;

  return query
    select v.nombre, m.nombre, not v.ha_votado
    from public.votantes v
    join public.mesas m on m.id = v.mesa_id
    where v.dni = v_dni
      and v.mesa_id = p_mesa_id
      and m.activo = true;
end;
$$;

-- Se elimina la versión anterior (sin mesa) para que nadie pueda votar
-- desde un enlace sin restricción de mesa.
drop function if exists public.verificar_votante_con_limite(text, inet, text);

create or replace function public.verificar_votante_con_limite(
  p_dni text,
  p_mesa_id uuid,
  p_client_ip inet,
  p_dni_hash text
)
returns table (nombre text, mesa text, puede_votar boolean, rate_limited boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.verificar_rate_limit(p_client_ip, p_dni_hash, 'verificar_votante') then
    return query select null::text, null::text, false, true;
    return;
  end if;

  perform public.registrar_intento_rate_limit(p_client_ip, p_dni_hash, 'verificar_votante');

  return query
    select v.nombre, v.mesa, v.puede_votar, false
    from public.verificar_votante_en_mesa(p_dni, p_mesa_id) v;
end;
$$;

-- ------------------------------------------------------------
-- 4. VOTO LIMITADO A UNA MESA
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
  v_mesa_id uuid;
  v_dni text;
  v_conf public.configuracion%rowtype;
  v_candidato_exists boolean;
begin
  v_dni := regexp_replace(p_dni, '\D', '', 'g');

  if v_dni is null or length(v_dni) <> 8 or v_dni ~ '\D' then
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

  update public.votantes
     set ha_votado = true
   where dni = v_dni
     and ha_votado = false
   returning mesa_id into v_mesa_id;

  if v_mesa_id is null then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  end if;

  if v_mesa_id <> p_mesa_id then
    raise exception 'El votante no pertenece a esta mesa' using errcode = 'P0013';
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
  values (p_candidato_id, v_mesa_id);
exception
  when sqlstate 'P0001' then raise;
  when sqlstate 'P0002' then raise;
  when sqlstate 'P0003' then raise;
  when sqlstate 'P0004' then raise;
  when sqlstate 'P0005' then raise;
  when sqlstate 'P0012' then raise;
  when sqlstate 'P0013' then raise;
  when unique_violation then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  when foreign_key_violation then
    raise exception 'Candidato o mesa inválida' using errcode = 'P0006';
  when others then
    raise exception 'Error al procesar el voto' using errcode = 'P0000';
end;
$$;

drop function if exists public.emitir_voto_con_limite(text, uuid, inet, text);

create or replace function public.emitir_voto_con_limite(
  p_dni text,
  p_candidato_id uuid,
  p_mesa_id uuid,
  p_client_ip inet,
  p_dni_hash text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.verificar_rate_limit(p_client_ip, p_dni_hash, 'emitir_voto', 5, 3, 1) then
    raise exception 'Demasiados intentos. Espere un momento.' using errcode = 'P0007';
  end if;

  perform public.registrar_intento_rate_limit(p_client_ip, p_dni_hash, 'emitir_voto');

  perform public.emitir_voto_en_mesa(p_dni, p_candidato_id, p_mesa_id);
end;
$$;

-- ------------------------------------------------------------
-- 5. RESUMEN POR MESA PARA EL PANEL
-- ------------------------------------------------------------
-- Incluye votos registrados, padrón, participación y pendientes.
-- No devuelve identidad de votantes ni el orden de los votos.
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
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  return query
    select
      m.id,
      m.nombre,
      m.activo,
      count(v.dni) as total_padron,
      count(v.dni) filter (where v.ha_votado = true) as votaron,
      count(v.dni) filter (where v.ha_votado = false) as pendientes,
      case
        when count(v.dni) > 0
        then round(
          (count(v.dni) filter (where v.ha_votado = true)::numeric / count(v.dni)) * 100,
          2
        )
        else 0
      end as participacion_pct,
      (select count(*) from public.votos vo where vo.mesa_id = m.id) as votos_emitidos
    from public.mesas m
    left join public.votantes v on v.mesa_id = m.id
    group by m.id, m.nombre, m.activo
    order by m.nombre;
end;
$$;

-- ------------------------------------------------------------
-- 6. ROTACIÓN DE ENLACE
-- ------------------------------------------------------------
create or replace function public.rotar_token_mesa(p_mesa_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_token text;
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  v_token := encode(gen_random_bytes(16), 'hex');

  update public.mesas
  set token_acceso = v_token,
      token_actualizado_en = now()
  where id = p_mesa_id;

  if not found then
    raise exception 'Mesa no encontrada' using errcode = 'P0014';
  end if;

  return v_token;
end;
$$;

-- ------------------------------------------------------------
-- 7. PERMISOS
-- ------------------------------------------------------------
revoke execute on function public.verificar_votante_en_mesa(text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.emitir_voto_en_mesa(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.verificar_votante_con_limite(text, uuid, inet, text) from public, anon, authenticated;
revoke execute on function public.emitir_voto_con_limite(text, uuid, uuid, inet, text) from public, anon, authenticated;

grant execute on function public.verificar_votante_con_limite(text, uuid, inet, text) to service_role;
grant execute on function public.emitir_voto_con_limite(text, uuid, uuid, inet, text) to service_role;

revoke execute on function public.obtener_resumen_mesas() from public, anon;
grant execute on function public.obtener_resumen_mesas() to authenticated;

revoke execute on function public.rotar_token_mesa(uuid) from public, anon;
grant execute on function public.rotar_token_mesa(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8. VERIFICACIÓN
-- ------------------------------------------------------------
select
  count(*) as mesas,
  count(token_acceso) as mesas_con_token,
  count(*) filter (where token_acceso is null) as mesas_sin_token
from public.mesas;
