-- ============================================================
-- MIGRACIÓN 023: RESULTADOS CONSISTENTES
--
-- Aplicar DESPUÉS de 022. Idempotente: se puede ejecutar varias veces.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/023_resultados_consistencia.sql
--
-- PROBLEMA
--  "Votos emitidos" se contaba desde public.votos, pero "Votaron" se
--  contaba desde votantes.ha_votado. Mientras el trigger de la migración
--  020 estuvo mal, ha_votado quedó en false aunque el voto sí se guardó.
--  Resultado: votos emitidos = 4, votaron = 0.
--
-- SOLUCIÓN
--  Usar public.votos como única fuente de verdad para los agregados del
--  panel (una papeleta = un elector que votó). Las RPCs de estadísticas
--  devuelven el mismo número en total_votaron y en el conteo por candidato.
--  La corrección de ha_votado para votos FUTUROS está en la migración 022.
-- ============================================================

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
declare
  v_votos bigint;
  v_total bigint;
begin
  if not public.puede_padron() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador'
      using errcode = 'P0008';
  end if;

  -- Un voto registrado equivale a un elector que ya emitió su voto.
  select count(*) into v_votos from public.votos;
  select count(*) into v_total from public.votantes;

  return query
    with por_mesa_agg as (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as por_mesa
      from (
        select
          m.id as mesa_id,
          m.nombre as mesa_nombre,
          count(v.id) as total,
          count(v.id) as votaron,
          0::bigint as pendientes,
          case
            when v_votos > 0
            then round((count(v.id)::numeric / v_votos) * 100, 2)
            else 0
          end as participacion_pct
        from public.mesas m
        left join public.votos v on v.mesa_id = m.id
        where m.activo = true
        group by m.id, m.nombre
        order by m.nombre
      ) t
    )
    select
      v_total,
      v_votos,
      greatest(v_total - v_votos, 0),
      case when v_total > 0 then round((v_votos::numeric / v_total) * 100, 2) else 0 end,
      p.por_mesa
    from por_mesa_agg p;
end;
$$;

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
begin
  if not public.puede_ver_mesas() then
    raise exception 'Acceso denegado: se requiere rol de administrador u operador'
      using errcode = 'P0008';
  end if;

  select count(*) into v_total from public.votantes;

  return query
    select
      m.id,
      m.nombre,
      m.activo,
      v_total,
      count(v.id),
      greatest(v_total - count(v.id), 0),
      case when v_total > 0 then round((count(v.id)::numeric / v_total) * 100, 2) else 0 end,
      count(v.id)
    from public.mesas m
    left join public.votos v on v.mesa_id = m.id
    group by m.id, m.nombre, m.activo
    order by m.nombre;
end;
$$;

revoke execute on function public.obtener_estadisticas_padron() from public, anon;
grant execute on function public.obtener_estadisticas_padron() to authenticated, service_role;
revoke execute on function public.obtener_resumen_mesas() from public, anon;
grant execute on function public.obtener_resumen_mesas() to authenticated, service_role;

notify pgrst, 'reload schema';

-- Verificación en SQL Editor (deben coincidir total_votaron y votos):
--   select total_votantes, total_votaron, total_pendientes, participacion_pct
--   from public.obtener_estadisticas_padron();
--   select count(*) as votos from public.votos;
