-- MIGRACION 004: CORRECCIONES DE SEGURIDAD Y PERMISOS
-- Aplicar despues de schema.sql y de las migraciones 001, 002 y 003.

-- La identidad se obtiene de claims firmados de Supabase Auth. No se usa
-- current_user porque SECURITY DEFINER cambia ese valor al propietario.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'service_role',
    false
  );
$$;

-- SECURITY INVOKER hace que resultados aplique los permisos y RLS del
-- solicitante sobre candidatos y votos.
alter view public.resultados set (security_invoker = true);

-- Quitar el acceso EXECUTE heredado o concedido en bloque por migraciones
-- anteriores. Las concesiones necesarias se vuelven a dar explícitamente.
revoke execute on all functions in schema public from public, anon, authenticated, service_role;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- Solo las RPC administrativas del padron estan expuestas a authenticated;
-- todas verifican is_app_admin() dentro de la funcion SECURITY DEFINER.
grant execute on function public.obtener_estadisticas_padron() to authenticated;
grant execute on function public.listar_votantes(uuid, text, boolean, integer, integer) to authenticated;
grant execute on function public.importar_votantes(jsonb) to authenticated;
grant execute on function public.validar_importacion_votantes(jsonb) to authenticated;

-- El backend de voting-proxy usa service_role. Las funciones base que omiten
-- rate limiting quedan sin EXECUTE para clientes, incluidos administradores.
grant execute on function public.verificar_votante_con_limite(text, inet, text) to service_role;
grant execute on function public.emitir_voto_con_limite(text, uuid, inet, text) to service_role;
revoke execute on function public.verificar_votante(text) from public, anon, authenticated, service_role;
revoke execute on function public.emitir_voto(text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.verificar_rate_limit(inet, text, text, integer, integer, integer) from public, anon, authenticated, service_role;
revoke execute on function public.registrar_intento_rate_limit(inet, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.verificar_votante_con_limite(text, inet, text) from public, anon, authenticated;
revoke execute on function public.emitir_voto_con_limite(text, uuid, inet, text) from public, anon, authenticated;

-- RLS no protege TRUNCATE. Evitar el GRANT ALL anterior y conservar solo
-- DML sujeto a las politicas RLS existentes.
revoke all on public.mesas, public.votantes, public.candidatos,
  public.votos, public.configuracion, public.rate_limit_intentos
  from public, anon, authenticated;
grant select, insert, update, delete on public.mesas, public.votantes,
  public.candidatos, public.configuracion to authenticated;
grant select on public.votos, public.rate_limit_intentos to authenticated;
grant select on public.candidatos to anon;

-- Resultados solo se pueden consultar por roles autorizados; para authenticated
-- las filas base siguen filtradas por RLS. service_role es el backend confiable.
revoke all on public.resultados from public, anon, authenticated, service_role;
grant select on public.resultados to authenticated, service_role;
