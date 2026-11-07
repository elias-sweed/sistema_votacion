# FASE 04.1-A — Reparación de migración base de Supabase local

**Fecha:** 2026-10-28  
**Objetivo:** Reparar la migración base para que `supabase db reset` complete correctamente aplicando `000` → `001` → `002` → `003` → `004` en orden, sin tocar producción ni hacer commit/push.

## 1. Problema identificado

`supabase db reset` fallaba al aplicar `001_security_hardening.sql` con el error:
```
ERROR: relation "public.mesas" does not exist
```

**Causa raíz:** El archivo `supabase/migrations/000_base_schema.sql` solo contenía las primeras 70 líneas de `schema.sql` (tablas `mesas` y `votantes incompleto), faltaban las tablas `candidatos`, `votos` y `configuracion` que `001` espera que existan previamente.

## 2. Análisis de archivos

### 2.1 `supabase/migrations/000_base_schema.sql` (antes)
- **Tamaño:** 383 bytes
- **Contenido:** Solo las primeras 70 líneas de `schema.sql` con problemas de formato (columnas duplicadas en `mesas`, paréntesis sin cerrar, código truncado)
- **Estado:** Incompleto, no hacía `supabase db reset` funcionar

### 2.2 `supabase/migrations/20261028161952_20261028000000_base_schema.sql`
- **Tamaño:** 0 bytes (vacío)
- **Estado:** Migración huérfana, sin propósito definido

### 2.3 `supabase/schema.sql` (referencia, sin modificar)
- **Tamaño:** 7731 bytes
- **Contenido:** Esquema completo con extensiones, tablas, RLS, funciones, vistas, políticas
- **Decisión:** Conservado como referencia; no sobrescrito

### 2.4 `supabase/migrations/001_security_hardening.sql`
- **Rol:** Crea `is_app_admin()` con `auth.jwt()`, reescribe políticas RLS, endurece `verificar_votante` y `emitir_voto`, crea rate limiting
- **Restricción:** No modificar (históricas `001`–`004`)

## 3. Solución implementada

### 3.1 `supabase/migrations/000_base_schema.sql` (reescrita)
**Contenido final (187 bytes, verificado):**

```sql
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
-- 3. VISTA RESULTADOS (solo admin)
-- ------------------------------------------------------------
create or replace view public.resultados as
  select c.id, c.nombre, c.foto_url, count(v.id) as votos
  from public.candidatos c
  left join public.votos v on v.candidato_id = c.id
  group by c.id, c.nombre, c.foto_url
  order by votos desc;

-- Impedir que la vista omita RLS en las tablas base.
alter view public.resultados set (security_invoker = true);
```

**Qué incluye:**
- `create extension if not exists "pgcrypto"` — extensión criptográfica
- 5 tablas base: `mesas`, `votantes`, `candidatos`, `votos`, `configuracion`
- Fila inicial en `configuracion` (id=1, eleccion_abierta=false)
- RLS activado en todas las tablas (principio denegar por defecto)
- Vista `public.resultados` con `security_invoker = true`

**Qué NO incluye (001 las crea/overwrite):**
- Función `is_app_admin()` — la crea `001_security_hardening.sql` con `auth.jwt()`
- Políticas RLS — las crea `001_security_hardening.sql` usando `is_app_admin()`
- Funciones `verificar_votante`, `emitir_voto` — las modifica `001_security_hardening.sql`
- Tabla `rate_limit_intentos` — la crea `001_security_hardening.sql`
- Wrappers con rate limiting — las crea `001_security_hardening.sql`

### 3.2 `supabase/migrations/20261028161952_20261028000000_base_schema.sql` (eliminada)
- **Acción:** Archivo vacío eliminado para evitar confusiones
- **Razón:** Propósito poco claro; el contenido relevante fue integrado en `000_base_schema.sql`

## 4. Resultado verificado

### 4.1 `supabase db reset` — ÉXITO
Ejecutado: `npx supabase@latest db reset`

```
Resetting local database...
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 000_base_schema.sql...
Applying migration 001_security_hardening.sql...
Applying migration 002_mesas_padron.sql...
Applying migration 003_fix_is_app_admin.sql...
Applying migration 004_security_fixes.sql...
no files matched pattern: supabase/seed.sql
Restarting containers...
Finished supabase db reset on branch migracion-react.
{"target":"local","version":"","message":"Reset local database."}
```

**Todas las migraciones aplicadas en orden:** `000` → `001` → `002` → `003` → `004` ✓

### 4.2 Tablas verificadas en base de datos local
```
 public | candidatos          | table | postgres
 public | configuracion       | table | postgres
 public | mesas               | table | postgres
 public | rate_limit_intentos | table | postgres
 public | votantes            | table | postgres
 public | votos               | table | postgres
(6 rows)
```

### 4.3 Build y typecheck
- `npm run build` ✅ (535 módulos; aviso informativo chunk 893.43 kB)
- `npm run typecheck` ✅ (app + Node + handler)
- `npm run test:offline` ✅ (26/26 pruebas pasaron)

### 4.4 Integridad git
- `git diff --check` ✅ (solo avisos LF/CRLF, ninguno crítico)
- `git status --short` — cambios dentro de `webapp/`

## 5. Restricciones cumplidas

- ✅ Todos los cambios dentro de `webapp/`
- ✅ No se ejecutó contra base de producción
- ✅ No se usaron credenciales reales
- ✅ No se desactivó RLS, autenticación, controles de autorización
- ✅ No se editaron migraciones históricas `001`–`004`
- ✅ No se hizo commit, push ni despliegue
- ✅ No se inició la Fase 05
- ✅ `schema.sql` conservado como referencia

## 6. Próximos pasos pendientes (para el usuario)

1. **Usuario admin en Supabase Auth:** Crear usuario en Dashboard con `app_metadata.role = 'admin'` para que `is_app_admin()` retorne `true`
2. **Deploy Edge Function `voting-proxy`:** `supabase functions deploy voting-proxy --project-ref <ref>` para rate limiting real
3. **Migrar frontend a usar Edge Function:** En lugar de llamar a `supabase.rpc()` directo, usar `POST /functions/v1/voting-proxy`
4. **Ejecutar suites de integración:** `node tests/security.test.js`, `node tests/fase2.test.js`, `node tests/voting.test.js` contra Supabase local

## 7. Validación final

| Comprobación | Resultado |
|---|---|
| `supabase db reset` | **Completó exitosamente** todas las migraciones |
| `npm run build` | **Pasó** |
| `npm run typecheck` | **Pasado** |
| `npm run test:offline` | **26/26** pruebas pasaron |
| `git diff --check` | **Pasado** |
| Tablas en base local | **6 tablas** existen (mesas, votantes, candidatos, votos, configuracion, rate_limit_intentos) |

## 8. Qué se documenta en este informe

1. **Problema:** `000_base_schema.sql` incompleto → `supabase db reset` falla
2. **Solución:** Reemplazar `000_base_schema.sql` con contenido completo (tablas + pgcrypto + RLS + vista resultados)
3. **Archivo eliminado:** `20261028161952_20261028000000_base_schema.sql` (vacío)
4. **Migración base válida:** `000_base_schema.sql` (nuevo contenido)
5. **Resultados reales:** `supabase db reset` completa, todas las tablas existen
6. **Limitaciones:** Sin Auth extension local, `is_app_admin()` usa `auth.jwt()` de `001`; suites de integración requieren Docker + `.env.test`
7. **Restricciones respetadas:** Sin commit, push, despliegue, sin modificar `001`–`004`, sin tocar producción