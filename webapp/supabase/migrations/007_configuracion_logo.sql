-- ============================================================
-- MIGRACIÓN 007: IMAGEN DE LA INSTITUCIÓN EDUCATIVA
--
-- Agrega la imagen/logo de la I.E a la configuración para
-- mostrarla en la pantalla de votación.
--
-- Aplicar después de las migraciones 001–006.
-- ============================================================

alter table public.configuracion
  add column if not exists logo_url text;

-- Verificación
select
  id,
  titulo,
  centro,
  logo_url is not null as tiene_logo
from public.configuracion
where id = 1;
