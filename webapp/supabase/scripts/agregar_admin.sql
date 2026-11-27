-- ============================================================
-- AGREGAR UN ADMINISTRADOR POR CORREO
--
-- Este script hace lo mismo que acceso_directo.sql. Se conserva el
-- nombre para no romper enlaces de documentación anteriores.
--
-- NO usa public.usuarios_admin ni concede acceso a todos los
-- usuarios: escribe app_metadata.role = 'admin' solo en el correo
-- indicado. Tras ejecutarlo, cierra sesión y vuelve a entrar.
-- ============================================================

do $$
declare
  correo text := 'admin@admin.com';  -- <- cambia este correo
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

select
  u.email,
  u.raw_app_meta_data ->> 'role' as rol
from auth.users u
where (u.raw_app_meta_data ->> 'role') = 'admin'
order by u.email;
