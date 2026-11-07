-- ============================================================
-- AGREGAR UN USUARIO COMO SUPER ADMIN
-- Cambia el correo y ejecútalo en Supabase -> SQL Editor.
-- (El usuario debe existir antes en Authentication -> Users)
-- ============================================================

insert into public.usuarios_admin (user_id, email, rol, activo)
select u.id, u.email, 'super_admin', true
from auth.users u
where lower(u.email) = lower('admin@admin.com')
on conflict (user_id) do update
  set email  = excluded.email,
      rol    = 'super_admin',
      activo = true;

select email, rol, activo
from public.usuarios_admin;
