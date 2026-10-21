-- ============================================================
-- SISTEMA DE VOTACIÓN - I.E. Jimenez Pimentel
-- Esquema completo + RLS + funciones transaccionales
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONES
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------

-- Mesas / salones donde se vota
create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,                 -- ej: "3ro Primaria A"
  creado_en   timestamptz not null default now()
);

-- Padrón: quién puede votar (un alumno = un voto)
create table if not exists public.votantes (
  dni         text primary key,                     -- DNI normalizado, solo dígitos
  nombre      text not null,
  mesa_id     uuid not null references public.mesas(id) on delete restrict,
  ha_votado   boolean not null default false,
  creado_en   timestamptz not null default now(),
  constraint dni_formato check (dni ~ '^[0-9]{8}$')
);

-- Candidatos de la elección
create table if not exists public.candidatos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  foto_url    text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Votos: DELIBERADAMENTE sin dni ni timestamp exacto.
-- Así no se puede emparejar un voto con un alumno.
create table if not exists public.votos (
  id            bigint generated always as identity primary key,
  candidato_id  uuid not null references public.candidatos(id) on delete restrict,
  mesa_id       uuid not null references public.mesas(id) on delete restrict
);

-- Configuración global de la elección (una sola fila)
create table if not exists public.configuracion (
  id              int primary key default 1 check (id = 1),
  eleccion_abierta boolean not null default false,
  titulo          text not null default 'Elección de Municipios Escolares'
);

insert into public.configuracion (id) values (1)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. RLS ACTIVADO EN TODO (principio: denegar por defecto)
-- ------------------------------------------------------------
alter table public.mesas         enable row level security;
alter table public.votantes      enable row level security;
alter table public.candidatos    enable row level security;
alter table public.votos         enable row level security;
alter table public.configuracion enable row level security;

-- El rol "authenticated" = el admin (tú). Acceso total.
create policy "admin_full_mesas"         on public.mesas         for all to authenticated using (true) with check (true);
create policy "admin_full_votantes"      on public.votantes      for all to authenticated using (true) with check (true);
create policy "admin_full_candidatos"    on public.candidatos    for all to authenticated using (true) with check (true);
create policy "admin_full_votos"         on public.votos         for all to authenticated using (true) with check (true);
create policy "admin_full_configuracion" on public.configuracion for all to authenticated using (true) with check (true);

-- El rol "anon" (kioscos de votación) NO tiene políticas directas:
-- solo puede ejecutar las funciones controladas de abajo.
create policy "anon_lee_candidatos_activos"
  on public.candidatos for select to anon using (activo = true);

-- ------------------------------------------------------------
-- 3. FUNCIONES SEGURAS (la única puerta del kiosco)
-- ------------------------------------------------------------

-- Verifica un DNI sin exponer el padrón completo.
-- Devuelve nombre + mesa si puede votar; null si no.
create or replace function public.verificar_votante(p_dni text)
returns table (nombre text, mesa text, puede_votar boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select v.nombre, m.nombre, not v.ha_votado
    from public.votantes v
    join public.mesas m on m.id = v.mesa_id
    where v.dni = p_dni;
end;
$$;

-- Emite el voto de forma ATÓMICA: marca al votante e inserta el voto
-- en la misma transacción. Si algo falla, no queda nada a medias.
create or replace function public.emitir_voto(p_dni text, p_candidato_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa_id  uuid;
  v_conf     public.configuracion%rowtype;
begin
  -- Cláusula de guarda 1: elección abierta
  select * into v_conf from public.configuracion where id = 1;
  if not v_conf.eleccion_abierta then
    raise exception 'La elección está cerrada';
  end if;

  -- Cláusula de guarda 2: votante existe, pertenece a una mesa y no votó
  update public.votantes
     set ha_votado = true
   where dni = p_dni
     and ha_votado = false
   returning mesa_id into v_mesa_id;

  if v_mesa_id is null then
    raise exception 'DNI inválido o ya votó';
  end if;

  -- Cláusula de guarda 3: candidato activo
  if not exists (select 1 from public.candidatos where id = p_candidato_id and activo = true) then
    raise exception 'Candidato inválido';
  end if;

  insert into public.votos (candidato_id, mesa_id)
  values (p_candidato_id, v_mesa_id);
end;
$$;

-- Resultados en vivo (solo admin vía RLS de la vista base)
create or replace view public.resultados as
  select c.id, c.nombre, c.foto_url, count(v.id) as votos
  from public.candidatos c
  left join public.votos v on v.candidato_id = c.id
  group by c.id, c.nombre, c.foto_url
  order by votos desc;

-- ------------------------------------------------------------
-- 4. PERMISOS MÍNIMOS (principio de menor privilegio)
-- ------------------------------------------------------------
revoke all on public.mesas, public.votantes, public.votos, public.configuracion from anon;
grant  select on public.candidatos to anon;
grant  execute on function public.verificar_votante(text) to anon;
grant  execute on function public.emitir_voto(text, uuid) to anon;
grant  select on public.resultados to authenticated;
