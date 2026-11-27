-- ------------------------------------------------------------
-- 0. EXTENSIONES
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. TABLAS BASE
-- ------------------------------------------------------------

-- Mesas / salones donde se vota
create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  creado_en   timestamptz not null default now()
);

-- Padrón: quién puede votar (un alumno = un voto)
create table if not exists public.votantes (
  dni         text primary key,
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

-- Votos: sin dni ni timestamp exacto (privacidad)
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

-- ------------------------------------------------------------
-- 3. VISTA RESULTADOS (solo admin puede verla)
-- ------------------------------------------------------------
create or replace view public.resultados as
  select c.id, c.nombre, c.foto_url, count(v.id) as votos
  from public.candidatos c
  left join public.votos v on v.candidato_id = c.id
  group by c.id, c.nombre, c.foto_url
  order by votos desc;

-- Impedir que la vista omita RLS en las tablas base.
alter view public.resultados set (security_invoker = true);