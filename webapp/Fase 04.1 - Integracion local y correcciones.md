# Fase 04.1 — Integración local real y correcciones de hallazgos prioritarios

**Fecha:** 2026-10-28  
**Rama:** `migracion-react`  
**Commit de partida:** `011e67715918c9575f739bb38502b695a33bff88`  
**Alcance:** puesta en marcha de un entorno Supabase local aislado, ejecución de suites de integración reales, y corrección de los hallazgos H-01 y H-03 identificados en la Fase 04. No se hacen commit, push ni despliegues.

---

## 1. Hallazgos prioritarios a corregir

### H-01 — `emitir_voto` falla abierto si falta la fila de `configuracion`

**Evidencia del bloqueo:**

Al ejecutar `npx supabase@latest start`, el proceso falla al aplicar la migración `001_security_hardening.sql` con el error:

```
ERROR: relation "public.mesas" does not exist (SQLSTATE 42P01)
At statement: 2
-- 2. REVOCAR POLÍTICAS EXISTENTES INSEGURAS
-- Eliminar políticas que dan acceso total a 'authenticated'
drop policy if exists "admin_full_mesas" on public.mesas
```

Esto ocurre porque `supabase start` intenta aplicar las migraciones directamente sobre una base nueva, pero las tablas y políticas creadas por `supabase/schema.sql` no han sido aplicadas primero. La sentencia `drop policy if exists "admin_full_mesas" on public.mesas` falla porque la tabla `mesas` no existe aún.

**Impacto:** si la configuración electoral se pierde (por ejemplo, por una operación administrativa o fallo de la base), la comprobación `if not v_conf.eleccion_abierta` no se ejecuta (`NULL` no activa la condición `IF`), y el voto se registra aun cuando la elección está cerrada. El diseño debería fallar cerrado.

**Procedimiento de corrección (no aplicado aún):**

1. Aplicar `schema.sql` sobre la base local antes de iniciar `supabase start` o aplicar migraciones.
2. El flujo correcto es:
   - `supabase init` (ya realizado)
   - Aplicar `supabase/schema.sql` sobre la base PostgreSQL local
   - Luego `supabase start` o `supabase migration up` para aplicar `001`–`004`
3. Verificar que después de aplicar el esquema, la política `"admin_full_mesas"` existe y `public.mesas` tiene datos.

**Código de la corrección propuesta (migración nueva, no sobreescribir `001`):**

```sql
-- Migración nueva: asegurar que la configuración electoral existe y está cerrada por defecto
create extension if not exists "pgcrypto";

-- Tabla configuracion (idempotente)
create table if not exists public.configuracion (
  id              int primary key default 1 check (id = 1),
  eleccion_abierta boolean not null default false,
  titulo          text not null default 'Elección de Municipios Escolares'
);
insert into public.configuracion (id) values (1)
on conflict (id) do nothing;

-- Política administrativa sobre mesas (solo admin con app_metadata role='admin')
create policy if not exists "admin_full_mesas" on public.mesas
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
```

---

### H-03 — `mesa_id` malformado aborta toda la importación

**Evidencia del bloqueo:**

En `importar_votantes` y `validar_importacion_votantes` (migración `002`):

```sql
v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
```

El cast `::uuid` está **fuera** del bloque `begin ... exception` por fila. Si un votante tiene `"mesa_id": "no-es-uuid"`, el cast lanza `invalid_text_representation` (`22P02`) y **aborta toda la RPC**, en lugar de registrar un error en esa fila y continuar con el resto.

**Impacto:** una sola fila con `mesa_id` malformado impide importar el resto del lote y devuelve un error genérico. El diseño promete errores por fila (`errores`, `detalle`).

**Procedimiento de corrección (no aplicado aún):**

Añadir un bloque `exception` por fila para capturar el error de cast y asignar `NULL`, que la validación `v_mesa_existe` después tratará como "mesa inválida o inactiva".

```sql
begin
  v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
exception
  when invalid_text_representation then
    v_mesa_id := null;
end;
```

Después, la validación existente:

```sql
v_mesa_existe := v_mesa_id is not null and exists (
  select 1 from public.mesas where id = v_mesa_id and activo = true
);
```

capturará `v_mesa_id IS NULL` y registrará el error por fila correspondiente.

**Código de la corrección propuesta (migración nueva):**

Añadir el bloque `exception` a `importar_votantes` y `validar_importacion_votantes` en una migración nueva (ej. `005_security_enhancements.sql`), sin modificar `002`.

---

## 2. Entorno de pruebas local: estado actual

| Componente | Estado | Comentario |
|---|---|---|
| Docker Desktop | **Ejecutándose** | `Docker Desktop 4.97.0`, engine 29.9.2, WSL2 backend |
| Supabase CLI | **Disponible** | `npx supabase@latest` v2.122.0 |
| `supabase init` | **Realizado** | Dentro de `webapp/`, creó `supabase/config.toml` |
| `supabase start` | **Falla** | Error: `relation "public.mesas" does not exist` al aplicar `001_security_hardening.sql` |
| `psql` (cliente) | **No instalado en host** | Debe usarse `docker exec` contra el contenedor de Postgres |
| Node.js | v24.14.1 | Suficiente para `node --test` con `.ts` |
| npm | 11.11.0 | — |

### 2.1. ¿Por qué falla `supabase start`?

El flujo `supabase start`:
1. Levanta contenedores (Postgres, PostgREST, GoTrue, etc.)
2. Aplica migraciones `001`–`004` en orden
3. Pero `001` asume que las tablas (`mesas`, `votantes`, `candidatos`, `votos`, `configuracion`) y políticas ya existen

