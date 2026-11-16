-- ============================================================
-- 014. Resultados en vivo
--
-- 1) Habilita Supabase Realtime para la tabla votos: el panel
--    escucha los INSERT y refresca el conteo al instante.
--    Si Realtime no está disponible, la app cae a sondeo cada 20 s.
-- 2) Índices para acelerar los conteos por candidato y por mesa.
--
-- Ejecutar en Supabase Dashboard > SQL Editor.
-- La publicación es idempotente: no falla si ya estaba habilitada.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'votos'
  ) then
    execute 'alter publication supabase_realtime add table public.votos';
  end if;
end;
$$;

create index if not exists votos_candidato_id_idx on public.votos (candidato_id);
create index if not exists votos_mesa_id_idx on public.votos (mesa_id);
