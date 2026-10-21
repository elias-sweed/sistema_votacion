-- ============================================================
-- MIGRACIÓN 001: ENDURECIMIENTO DE SEGURIDAD - FASE 1
-- ============================================================
-- Objetivo: Corregir vulnerabilidades críticas identificadas en auditoría
-- 1. Separar admin real de 'authenticated' genérico usando JWT claim
-- 2. Atomicidad estricta en emitir_voto (cierre de elección dentro de transacción)
-- 3. Hardening de funciones SECURITY DEFINER (search_path, nombres calificados)
-- 4. Rate limiting básico para funciones expuestas a anon
-- 5. Revocación explícita de permisos PUBLIC innecesarios
-- ============================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONES NECESARIAS
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. FUNCIÓN AUXILIAR: VERIFICAR SI USUARIO ES ADMIN
-- ------------------------------------------------------------
-- Se usa en políticas RLS y funciones RPC para autorización
-- Lee el claim 'role' desde app_metadata del JWT de Supabase Auth
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ------------------------------------------------------------
-- 2. REVOCAR POLÍTICAS EXISTENTES INSEGURAS
-- ------------------------------------------------------------
-- Eliminar políticas que dan acceso total a 'authenticated'
drop policy if exists "admin_full_mesas" on public.mesas;
drop policy if exists "admin_full_votantes" on public.votantes;
drop policy if exists "admin_full_candidatos" on public.candidatos;
drop policy if exists "admin_full_votos" on public.votos;
drop policy if exists "admin_full_configuracion" on public.configuracion;

-- ------------------------------------------------------------
-- 3. POLÍTICAS RLS SEGURAS: authenticated + is_app_admin()
-- ------------------------------------------------------------
-- NOTA: Supabase Auth usuarios son 'authenticated'. No hay rol PG 'app_admin' automático.
-- Las políticas usan 'to authenticated' con using() que verifica el claim JWT.

-- MESAS: solo admin (claim role=admin) puede gestionar; anon no accede
create policy "admin_full_mesas" on public.mesas
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- VOTANTES: solo admin puede gestionar padrón; anon no accede directo
create policy "admin_full_votantes" on public.votantes
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- CANDIDATOS: admin CRUD completo; anon solo lectura de activos
create policy "admin_full_candidatos" on public.candidatos
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Política anon existente se mantiene (ya está correcta)
-- create policy "anon_lee_candidatos_activos" on public.candidatos for select to anon using (activo = true);

-- VOTOS: solo admin puede leer resultados; anon NO accede directo
create policy "admin_read_votos" on public.votos
  for select to authenticated
  using (public.is_app_admin());
-- NO hay policy para insert/update/delete en votos para nadie excepto vía RPC

-- CONFIGURACIÓN: solo admin puede abrir/cerrar elección
create policy "admin_full_configuracion" on public.configuracion
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ------------------------------------------------------------
-- 4. ENDURECER FUNCIÓN verificar_votante
-- ------------------------------------------------------------
-- Cambios: search_path seguro, nombres completamente calificados,
-- revocar execute de PUBLIC, validación de entrada
drop function if exists public.verificar_votante(text);