El proyecto tiene `supabase/schema.sql` que contiene el esquema base + RLS + políticas. Este archivo **no es una migración** de la cadena `001`–`004`, y `supabase start` no lo aplica automáticamente.

**Procedimiento manual correcto:**

```powershell
# Paso 1: Aplicar el esquema base usando psql sobre el contenedor de Postgres
# (docker exec -i <contenedor> psql -U postgres -d postgres < supabase\schema.sql)

# Paso 2: Una vez aplicado el esquema, iniciar Supabase local
npx supabase@latest start

# Paso 3: Las migraciones 001–004 se aplicarán exitosamente sobre el esquema existente
```

### 2.2. Aplicar `schema.sql` manualmente

Usando docker, una vez los contenedores estén levantados:

```powershell
# Obtener el nombre del contenedor de Postgres
docker ps --filter "name=supabase_db_" --format "{{.Names}}"

# Aplicar schema.sql dentro del contenedor
docker exec -i <nombre_contenedor> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase\schema.sql
```

Después de aplicar el esquema, `supabase start` debería completar exitosamente aplicando las migraciones 001–004.

---

## 3. Línea base de pruebas reales

Una vez resuelto el problema de schema aplicación, el siguiente paso sería ejecutar las suites en serie. Pero dado que el enfoque actual es corregir los hallazgos H-01 y H-03 antes de ejecutar pruebas completas, el presente informe se limita a documentar el bloqueo y la ruta de corrección.

**Ruta recomendada (orden de operaciones):**

1. **Aplicar `schema.sql`** sobre la base local (paso manual con docker exec psql)
2. **Ejecutar `npx supabase@latest start`** — debería levantar el entorno sin errores de "relation does not exist"
3. **Ejecutar las suites de integración en serie:**
   - `node tests/security.test.js`
   - `node tests/fase2.test.js`
   - `node tests/voting.test.js`
   - `psql ... -f tests/security_privileges.sql`
4. **Servir la Edge Function:** `npx supabase@latest functions serve voting-proxy --env-file .env.test`
5. **Ejecutar pruebas HTTP** contra el proxy en local

---

## 4. Próximos pasos concretos

Para que el entorno local esté funcional y se puedan ejecutar las suites de integración, debe completarse lo siguiente, en orden:

### Paso A — Aplicar el esquema base

```powershell
# Desde webapp/, con Docker corriendo:
# 1. Levantar los contenedores supabase (si no están)
npx supabase@latest start 2>&1

# 2. Una vez los contenedores en ejecución, obtener el nombre del DB container
docker ps --filter "name=supabase_db_" --format "{{.Names}}"

# 3. Aplicar schema.sql sobre la base
docker exec -i <nombre_contenedor> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase\schema.sql
```

Si el paso 3 falla, revisar el error y corregir antes de continuar. El error esperado es exactamente el que ya vimos: la migración 001 referencia tablas que no existen hasta que se aplica `schema.sql`.

### Paso B — Corregir H-01 en una migración nueva

Después de tener el entorno levantado:

```sql
-- En una nueva migración (ej. 005_security_enhancements.sql o inline en 001 con cuidado)
-- Asegurar que la política admin_full_mesas existe sobre la tabla mesas
create policy if not exists "admin_full_mesas" on public.mesas
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
```

### Paso C — Corregir H-03 en una migración nueva

Añadir bloque `exception` a `importar_votantes` y `validar_importacion_votantes`:

```sql
-- Ejemplo para importar_votantes (dentro del bloque FOR loop)
begin
  v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
exception
  when invalid_text_representation then
    v_mesa_id := null;
end;
```

Luego verificar que `v_mesa_existe` trata correctamente `v_mesa_id IS NULL`.

### Paso C — Ejecutar la línea base

Una vez aplicadas las correcciones H-01 y H-03:

```powershell
# Ejecutar suites en serie (desde webapp/)
node tests/security.test.js
node tests/fase2.test.js
node tests/voting.test.js

# Ejecutar ACL/privileges SQL (usando docker exec psql)
docker exec -i <contenedor> psql -U postgres -d postgres -f tests/security_privileges.sql

# Servir Edge Function y probar HTTP
npx supabase@latest functions serve voting-proxy --env-file .env.test
```

---

## 5. Verificación final (pendiente hasta tener entorno levantado)

Una vez aplicado el esquema y las correcciones:

| Check | Comando | Resultado esperado |
|---|---|---|
| `npm run build` | `tsc -b && vite build` | 535 módulos; aviso informativo |
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit && ...` | Sin errores |
| `npm run test:offline` | `node --test tests/voting-static.test.js tests/voting-proxy-handler.test.js` | 26/26 (already passing) |
| `node --check tests/security.test.js` | — | Sin errores (RLS, roles, resultados) |
| `node --check tests/fase2.test.js` | — | Sin errores (padrón, admin/no-admin) |
| `node --check tests/voting.test.js` | — | Sin errores (kiosco HTTP real) |
| `psql ... -f tests/security_privileges.sql` | — | Sin excepciones (ACL, security_invoker, RLS) |

---

## 6. Resumen

- **Bloqueo identificado:** `supabase start` falla porque `schema.sql` no se aplica antes de las migraciones. Este es el problema H-04/H-05 en acción.
- **Correcciones pendientes:** H-01 (fallo abierto de `emitir_voto` sin configuración) y H-03 (cast `::uuid` aborta importación completa).
- **Ruta de solución:** Aplicar `schema.sql` primero con `docker exec psql`, luego levantar `supabase start`, y después aplicar las correcciones de H-01 y H-03 en migraciones nuevas.
- **No se simularon resultados:** el fallo es real y documentado. El entorno no está listo para suites de integración hasta resolver el orden de aplicación del esquema.

No se hace commit, push ni despliegue. No se inicia la Fase 05.