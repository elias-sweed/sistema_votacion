-- ============================================================
-- MIGRACIÓN 022: REPARAR EL VOTO ÚNICO
--
-- Aplicar DESPUÉS de 020 y 021. Idempotente: se puede ejecutar varias veces.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/022_fix_voto_unico.sql
--
-- CAUSA DEL BUG
--  La migración 020 creó un trigger BEFORE UPDATE que copiaba el valor
--  anterior de ha_votado en el registro nuevo. Ese trigger también se
--  dispara cuando emitir_voto_en_mesa marca al votante como "ya votó".
--  El voto se insertaba, pero ha_votado volvía a false, así que el mismo
--  DNI podía votar otra vez.
--
-- SOLUCIÓN
--  1. El trigger vuelve a permitir false -> true (votar) y solo bloquea
--     true -> false (desmarcar) y el cambio de DNI de quien ya votó.
--  2. emitir_voto_en_mesa bloquea la fila del votante (FOR UPDATE),
--     comprueba ha_votado ANTES y DESPUÉS del UPDATE y falla si el cambio
--     no quedó registrado. Así ningún trigger puede reabrir el voto.
--  3. Si falta la fila de configuración, la elección se considera cerrada
--     (antes podía votarse con un NULL).
--
-- NOTA SOBRE DATOS YA REGISTRADOS
--  Mientras el trigger estuvo mal, los votos se guardaron en public.votos
--  pero ha_votado quedó en false. Como los votos son anónimos (no guardan
--  DNI), no se puede reconstruir qué estudiantes votaron. Si ya se emitieron
--  votos con la versión anterior, el administrador debe revisar el panel y
--  decidir si cierra la elección antes de permitir una nueva ronda.
-- ============================================================

-- 1. Trigger de integridad corregido --------------------------------------
create or replace function public.proteger_votantes_edicion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.ha_votado then
    if new.dni is distinct from old.dni then
      raise exception 'No se puede cambiar el DNI de un votante que ya votó'
        using errcode = 'P0003';
    end if;
    -- Quien ya votó NO puede volver a quedar pendiente.
    new.ha_votado := true;
  end if;

  -- false -> true (emitir voto) SÍ está permitido.
  new.creado_en := old.creado_en;
  return new;
end;
$$;

revoke all on function public.proteger_votantes_edicion() from public, anon, authenticated;

drop trigger if exists votantes_proteger_edicion on public.votantes;
create trigger votantes_proteger_edicion
before update on public.votantes
for each row execute function public.proteger_votantes_edicion();

-- 2. Emisión del voto: bloqueo + doble comprobación -----------------------
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
  v_ya_voto boolean;
  v_quedo_marcado boolean;
begin
  v_dni := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if length(v_dni) <> 8 then
    raise exception 'DNI inválido' using errcode = 'P0001';
  end if;
  if p_candidato_id is null then
    raise exception 'Candidato requerido' using errcode = 'P0002';
  end if;
  if p_mesa_id is null then
    raise exception 'Mesa requerida' using errcode = 'P0012';
  end if;

  -- Elección cerrada si no hay configuración o si está marcada como cerrada.
  select * into v_conf
  from public.configuracion
  where id = 1
  for share;

  if not found or not v_conf.eleccion_abierta then
    raise exception 'La elección está cerrada' using errcode = 'P0003';
  end if;

  if not exists (
    select 1 from public.mesas where id = p_mesa_id and activo = true
  ) then
    raise exception 'Mesa inválida o inactiva' using errcode = 'P0012';
  end if;

  -- Serializa dos intentos concurrentes con el mismo DNI.
  select ha_votado into v_ya_voto
  from public.votantes
  where dni = v_dni
  for update;

  if not found or v_ya_voto is true then
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

  update public.votantes
     set ha_votado = true
   where dni = v_dni
     and ha_votado = false;

  if not found then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  end if;

  -- Si algún trigger revirtiera el cambio, NO se registra el voto.
  select ha_votado into v_quedo_marcado
  from public.votantes
  where dni = v_dni;

  if v_quedo_marcado is not true then
    raise exception 'No se pudo registrar el voto; intente nuevamente'
      using errcode = 'P0000';
  end if;

  -- El padrón es global: la mesa se toma del enlace usado.
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

revoke all on function public.emitir_voto_en_mesa(text, uuid, uuid) from public, anon;
grant execute on function public.emitir_voto_en_mesa(text, uuid, uuid) to service_role;

-- 3. La verificación sigue reflejando el estado real ----------------------
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

  if length(v_dni) <> 8 then
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
    select v.nombre, v_mesa, coalesce(not v.ha_votado, false)
    from public.votantes v
    where v.dni = v_dni;
end;
$$;

revoke all on function public.verificar_votante_en_mesa(text, uuid) from public, anon;
grant execute on function public.verificar_votante_en_mesa(text, uuid) to service_role;

notify pgrst, 'reload schema';

-- Verificación manual (en SQL Editor):
--   select dni, ha_votado from public.votantes where dni = '12345678';
-- Después de votar debe ser true. Al volver a digitar el DNI en el kiosco
-- debe aparecer "Ya votó", y un segundo intento debe devolver P0004.
