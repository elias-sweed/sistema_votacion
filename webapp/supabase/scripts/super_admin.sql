-- ============================================================
-- SUPER ADMIN POR TABLA (sin app_metadata)
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
--
-- Después, cualquier usuario que exista en Authentication y
-- esté en public.usuarios_admin puede modificar todas las
-- tablas aunque tengan RLS activado.
-- ============================================================

-- 1) Tabla de administradores
create table if not exists public.usuarios_admin (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null unique references auth.users(id) on delete cascade,
  email     text,
  rol       text not null default 'super_admin',
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.usuarios_admin enable row level security;

drop policy if exists "usuarios_admin_self_read" on public.usuarios_admin;
create policy "usuarios_admin_self_read" on public.usuarios_admin
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.usuarios_admin to authenticated;

-- 2) is_app_admin() ahora consulta la tabla
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.usuarios_admin ua
    where ua.user_id = auth.uid()
      and ua.activo = true
      and ua.rol in ('super_admin', 'admin')
  );
$$;

grant execute on function public.is_app_admin() to authenticated, service_role;

-- 3) Registrar como super_admin a TODOS los usuarios ya creados
insert into public.usuarios_admin (user_id, email, rol, activo)
select u.id, u.email, 'super_admin', true
from auth.users u
on conflict (user_id) do update
  set email  = excluded.email,
      rol    = 'super_admin',
      activo = true;

-- 4) Comprobación
select email, rol, activo, user_id
from public.usuarios_admin
order by creado_en;
