-- ============================================================
-- MIGRACIÓN 012: BORRAR TODO DE TODO
--
-- Función RPC para borrar votantes, candidatos, votos, mesas
-- y restablecer la configuración en una sola operación.
-- Solo ejecutable por usuarios con rol app_metadata.admin.
--
-- Aplicar después de la migración 011.
-- ============================================================

create or replace function public.borrar_todo()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Acceso denegado: se requiere rol de administrador' using errcode = 'P0008';
  end if;

  -- Orden importa por las claves foráneas
  delete from public.votos;
  delete from public.votantes;
  delete from public.candidatos;
  delete from public.mesas;

  -- Restablecer configuración a valores por defecto
  update public.configuracion
  set
    eleccion_abierta = false,
    titulo = 'Elección de Municipios Escolares',
    centro = 'I.E. Jimenez Pimentel',
    logo_url = null,
    actualizado_en = now()
  where id = 1;
end;
$$;

grant execute on function public.borrar_todo() to authenticated;
revoke execute on function public.borrar_todo() from anon, public;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public' and routine_name = 'borrar_todo';
