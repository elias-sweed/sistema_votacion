-- ============================================================
-- MIGRACIÓN 019: VOTO EN BLANCO PREDETERMINADO
--
-- Aplicar DESPUÉS de 018. Idempotente: se puede ejecutar varias veces.
-- CÓMO APLICARLO: pegar en Supabase -> SQL Editor -> Run, o con
--   node supabase/scripts/aplicar_sql.mjs supabase/migrations/019_voto_en_blanco.sql
--
-- El voto en blanco es un candidato reservado con ID fijo. El kiosco lo muestra
-- como una opción más (con la imagen local boto_blanco.png), la vista
-- public.resultados lo contabiliza y el acta lo lista como "Voto en blanco".
-- El panel de candidatos lo oculta para que no se pueda editar ni borrar.
-- Si se usa "Borrar todo" (que vacía la tabla candidatos), vuelve a ejecutar
-- esta migración para restaurar la opción.
-- ============================================================

insert into public.candidatos (id, nombre, foto_url, activo)
values (
  'b1a0c4d2-6f1e-4c8a-9d3f-7e2a5c8b1f04'::uuid,
  'Voto en blanco',
  null,
  true
)
on conflict (id) do update
  set nombre = excluded.nombre,
      activo = true;

notify pgrst, 'reload schema';

-- Verificación: debe devolver una fila con nombre 'Voto en blanco' y activo = true.
select id, nombre, activo
from public.candidatos
where id = 'b1a0c4d2-6f1e-4c8a-9d3f-7e2a5c8b1f04'::uuid;
