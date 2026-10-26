-- Ejecutar contra la base de pruebas despues de aplicar schema.sql y 001-004.
-- Verifica privilegios PostgreSQL que no son observables desde PostgREST.
do $$
begin
  if has_function_privilege('anon', 'public.is_app_admin()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_app_admin()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.is_app_admin()', 'EXECUTE') then
    raise exception 'Permisos incorrectos en is_app_admin';
  end if;

  if has_function_privilege('anon', 'public.obtener_estadisticas_padron()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.obtener_estadisticas_padron()', 'EXECUTE')
     or has_function_privilege('anon', 'public.listar_votantes(uuid, text, boolean, integer, integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.listar_votantes(uuid, text, boolean, integer, integer)', 'EXECUTE') then
    raise exception 'Permisos incorrectos en las RPC administrativas del padron';
  end if;

  if has_function_privilege('anon', 'public.verificar_votante(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verificar_votante(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.verificar_votante(text)', 'EXECUTE') then
    raise exception 'La funcion base verificar_votante no debe ser invocable por clientes ni service_role';
  end if;

  if has_function_privilege('anon', 'public.emitir_voto(text, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.emitir_voto(text, uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.emitir_voto(text, uuid)', 'EXECUTE') then
    raise exception 'La funcion base emitir_voto no debe ser invocable directamente';
  end if;

  if has_function_privilege('anon', 'public.verificar_votante_con_limite(text, inet, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verificar_votante_con_limite(text, inet, text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.verificar_votante_con_limite(text, inet, text)', 'EXECUTE') then
    raise exception 'Permisos incorrectos en verificar_votante_con_limite';
  end if;

  if has_function_privilege('anon', 'public.emitir_voto_con_limite(text, uuid, inet, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.emitir_voto_con_limite(text, uuid, inet, text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.emitir_voto_con_limite(text, uuid, inet, text)', 'EXECUTE') then
    raise exception 'Permisos incorrectos en emitir_voto_con_limite';
  end if;

  if has_function_privilege('anon', 'public.verificar_rate_limit(inet, text, text, integer, integer, integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verificar_rate_limit(inet, text, text, integer, integer, integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.verificar_rate_limit(inet, text, text, integer, integer, integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.registrar_intento_rate_limit(inet, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.registrar_intento_rate_limit(inet, text, text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.registrar_intento_rate_limit(inet, text, text)', 'EXECUTE') then
    raise exception 'Las funciones auxiliares de rate limit no deben invocarse directamente';
  end if;

  if has_table_privilege('authenticated', 'public.votantes', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.votos', 'TRUNCATE')
     or has_table_privilege('anon', 'public.votantes', 'SELECT')
     or has_table_privilege('anon', 'public.resultados', 'SELECT') then
    raise exception 'Permisos indebidos en tablas sensibles o vista resultados';
  end if;

  if not has_table_privilege('anon', 'public.candidatos', 'SELECT') then
    raise exception 'anon debe conservar SELECT en candidatos activos (filtrado por RLS)';
  end if;

  if not has_table_privilege('authenticated', 'public.resultados', 'SELECT')
     or not has_table_privilege('authenticated', 'public.votantes', 'SELECT') then
    raise exception 'Faltan privilegios de consulta necesarios para usuarios autenticados (RLS los filtra)';
  end if;

  if has_table_privilege('authenticated', 'public.votos', 'INSERT')
     or has_table_privilege('authenticated', 'public.votos', 'UPDATE')
     or has_table_privilege('authenticated', 'public.votos', 'DELETE') then
    raise exception 'authenticated no debe modificar votos directamente';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.resultados'::regclass
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'La vista resultados no aplica privilegios del invocador';
  end if;

  if exists (
    select 1
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relname = any(array[
        'mesas',
        'votantes',
        'candidatos',
        'votos',
        'configuracion',
        'rate_limit_intentos'
      ])
      and not c.relrowsecurity
  ) then
    raise exception 'RLS debe permanecer activado en todas las tablas sensibles';
  end if;
end;
$$;
