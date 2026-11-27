-- ============================================================
-- SCRIPT OBSOLETO
--
-- La versión anterior creaba public.usuarios_admin y registraba a
-- TODOS los usuarios existentes como super_admin. Eso equivale a
-- abrir el panel a cualquier persona con cuenta y ya no se usa.
--
-- El modelo vigente es app_metadata.role = 'admin' (JWT firmado),
-- definido en supabase/migrations/005_admin_role_hardening.sql.
--
-- Para habilitar un administrador concreto usa:
--   supabase/scripts/acceso_directo.sql
-- ============================================================

select
  'Script obsoleto: usa supabase/scripts/acceso_directo.sql para otorgar el rol admin a un correo concreto.'
  as aviso;
