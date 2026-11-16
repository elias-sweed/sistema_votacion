-- ============================================================
-- ACCESO AL PANEL: OTORGAR ROL ADMIN A UN CORREO
--
-- Cambia `correo` por el correo del administrador y ejecuta este
-- script en Supabase -> SQL Editor.
--
-- Escribe app_metadata.role = 'admin', que es un claim firmado por
-- Supabase Auth. No abre el panel a cualquier usuario autenticado.
--
-- Después de ejecutarlo, el usuario debe cerrar sesión y volver a
-- entrar (o refrescar la sesión) para que el JWT incluya el rol.
-- ============================================================

do $$
declare
  correo text := 'votacion@jimenezpimentel.edu.pe';
  afectados integer;
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'admin')
  where lower(email) = lower(correo);

  get diagnostics afectados = row_count;

  if afectados = 0 then
    raise exception 'No existe un usuario con el correo %', correo;
  end if;
end $$;

-- ------------------------------------------------------------
-- VERIFICACIÓN
-- ------------------------------------------------------------
select
  u.email,
  u.raw_app_meta_data ->> 'role' as rol
from auth.users u
where (u.raw_app_meta_data ->> 'role') = 'admin'
order by u.email;
