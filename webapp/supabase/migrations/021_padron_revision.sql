-- ============================================================
-- MIGRACIÓN 021: REVISIÓN DEL PADRÓN IMPORTADO DESDE EXCEL
--
-- Aplicar DESPUÉS de 018, 019 y 020. Idempotente.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/021_padron_revision.sql
--
-- El Excel acepta TODAS las filas: DNI de cualquier longitud, DNI repetido y
-- datos incompletos. Lo que no cumple las reglas del padrón se guarda aquí,
-- fuera de public.votantes (que sí exige DNI de 8 dígitos y único). El admin
-- o el operador puede editar esas filas y pasarlas al padrón cuando estén
-- correctas. El alta manual sigue siendo estricta.
-- ============================================================

create table if not exists public.padron_revision (
  id         uuid primary key default gen_random_uuid(),
  dni        text not null,
  nombre     text not null,
  grado      text,
  seccion    text,
  motivos    jsonb not null default '[]'::jsonb,
  origen     text not null default 'excel',
  creado_en  timestamptz not null default now()
);

alter table public.padron_revision enable row level security;

drop policy if exists admin_padron_revision_select on public.padron_revision;
create policy admin_padron_revision_select on public.padron_revision
  for select to authenticated using (public.es_admin_uuid());
drop policy if exists admin_padron_revision_insert on public.padron_revision;
create policy admin_padron_revision_insert on public.padron_revision
  for insert to authenticated with check (public.es_admin_uuid());
drop policy if exists admin_padron_revision_update on public.padron_revision;
create policy admin_padron_revision_update on public.padron_revision
  for update to authenticated
  using (public.es_admin_uuid()) with check (public.es_admin_uuid());
drop policy if exists admin_padron_revision_delete on public.padron_revision;
create policy admin_padron_revision_delete on public.padron_revision
  for delete to authenticated using (public.es_admin_uuid());

drop policy if exists operador_padron_revision_select on public.padron_revision;
create policy operador_padron_revision_select on public.padron_revision
  for select to authenticated using (public.es_operador());
drop policy if exists operador_padron_revision_insert on public.padron_revision;
create policy operador_padron_revision_insert on public.padron_revision
  for insert to authenticated with check (public.es_operador());
drop policy if exists operador_padron_revision_update on public.padron_revision;
create policy operador_padron_revision_update on public.padron_revision
  for update to authenticated
  using (public.es_operador()) with check (public.es_operador());
drop policy if exists operador_padron_revision_delete on public.padron_revision;
create policy operador_padron_revision_delete on public.padron_revision
  for delete to authenticated using (public.es_operador());

-- Auditoría de la revisión -------------------------------------------------
create or replace function public.auditar_padron_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_movimiento(
      'importar_revision', 'votante', new.dni,
      jsonb_build_object('nombre', new.nombre, 'motivos', new.motivos)
    );
  elsif tg_op = 'UPDATE' then
    perform public.registrar_movimiento(
      'editar_revision', 'votante', new.dni,
      jsonb_build_object('nombre', new.nombre, 'grado', new.grado, 'seccion', new.seccion)
    );
  elsif tg_op = 'DELETE' then
    perform public.registrar_movimiento(
      'descartar_revision', 'votante', old.dni,
      jsonb_build_object('nombre', old.nombre)
    );
  end if;
  return null;
end;
$$;

revoke all on function public.auditar_padron_revision() from public, anon, authenticated;

drop trigger if exists padron_revision_auditoria on public.padron_revision;
create trigger padron_revision_auditoria
after insert or update or delete on public.padron_revision
for each row execute function public.auditar_padron_revision();

-- Pasar una fila revisada al padrón real ----------------------------------
create or replace function public.promover_votante_revision(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_fila public.padron_revision%rowtype;
  v_dni text;
  v_nombre text;
  v_grado text;
  v_seccion text;
  v_tiene_columnas boolean;
begin
  if not (public.es_admin_uuid() or public.es_operador()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_fila from public.padron_revision where id = p_id for update;
  if not found then
    raise exception 'La fila de revisión ya no existe' using errcode = 'P0004';
  end if;

  v_dni := regexp_replace(coalesce(v_fila.dni, ''), '\D', '', 'g');
  if length(v_dni) <> 8 then
    raise exception 'El DNI debe tener 8 dígitos para pasar al padrón' using errcode = 'P0005';
  end if;

  v_nombre := regexp_replace(trim(coalesce(v_fila.nombre, '')), '\s+', ' ', 'g');
  if array_length(string_to_array(v_nombre, ' '), 1) < 3 then
    raise exception 'Completa el nombre y ambos apellidos antes de pasar al padrón' using errcode = 'P0006';
  end if;

  v_grado := nullif(trim(coalesce(v_fila.grado, '')), '');
  v_seccion := nullif(trim(coalesce(v_fila.seccion, '')), '');
  if v_grado is null or v_seccion is null then
    raise exception 'Completa el grado y la sección antes de pasar al padrón' using errcode = 'P0007';
  end if;

  if exists (select 1 from public.votantes where dni = v_dni) then
    raise exception 'El DNI % ya está registrado en el padrón', v_dni using errcode = '23505';
  end if;

  select count(*) = 2 into v_tiene_columnas
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'votantes'
    and column_name in ('grado', 'seccion');

  if v_tiene_columnas then
    insert into public.votantes (dni, nombre, grado, seccion)
    values (v_dni, v_nombre, v_grado, v_seccion);
  else
    insert into public.votantes (dni, nombre)
    values (v_dni, v_nombre);
  end if;

  delete from public.padron_revision where id = p_id;
end;
$$;

revoke all on function public.promover_votante_revision(uuid) from public, anon;
grant execute on function public.promover_votante_revision(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

-- Verificación: las filas con DNI largo, DNI repetido o datos incompletos
-- deben aparecer aquí y NO en public.votantes hasta que se promuevan.
