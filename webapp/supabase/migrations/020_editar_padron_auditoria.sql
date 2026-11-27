-- ============================================================
-- MIGRACIÓN 020: EDICIÓN DEL PADRÓN CON AUDITORÍA
--
-- Aplicar DESPUÉS de 018 y 019. Idempotente: se puede ejecutar varias veces.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/020_editar_padron_auditoria.sql
--
-- Permite que admin y operador editen votantes desde "Ver padrón", registra
-- cada edición en auditoria_operador y bloquea los cambios que podrían
-- alterar el derecho a voto (ha_votado, creado_en o el DNI de quien ya votó).
-- ============================================================

-- 1. Políticas de UPDATE ---------------------------------------------------
drop policy if exists admin_uuid_votantes_update on public.votantes;
create policy admin_uuid_votantes_update on public.votantes
  for update to authenticated
  using (public.es_admin_uuid())
  with check (public.es_admin_uuid());

drop policy if exists operador_votantes_update on public.votantes;
create policy operador_votantes_update on public.votantes
  for update to authenticated
  using (public.es_operador())
  with check (public.es_operador());

-- 2. Integridad: nadie puede marcar/desmarcar un voto ni cambiar el DNI
--    de un votante que ya emitió su voto desde el panel. -------------------
create or replace function public.proteger_votantes_edicion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.ha_votado and new.dni is distinct from old.dni then
    raise exception 'No se puede cambiar el DNI de un votante que ya votó'
      using errcode = 'P0003';
  end if;

  new.ha_votado := old.ha_votado;
  new.creado_en := old.creado_en;
  return new;
end;
$$;

revoke all on function public.proteger_votantes_edicion() from public, anon, authenticated;

drop trigger if exists votantes_proteger_edicion on public.votantes;
create trigger votantes_proteger_edicion
before update on public.votantes
for each row execute function public.proteger_votantes_edicion();

-- 3. Auditoría: ahora también se registran las ediciones ------------------
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
  elsif tg_op = 'UPDATE' then
    perform public.registrar_movimiento(
      'editar', 'votante', new.dni,
      jsonb_build_object(
        'dni_anterior', old.dni,
        'nombre_anterior', old.nombre,
        'nombre', new.nombre,
        'grado', new.grado,
        'seccion', new.seccion
      )
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
after insert or update or delete on public.votantes
for each row execute function public.auditar_votantes();

notify pgrst, 'reload schema';

-- Verificación: al editar un votante debe aparecer una fila con
-- accion = 'editar' y entidad = 'votante' en public.auditoria_operador.