create or replace function public.verificar_votante(p_dni text)
returns table (nombre text, mesa text, puede_votar boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dni text;
begin
  -- Validación de entrada: solo dígitos, longitud 8
  v_dni := regexp_replace(p_dni, '\D', '', 'g');
  if v_dni is null or length(v_dni) <> 8 or v_dni ~ '\D' then
    return query select null::text, null::text, false;
    return;
  end if;

  return query
    select v.nombre, m.nombre, not v.ha_votado
    from public.votantes v
    join public.mesas m on m.id = v.mesa_id
    where v.dni = v_dni;
end;
$$;

-- ------------------------------------------------------------
-- 5. ENDURECER FUNCIÓN emitir_voto - ATOMICIDAD ESTRICTA
-- ------------------------------------------------------------
-- Cambios críticos:
-- 1. Check de elección abierta DENTRO de la transacción con FOR SHARE
-- 2. Row lock en votante con FOR UPDATE para serializar concurrencia
-- 3. Validación de candidato con FOR SHARE
-- 4. search_path seguro, nombres calificados
-- 5. Manejo de errores explícito con códigos SQLSTATE personalizados
drop function if exists public.emitir_voto(text, uuid);

create or replace function public.emitir_voto(p_dni text, p_candidato_id uuid)
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
  -- Normalizar y validar DNI
  v_dni := regexp_replace(p_dni, '\D', '', 'g');
  if v_dni is null or length(v_dni) <> 8 or v_dni ~ '\D' then
    raise exception 'DNI inválido' using errcode = 'P0001';
  end if;

  -- Validar UUID de candidato
  if p_candidato_id is null then
    raise exception 'Candidato requerido' using errcode = 'P0002';
  end if;

  -- TRANSACCIÓN ATÓMICA: todo en un bloque implícito
  -- 1. Bloquear fila de configuración para verificar estado (FOR SHARE)
  select * into v_conf
  from public.configuracion
  where id = 1
  for share;  -- Permite lecturas concurrentes, bloquea writes

  if not v_conf.eleccion_abierta then
    raise exception 'La elección está cerrada' using errcode = 'P0003';
  end if;

  -- 2. Intentar marcar votante como ha_votado = true (FOR UPDATE serializa por DNI)
  update public.votantes
     set ha_votado = true
   where dni = v_dni
     and ha_votado = false
   returning mesa_id into v_mesa_id;

  if v_mesa_id is null then
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  end if;

  -- 3. Verificar candidato activo (FOR SHARE para evitar delete concurrente)
  select exists (
    select 1 from public.candidatos
    where id = p_candidato_id and activo = true
    for share
  ) into v_candidato_exists;

  if not v_candidato_exists then
    raise exception 'Candidato inválido o inactivo' using errcode = 'P0005';
  end if;

  -- 4. Insertar voto (sin DNI, sin timestamp exacto - privacidad)
  insert into public.votos (candidato_id, mesa_id)
  values (p_candidato_id, v_mesa_id);

exception
  when sqlstate 'P0001' then raise;  -- DNI inválido
  when sqlstate 'P0002' then raise;  -- Candidato requerido
  when sqlstate 'P0003' then raise;  -- Elección cerrada
  when sqlstate 'P0004' then raise;  -- DNI inválido o ya votó
  when sqlstate 'P0005' then raise;  -- Candidato inválido
  when unique_violation then
    -- Por si acaso: violación de unicidad (índice único en votantes.dni + ha_votado)
    raise exception 'DNI inválido o ya votó' using errcode = 'P0004';
  when foreign_key_violation then
    raise exception 'Candidato o mesa inválida' using errcode = 'P0006';
  when others then
    -- Log genérico sin exponer detalles internos
    raise exception 'Error al procesar el voto' using errcode = 'P0000';
end;
$$;

-- ------------------------------------------------------------
-- 6. TABLA DE RATE LIMITING PARA FUNCIONES ANON
-- ------------------------------------------------------------
-- Registra intentos por IP (extraída de headers en Edge Function) y DNI hash
create table if not exists public.rate_limit_intentos (
  id bigint generated always as identity primary key,
  client_ip inet not null,
  dni_hash text not null,  -- hash del DNI, no el DNI real
  funcion text not null,   -- 'verificar_votante' | 'emitir_voto'
  creado_en timestamptz not null default now()
);

create index if not exists idx_rate_limit_ip_func_time
  on public.rate_limit_intentos (client_ip, funcion, creado_en desc);

create index if not exists idx_rate_limit_dni_func_time
  on public.rate_limit_intentos (dni_hash, funcion, creado_en desc);

-- RLS: solo admin puede leer; anon NO tiene acceso directo
alter table public.rate_limit_intentos enable row level security;
create policy "admin_read_rate_limit" on public.rate_limit_intentos
  for select to authenticated
  using (public.is_app_admin());

-- Función para registrar intento (llamada desde Edge Function o wrapper)
create or replace function public.registrar_intento_rate_limit(
  p_client_ip inet,
  p_dni_hash text,
  p_funcion text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.rate_limit_intentos (client_ip, dni_hash, funcion)
  values (p_client_ip, p_dni_hash, p_funcion);
end;
$$;

-- Función para verificar límite (ventana: 10 req/min por IP, 5 req/min por DNI)
create or replace function public.verificar_rate_limit(
  p_client_ip inet,
  p_dni_hash text,
  p_funcion text,
  p_max_por_ip int default 10,
  p_max_por_dni int default 5,
  p_ventana_minutos int default 1
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count_ip int;
  v_count_dni int;
  v_cutoff timestamptz;
begin
  v_cutoff := now() - (p_ventana_minutos || ' minutes')::interval;

  select count(*) into v_count_ip
  from public.rate_limit_intentos
  where client_ip = p_client_ip
    and funcion = p_funcion
    and creado_en > v_cutoff;

  if v_count_ip >= p_max_por_ip then
    return false;
  end if;

  select count(*) into v_count_dni
  from public.rate_limit_intentos
  where dni_hash = p_dni_hash
    and funcion = p_funcion
    and creado_en > v_cutoff;

  if v_count_dni >= p_max_por_dni then
    return false;
  end if;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- 7. WRAPPERS CON RATE LIMITING (para uso vía Edge Function)
-- ------------------------------------------------------------
-- Estas funciones incluyen rate limiting interno.
-- El cliente DEBE llamar a estas versiones desde Edge Function
-- que tenga acceso a la IP real del cliente.

create or replace function public.verificar_votante_con_limite(
  p_dni text,
  p_client_ip inet,
  p_dni_hash text
) returns table (nombre text, mesa text, puede_votar boolean, rate_limited boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Verificar rate limit
  if not public.verificar_rate_limit(p_client_ip, p_dni_hash, 'verificar_votante') then
    return query select null::text, null::text, false, true;
    return;
  end if;

  -- Registrar intento
  perform public.registrar_intento_rate_limit(p_client_ip, p_dni_hash, 'verificar_votante');

  -- Ejecutar verificación original (ya devuelve mesa como texto)
  return query
    select v.nombre, v.mesa, v.puede_votar, false
    from public.verificar_votante(p_dni) v;
end;
$$;

create or replace function public.emitir_voto_con_limite(
  p_dni text,
  p_candidato_id uuid,
  p_client_ip inet,
  p_dni_hash text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Verificar rate limit (más estricto para emitir voto)
  if not public.verificar_rate_limit(p_client_ip, p_dni_hash, 'emitir_voto', 5, 3, 1) then
    raise exception 'Demasiados intentos. Espere un momento.' using errcode = 'P0007';
  end if;

  -- Registrar intento
  perform public.registrar_intento_rate_limit(p_client_ip, p_dni_hash, 'emitir_voto');

  -- Ejecutar voto original
  perform public.emitir_voto(p_dni, p_candidato_id);
end;
$$;

-- ------------------------------------------------------------
-- 8. PERMISOS EXPLÍCITOS (PRINCIPIO MENOR PRIVILEGIO)
-- ------------------------------------------------------------
-- Revocar todo de PUBLIC y anon en objetos sensibles
revoke all on public.mesas, public.votantes, public.votos, public.configuracion, public.rate_limit_intentos from anon, public;
revoke execute on function public.verificar_votante(text) from public;
revoke execute on function public.emitir_voto(text, uuid) from public;
revoke execute on function public.verificar_rate_limit(inet, text, text, int, int, int) from public;
revoke execute on function public.registrar_intento_rate_limit(inet, text, text) from public;
revoke execute on function public.verificar_votante_con_limite(text, inet, text) from public;
revoke execute on function public.emitir_voto_con_limite(text, uuid, inet, text) from public;

-- Conceder solo lo necesario a anon (funciones base SIN rate limit - para compatibilidad)
-- NOTA: En producción, el frontend debe llamar a versiones con límite vía Edge Function
grant execute on function public.verificar_votante(text) to anon;
grant execute on function public.emitir_voto(text, uuid) to anon;

-- Conceder a authenticated (admin verifica con is_app_admin() en políticas)
grant all on public.mesas, public.votantes, public.candidatos, public.votos, public.configuracion, public.rate_limit_intentos to authenticated;
grant execute on all functions in schema public to authenticated;

-- ------------------------------------------------------------
-- 9. VISTA RESULTADOS - SOLO ADMIN
-- ------------------------------------------------------------
revoke all on public.resultados from anon, public;
grant select on public.resultados to authenticated;

-- ============================================================
-- FIN DE MIGRACIÓN 001
-- ============================================================
-- PRÓXIMOS PASOS MANUALES REQUERIDOS:
-- 1. En Supabase Dashboard > Authentication > Providers > Email:
--    - Configurar "Confirm email" según necesidad
-- 2. Crear usuario admin en Authentication > Users:
--    - Email: admin@colegio.edu.pe (ejemplo)
--    - Password: [segura]
--    - En "App Metadata" (NO User Metadata): {"role": "admin"}
-- 3. Para rate limiting real: Deploy Edge Function (ver webapp/supabase/functions/voting-proxy/)
--    que extraiga IP real y llame a verificar_votante_con_limite / emitir_voto_con_limite
-- 4. Verificar que el frontend use la Edge Function, no las funciones RPC directas
-- ============================================================