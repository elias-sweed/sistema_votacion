# Fase 04 — Auditoría de integración real con Supabase

- **Fecha:** 2026-10-27
- **Rama:** `migracion-react`
- **Commit de partida:** `011e67715918c9575f739bb38502b695a33bff88`
- **Alcance:** auditoría de integración y seguridad entre el kiosco `/votar`, la Edge Function `voting-proxy` y el esquema PostgreSQL de `webapp/supabase/`. Sin despliegues, sin migraciones contra producción y sin cambios de datos reales.

---

## 1. Resumen ejecutivo

Esta fase distingue tres niveles y no los mezcla:

1. **Ejecutado realmente:** build de producción, typecheck de app/Node/handler, 26 pruebas offline y comprobación sintáctica de los scripts de prueba.
2. **Revisado en código, no ejecutado:** RLS, políticas, ACL, RPC transaccionales, rate limiting, Edge Function en Deno y pruebas de integración contra Postgres.
3. **Bloqueado:** todo lo que requiere Docker, Supabase CLI, `psql`, Deno o un proyecto Supabase local/de pruebas.

**Conclusión:** la integración con Supabase **no está verificada**. No existe en este entorno ninguna base de datos local ni credenciales de pruebas autorizadas, por lo que **no se puede afirmar** que RLS, los permisos, la concurrencia, el rate limiting ni las RPC funcionen en ejecución real. Las pruebas offline validan la lógica HTTP del proxy con un cliente simulado; no sustituyen a Postgres.

Se corrigió un defecto reproducible de observabilidad: `logError` registraba `[object Object]` cuando PostgREST devolvía un error estructurado, ocultando el diagnóstico. Ahora registra `message`, `details`, `hint` y `code`. Se añadió una prueba de regresión offline.

No se aplicó ninguna corrección de esquema. Los hallazgos SQL se documentan con propuesta, impacto y snippet, pero **no se ejecutaron**.

---

## 2. Entorno real de verificación

| Recurso | Estado | Evidencia |
|---|---|---|
| Node.js | Disponible, v24.14.1 | `node --version` |
| npm | Disponible, 11.11.0 | `npm --version` |
| Git | Disponible y usado para revisar el estado | `git status`, `git diff` |
| Docker | **No disponible** | `Get-Command docker` sin resultado |
| Supabase CLI | **No disponible** | `Get-Command supabase` sin resultado |
| `psql` | **No disponible** | `Get-Command psql` sin resultado |
| Deno | **No disponible** | `Get-Command deno` sin resultado |
| `webapp/.env.test` | **No existe** | `Test-Path` |
| `webapp/supabase/config.toml` | **No existe** | `Test-Path` |
| Proyecto Supabase de pruebas | **No autorizado / no disponible** | Sin credenciales locales |

No se inventaron credenciales, usuarios, resultados ni configuraciones. No se leyó ni se transcribió `webapp/.env`.

---

## 3. Método

- Revisión de `Cambios nuevos.md`, informes de Fases 02.1, 02.2, 03 y 03.1.
- Lectura y revisión de `supabase/schema.sql`, migraciones `001`–`004`, `handler.ts`, `index.ts`, `votingService.ts`, `App.tsx`, los seis scripts de prueba y `tests/security_privileges.sql`.
- Ejecución de las comprobaciones que no requieren servicios externos.
- Revisión de Git antes de empezar: rama `migracion-react`, `HEAD` en `011e677`, árbol limpio.
- Toda modificación se mantuvo dentro de `webapp/`.

**Límite explícito:** una lectura correcta del SQL no demuestra su comportamiento en Postgres. Los estados “revisado en código” de la sección 7 no equivalen a “aprobado”.

---

## 4. Preparación de un entorno de pruebas aislado

### 4.1 Requisitos

1. **Docker Desktop** con backend WSL2 en Windows, iniciado y con recursos suficientes (las imágenes de Supabase ocupan varios GB).
2. **Node.js 24 o superior.** Las suites usan `import` de archivos `.ts` directamente (`tests/voting-proxy-handler.test.js` importa `handler.ts`), función disponible en Node 24.
3. **Supabase CLI.** Puede usarse vía `npx supabase@latest`; no es necesario instalarla globalmente.
4. **Cliente PostgreSQL (`psql`)**, o usar el `psql` que ya existe dentro del contenedor de base de datos de Supabase.
5. **Deno** solo si se quiere ejecutar `deno check` sobre `index.ts`; el CLI de Supabase ejecuta la función dentro de su runtime y no requiere Deno instalado en el host.

### 4.2 Variables necesarias

| Variable | Uso | Origen | ¿Se versiona? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Build del frontend | URL del proyecto (local o producción) | Solo `.env.example` con marcadores |
| `VITE_SUPABASE_ANON_KEY` | Build del frontend | Clave pública del proyecto | Solo `.env.example` con marcadores |
| `SUPABASE_URL` | Suites de integración y runtime local | `supabase status` | Nunca; `.env.test` está ignorado |
| `SUPABASE_ANON_KEY` | Suites de integración | `supabase status` | Nunca; `.env.test` está ignorado |
| `SUPABASE_SERVICE_ROLE_KEY` | Suites de integración y Edge Function | `supabase status` | **Nunca**; `.env.test` está ignorado |
| `SUPABASE_URL` (runtime) | `index.ts` dentro de la Edge Function | Inyectada por Supabase o `--env-file` | No |
| `SUPABASE_SERVICE_ROLE_KEY` (runtime) | `index.ts` dentro de la Edge Function | Secreto del proyecto o `--env-file` | No |

Notas:

- El frontend **solo** usa `VITE_*`; la `service_role` nunca se compila en el bundle. `tests/voting-static.test.js` lo comprueba de forma estática.
- `.env.test.example` contiene JWT de demostración de Supabase local. **No son credenciales de producción**, pero pueden no coincidir con las claves que imprima una instalación actual (por ejemplo, claves `publishable`/`secret`). Hay que sustituirlas por los valores reales de `supabase status`; no se debe asumir que funcionan.
- Las tres suites de integración abortan si el host de `SUPABASE_URL` no es `localhost`, `127.0.0.1` o `::1`. Es una protección deliberada: **no apuntar nunca a producción**.

### 4.3 Procedimiento exacto (PowerShell, desde `webapp/`)

> Ejecutar cada bloque desde `C:\Users\elias\Documents\VOTACION\sistema_votacion\webapp`. No ejecutar nada de esto contra un proyecto remoto.

**Paso 1 — Inicializar la configuración local**

```powershell
npx supabase@latest init
```

Debe crear `supabase/config.toml` sin borrar `functions/` ni `migrations/`. Si la CLI avisa de que el directorio ya existe, revisar primero `npx supabase@latest init --help` y confirmar que la operación solo crea/actualiza `config.toml`; revisar `git status` antes de continuar.

**Paso 2 — Arrancar Supabase local**

```powershell
npx supabase@latest start
```

**Paso 3 — Obtener URL y claves**

```powershell
npx supabase@latest status
```

Copiar la **API URL**, la clave `anon` (o `publishable`) y la clave `service_role` (o `secret`) a `webapp/.env.test`:

```dotenv
SUPABASE_URL=<API URL que imprime supabase status>
SUPABASE_ANON_KEY=<clave anon/publishable local>
SUPABASE_SERVICE_ROLE_KEY=<clave service_role/secret local>
```

No pegar estas claves en informes, issues ni commits.

**Paso 4 — Aplicar el esquema base**

`supabase db reset` **no sirve para una instalación limpia** en este repositorio: solo ejecuta `supabase/migrations/`, y la migración `001` presupone tablas y políticas creadas por `supabase/schema.sql`, que no es una migración. Hay que aplicar el esquema primero.

Con `psql` instalado:

```powershell
$dbUrl = "<DB URL que imprime supabase status>"
psql $dbUrl -v ON_ERROR_STOP=1 -f supabase/schema.sql
```

Sin `psql` en el host, usando el contenedor de base de datos:

```powershell
docker ps --filter "name=supabase_db_" --format "{{.Names}}"
cmd /c "docker exec -i <nombre_del_contenedor> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase\schema.sql"
```

**Paso 5 — Aplicar las migraciones en orden**

Con `psql`:

```powershell
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql $dbUrl -v ON_ERROR_STOP=1 -f $_.FullName
}
```

Sin `psql` en el host, repetir el paso 4 para cada archivo, en orden estricto:

```text
001_security_hardening.sql
002_mesas_padron.sql
003_fix_is_app_admin.sql
004_security_fixes.sql
```

**Paso 6 — Verificar ACL y RLS en PostgreSQL**

```powershell
psql $dbUrl -v ON_ERROR_STOP=1 -f tests/security_privileges.sql
```

Si el script termina sin excepción, las aserciones de privilegios y `security_invoker` pasaron. Un `raise exception` indica un fallo real, no un bloqueo.

**Paso 7 — Servir la Edge Function en local**

```powershell
npx supabase@latest functions serve voting-proxy --env-file .env.test
```

- No usar `--no-verify-jwt`: debilitaría la verificación de JWT.
- Si el runtime ya inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, `--env-file` es redundante pero inocuo.
- La función debe quedar accesible en la URL que muestre el CLI (por defecto, la misma API local).

**Paso 8 — Ejecutar las suites en serie**

```powershell
node tests/security.test.js
node tests/fase2.test.js
node tests/voting.test.js
```

Deben ejecutarse desde `webapp/` porque cargan `.env.test` con ruta relativa. No ejecutarlas en paralelo: comparten la misma IP de rate limiting y modifican temporalmente `configuracion` y fixtures.

**Paso 9 — Apagar el entorno local**

```powershell
npx supabase@latest stop --no-backup
```

No usar `--no-backup` si se necesita conservar la base local; en ese caso, documentar el volumen y no confundirlo con datos reales.

### 4.4 Por qué `supabase db reset` no reconstruye este proyecto

- `supabase/schema.sql` contiene tablas, políticas RLS, la vista `resultados` y las funciones base.
- `supabase/migrations/001` hace `drop function` y `create or replace` sobre objetos que deben existir; también crea la tabla `rate_limit_intentos` y depende de `configuracion`.
- `supabase db reset` ejecuta únicamente `migrations/` y `seed.sql`. Sin un `000_base_schema.sql`, una base nueva queda vacía y `001` falla al crear o ejecutar funciones que dependen de tablas de `schema.sql` (por ejemplo, `public.configuracion%rowtype`).

**Propuesta (no aplicada en esta fase):** mover el contenido base a `supabase/migrations/000_base_schema.sql` (o convertir `schema.sql` en migración) y hacer las políticas idempotentes. Así `supabase db reset` sería reproducible y las pruebas podrían usar el flujo estándar del CLI. Requiere revisar el orden y las políticas; no se ejecutó.

### 4.5 Advertencias de seguridad

- No usar claves de producción en `.env.test`.
- No ejecutar estas pruebas contra un proyecto remoto, aunque `SUPABASE_URL` apunte a un host permitido por un túnel o `localhost` proxificado.
- No desactivar RLS, `verify_jwt` ni las comprobaciones de `is_app_admin()` para “hacer pasar” una prueba.
- No reutilizar el volumen local para datos reales.

---

## 5. Pruebas ejecutadas y resultados reales

| Comprobación | Comando | Resultado real |
|---|---|---|
| Build de producción | `npm run build` | **Pasó.** `tsc -b && vite build`; 535 módulos; aviso de chunk JS de 893.43 kB (informativo) |
| Typecheck app + Node + handler | `npm run typecheck` | **Pasó.** `tsconfig.app.json`, `tsconfig.node.json` y `tsconfig.edge.json` sin errores |
| Pruebas offline | `npm run test:offline` | **26/26 pasaron** |
| Sintaxis de los seis scripts | `node --check tests/*.js` y `manual-kiosk-mock-server.mjs` | **Pasó** |
| Estado de Git | `git status --short --untracked-files=all` | Solo archivos dentro de `webapp/` |
| Integridad del diff | `git diff --check` | Ver sección 12 |

### 5.1 Cobertura real de `npm run test:offline`

`tests/voting-static.test.js` (7 pruebas):

- El frontend no contiene `SUPABASE_SERVICE_ROLE_KEY` ni `service_role`.
- El servicio del navegador no invoca RPC ni consulta `candidatos` directamente; usa `functions.invoke`.
- La identidad se limpia antes de mostrar candidatos.
- La respuesta exitosa no incluye identidad ni candidato.
- El entrypoint delega en el handler y no incrusta secretos.
- `candidatos` es una rama hermana de `estado` (regresión de la Fase 03.1).
- El proxy devuelve `nombre: null` explícito para DNI inexistente.

`tests/voting-proxy-handler.test.js` (19 pruebas):

- CORS, método, JSON inválido, acción desconocida.
- Estado y configuración ausente.
- Candidatos activos, filtrado de campos y error controlado.
- Verificación de DNI existente, inexistente, ya votado y rate limit.
- Validación de DNI y UUID antes de llamar a la base.
- Voto único, códigos `P0003`/`P0004`/`P0005`/`P0007`.
- Cliente Supabase ausente y excepción inesperada.
- **Nueva:** un error estructurado de PostgREST se registra con `message` y `code`, no como `[object Object]`.

### 5.2 Corrección aplicada

| Archivo | Cambio |
|---|---|
| `supabase/functions/voting-proxy/handler.ts` | `describeError()` extrae `message`, `details`, `hint` y `code` de errores planos; `logError()` lo usa |
| `tests/voting-proxy-handler.test.js` | Regresión que simula `42501 permission denied` y exige que el log no contenga `[object Object]` |

No cambia respuestas HTTP, contratos, validaciones ni permisos.

### 5.3 Lo que estas pruebas **no** demuestran

- Que las políticas RLS se apliquen como se leen.
- Que `anon` no pueda leer `votantes` o `votos`.
- Que un administrador autenticado pueda operar y un miembro no.
- Que dos votos simultáneos produzcan exactamente uno.
- Que una elección cerrada rechace el voto en Postgres.
- Que el rate limiting real funcione con `inet`, ventanas y concurrencia.
- Que la Edge Function arranque en Deno/Supabase.
- Que las ACL de `security_privileges.sql` se cumplan.

---

## 6. Pruebas bloqueadas y motivo

| Prueba | Comando | Bloqueo | Qué demostraría |
|---|---|---|---|
| Seguridad RLS/roles/resultados | `node tests/security.test.js` | Falta `.env.test`, Supabase local, Edge Function servida y Docker/CLI | Aislamiento por rol, admin real vía `app_metadata`, vista `resultados`, doble voto, rate limit |
| Padrón e importación | `node tests/fase2.test.js` | Igual | RPC administrativas, validación de importación, autorización admin/no-admin |
| Kiosco HTTP real | `node tests/voting.test.js` | Falta `.env.test`, Supabase local y Edge Function servida; `psql` no es necesario | Contrato real del proxy, concurrencia, elección cerrada, RPC directas bloqueadas |
| ACL y RLS en PostgreSQL | `psql ... -f tests/security_privileges.sql` | Falta `psql` y base local | Privilegios EXECUTE, `TRUNCATE`, `security_invoker`, RLS activo |
| Edge Function en Deno | `deno check supabase/functions/voting-proxy/index.ts` | Falta Deno | Tipos y arranque del entrypoint real |
| Reconstrucción limpia | `supabase db reset` | Falta CLI/Docker y no existe migración base | Instalación reproducible desde cero |

No se simularon estas ejecuciones ni se marcaron como aprobadas.

---

## 7. Auditoría de controles

| Control | Evidencia revisada | Estado |
|---|---|---|
| RLS activo en tablas sensibles | `schema.sql` y `001` activan RLS en `mesas`, `votantes`, `candidatos`, `votos`, `configuracion`, `rate_limit_intentos` | Revisado en código; **no ejecutado** |
| Admin real distinto de `authenticated` | `is_app_admin()` usa `auth.jwt() -> 'app_metadata' ->> 'role'`; `004` añade `service_role` | Revisado en código |
| Operaciones administrativas protegidas | `obtener_estadisticas_padron`, `listar_votantes`, `importar_votantes`, `validar_importacion_votantes` comprueban `is_app_admin()` al inicio | Revisado en código |
| Permisos de RPC administrativas | `004` revoca EXECUTE global y concede solo a `authenticated`; `security_privileges.sql` lo asserta | Revisado en código; **no ejecutado** |
| Kiosco sin acceso directo al padrón | `anon` sin políticas en `votantes`/`votos`/`configuracion`; sin EXECUTE en RPC base ni wrappers | Revisado en código |
| Kiosco solo lee candidatos activos | Política `anon_lee_candidatos_activos` y `grant select` a `anon` | Revisado en código |
| Un voto por votante | `update ... where dni = ... and ha_votado = false returning`; `P0004` si no actualiza | Revisado en código; concurrencia **no ejecutada** |
| Elección cerrada | `emitir_voto` lee `configuracion` con `FOR SHARE` y lanza `P0003` | Revisado en código; **no ejecutado** |
| Entradas del proxy | DNI `^\d{8}$`; UUID v4; acción enumerada; JSON inválido rechazado | **Ejecutado offline** |
| Secretos fuera del frontend | `index.ts` lee `Deno.env`; test estático del bundle; `service_role` no aparece en `src/` | **Ejecutado offline** (estático) |
| Vista `resultados` sin bypass de RLS | `security_invoker = true`; `004` revoca y concede solo a `authenticated`/`service_role` | Revisado en código |
| Datos de prueba aislados | DNIs aleatorios, nombres con `runId`, limpieza en `finally` | Revisado en código; **no ejecutado** |
| Rate limiting | Wrappers con ventana por IP y por hash de DNI | Revisado en código; **no ejecutado** |

**No se declara ninguno de estos controles como “seguro” solo por existir una prueba estática.**

---

## 8. Hallazgos confirmados

### H-01 — ALTO — `emitir_voto` falla abierto si falta la fila de `configuracion`

**Evidencia:**

```sql
select * into v_conf
from public.configuracion
where id = 1
for share;

if not v_conf.eleccion_abierta then
  raise exception 'La elección está cerrada' using errcode = 'P0003';
end if;
```

Si la fila `id = 1` no existe, `v_conf` queda `NULL`. En PL/pgSQL, `NOT NULL` es `NULL`, y un `IF NULL` no ejecuta la rama. Por tanto, la comprobación de elección abierta se omite y el voto continúa.

**Impacto:** un control crítico falla abierto si la configuración se borra accidentalmente o por una operación administrativa/backend. El esquema inserta la fila al instalar, por lo que no es alcanzable desde el kiosco ni desde un miembro; requiere una acción con privilegios de escritura sobre `configuracion`. Aun así, el diseño debería fallar cerrado.

**Propuesta (no aplicada):**

```sql
if v_conf.eleccion_abierta is not true then
  raise exception 'La elección está cerrada' using errcode = 'P0003';
end if;
```

Alternativa equivalente: comprobar `if not found then raise ...` inmediatamente después del `select into`.

---

### H-02 — MEDIO — El rate limiting por IP confía en `x-forwarded-for` y el kiosco permite enumerar nombres por DNI

**Evidencia:** `extractClientIp()` toma el primer valor de `x-forwarded-for` sin validarlo. El proxy llama a `verificar_votante_con_limite`, que cuenta intentos por `client_ip` y por `dni_hash`.

**Impacto:** si un cliente puede falsificar `x-forwarded-for` (depende de cómo lo trate la plataforma en el despliegue real, no verificado aquí), el límite por IP se elude variando el header en cada petición. El límite por DNI solo frena repeticiones del mismo DNI, no la enumeración de DNIs distintos. La acción `verificar` devuelve el nombre cuando el DNI existe, de modo que un atacante podría confirmar nombres de una lista de DNIs conocidos sin agotar rápidamente el límite por DNI.

**Atenuantes:** el espacio de DNIs es de 10^8; un barrido completo es costoso. El kiosco está pensado para una red escolar controlada. La respuesta no expone mesa, voto ni padrón completo.

**Propuesta:** confirmar en un despliegue real si Supabase sobrescribe `x-forwarded-for`; si no, obtener la IP de un header de confianza o añadir un límite global/por sesión además del per-IP. No aplicar un cambio de código sin verificar primero el comportamiento de la plataforma.

---

### H-03 — MEDIO — Un `mesa_id` malformado aborta toda la importación

**Evidencia:** en `importar_votantes` y `validar_importacion_votantes`:

```sql
v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
```

El cast está fuera del bloque `begin ... exception` por fila. Un valor como `"no-es-uuid"` lanza `invalid_text_representation` (`22P02`) y aborta la RPC completa, en lugar de registrar un error de esa fila. El diseño promete errores por fila (`errores`, `detalle`).

**Impacto:** una sola fila corrupta impide importar el resto del lote y devuelve un error genérico. No es una vulnerabilidad de elevación, pero rompe la tolerancia a errores y la experiencia administrativa.

**Propuesta (no aplicada):**

```sql
begin
  v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
exception
  when invalid_text_representation then
    v_mesa_id := null;
end;
```

Después, la validación existente `v_mesa_existe` lo tratará como mesa inválida. Añadir una prueba de importación con UUID malformado.

---

### H-04 — MEDIO — No existe migración base: `supabase db reset` no reconstruye el esquema

**Evidencia:** `supabase/schema.sql` no está en `migrations/`; `migrations/001` presupone sus tablas, políticas y funciones.

**Impacto:** una base limpia creada por el flujo estándar del CLI queda vacía y `001` falla al crear o ejecutar funciones que dependen de tablas de `schema.sql` (por ejemplo, `public.configuracion%rowtype`). Las pruebas de integración dependen de un paso manual con `psql`, que no está disponible en este entorno. Esto impide reproducir la instalación de forma automática y aumenta el riesgo de divergencia entre entornos.

**Propuesta:** crear `migrations/000_base_schema.sql` con el contenido base idempotente, o documentar y automatizar el paso `schema.sql` antes de las migraciones. No se aplicó porque cambia el flujo de migraciones y requiere revisión.

---

### H-05 — MEDIO — `schema.sql` no es idempotente para las políticas

**Evidencia:** `create policy` no admite `if not exists`; `schema.sql` crea políticas con nombres fijos. Una segunda ejecución sobre la misma base falla con “policy already exists” después de haber creado tablas.

**Impacto:** repetir la instalación o recuperar un entorno a medias requiere limpieza manual. Aumenta el riesgo de dejar la base en un estado parcial.

**Propuesta:** anteponer `drop policy if exists <nombre> on <tabla>;` a cada `create policy`, o envolver la creación en un bloque que compruebe `pg_policies`. No aplicar sin revisar el resto de la idempotencia (funciones, grants, vista).

---

### H-06 — MEDIO — Hash de DNI sin sal (`SHA-256` directo)

**Evidencia:** `hashDni()` calcula `SHA-256(dni)` y lo envía a `rate_limit_intentos.dni_hash`. El DNI tiene 8 dígitos: 100 millones de valores.

**Impacto:** quien pueda leer `rate_limit_intentos` (administradores autenticados o `service_role`) puede precalcular o enumerar hashes y recuperar el DNI. El sistema ya guarda el DNI en claro en `votantes`, por lo que el hash no añade una protección real frente a un acceso a la base; sí evita que el DNI aparezca literalmente en los logs de rate limiting.

**Propuesta:** usar `HMAC-SHA-256` con un secreto de servidor (pepper) si se quiere que el hash sea resistente a enumeración, o aceptar el riesgo documentándolo. Cualquier cambio exige coordinar el secreto con el backend y no puede hacerse solo en el frontend.

---

### H-07 — MEDIO — La tabla de rate limiting crece sin límite

**Evidencia:** `rate_limit_intentos` se inserta en cada verificación y cada intento de voto; no hay `delete`, partición ni job de limpieza en el esquema ni en las migraciones.

**Impacto:** crecimiento indefinido de tabla e índices, degradación de las consultas de conteo y consumo de almacenamiento. En un evento de abuso, acelera el problema.

**Propuesta:** job periódico (`pg_cron` o tarea del backend) que elimine filas fuera de la ventana relevante; alternativa, índice y política de retención. No se añadió ninguna función nueva.

---

### H-08 — BAJO — CORS `Access-Control-Allow-Origin: *`

**Evidencia:** `corsHeaders` del handler.

**Impacto:** cualquier origen puede invocar el proxy desde un navegador. No hay cookies ni credenciales, así que no habilita CSRF clásico; el endpoint es público por diseño. Aun así, amplía la superficie de automatización y abuso junto con H-02. CORS no es un control de autorización.

**Propuesta:** permitir solo los orígenes de los kioscos conocidos si el despliegue lo permite, manteniendo el rate limiting como control real. No se cambió para no romper el flujo actual sin conocer los dominios de despliegue.

---

### H-09 — BAJO — Falta `supabase/config.toml`

**Evidencia:** no existe `webapp/supabase/config.toml`. El proyecto no fija `verify_jwt`, configuración de funciones, puertos ni `project_id`.

**Impacto:** el comportamiento local y el despliegue dependen de valores por defecto del CLI. No se puede reproducir exactamente la configuración ni revisar en Git si `verify_jwt` está activo.

**Propuesta:** añadir un `config.toml` sin secretos, con `verify_jwt = true` para `voting-proxy` y el `project_id` local. Se documenta el paso `supabase init`; no se creó el archivo en esta fase.

---

### H-10 — BAJO — `validateUuid` exige UUID v4

**Evidencia:** el regex exige el nibble de versión `4` y variante `[89ab]`. Los candidatos actuales usan `gen_random_uuid()` (v4), por lo que funcionan. Un candidato creado con otro generador o importado con UUID v1/v7 sería rechazado antes de consultar la base.

**Impacto:** rigidez funcional; no es un riesgo de seguridad. Podría bloquear una migración de datos legítima.

**Propuesta:** validar el formato UUID genérico (`^[0-9a-f]{8}-...$`) y dejar que la base valide la existencia del candidato. No se cambió para no alterar el contrato sin pruebas reales.

---

### H-11 — BAJO — `index.ts` no está cubierto por el typecheck

**Evidencia:** `tsconfig.edge.json` incluye solo `supabase/functions/voting-proxy/handler.ts`. `index.ts` usa APIs de Deno y no se compila con `tsc`; tampoco se ejecutó `deno check`.

**Impacto:** un error de tipos o de API en el entrypoint Deno no se detecta en local. Las pruebas offline validan el handler, no el arranque real.

**Propuesta:** ejecutar `deno check supabase/functions/voting-proxy/index.ts` en CI o en un entorno con Deno, o añadir un `deno.json` y un chequeo dedicado. No se añadió Deno al proyecto en esta fase.

---

### H-12 — BAJO — Fragilidad de las pruebas de integración

**Evidencia:** `tests/voting.test.js` realiza exactamente cinco intentos de `emitir_voto` desde la misma IP en menos de un minuto (elección cerrada, voto correcto, duplicado y dos concurrentes). El límite por IP es 5/min. Un intento adicional o una ejecución con residuos de rate limiting haría fallar la prueba con `P0007` en lugar del código esperado. `voting.test.js` no fija una IP propia: usa la que asigne el runtime local. `security.test.js` sí genera una IP aleatoria por ejecución y limpia sus hashes, por lo que no tiene este problema.

**Impacto:** falsos negativos intermitentes en CI o tras una ejecución fallida que no limpie `rate_limit_intentos`. No afecta a producción.

**Propuesta:** limpiar la tabla por IP/hashes al inicio de `voting.test.js`, usar una IP sintética distinta por ejecución mediante el header de `functions.invoke` o elevar el límite solo en el entorno de pruebas mediante configuración, nunca en producción. No se modificó la suite en esta fase.

---

### H-13 — INFO — `P0004` se usa para “DNI inválido” y “ya votó”

**Evidencia:** `emitir_voto` lanza `P0004` si el `update` no afecta filas, ya sea porque el DNI no existe o porque ya votó. El proxy lo traduce como “Este votante ya emitió su voto”.

**Impacto:** mensaje potencialmente engañoso para un DNI válido en formato pero inexistente en el padrón. El flujo normal verifica antes de votar, por lo que es poco probable. No revela información adicional.

**Propuesta:** separar códigos (`P0004` duplicado, `P0009` no encontrado) si se quiere un mensaje exacto; requiere cambiar SQL y pruebas. No se aplicó.

---

### H-14 — INFO — Posible inferencia de voto en mesas pequeñas

**Evidencia:** `votos` guarda `mesa_id` y `candidato_id`; `votantes` guarda `mesa_id` y `ha_votado`. No hay DNI ni timestamp en `votos`, lo que evita la vinculación directa.

**Impacto:** si una mesa tiene un solo votante, o si se combina el estado `ha_votado` con el número de votos por mesa, puede inferirse el sentido del voto a nivel de mesa. Es un riesgo de privacidad inherente al diseño, no un defecto de implementación.

**Propuesta:** documentar la limitación y evitar mesas de un solo votante; si se requiere secreto fuerte, agregar votos por mesa o usar un esquema de privacidad diferencial. No se modificó el modelo.

---

### H-15 — MEDIO — Sin auditoría de acciones administrativas

**Evidencia:** no hay tabla de auditoría ni triggers para apertura/cierre de elección, cambios de candidatos, importaciones o borrados. Solo existe `rate_limit_intentos`, que no registra acciones administrativas.

**Impacto:** ante un incidente electoral no se puede reconstruir quién abrió/cerró la elección, quién importó el padrón ni qué se modificó. Es una carencia relevante para un sistema electoral, aunque añadir auditoría es una función nueva y queda fuera de esta fase.

**Propuesta:** diseñar en una fase posterior una tabla `auditoria` de solo inserción, con actor, acción, timestamp y datos mínimos, protegida por RLS y sin exponer PII innecesaria. No se implementó.

---

### H-16 — CORREGIDO — `logError` registraba `[object Object]`

**Evidencia:** `String(error)` sobre un objeto plano de PostgREST produce `[object Object]`. Se observó en la salida del mock de la Fase 03.1.

**Corrección aplicada:** `describeError()` extrae `message`, `details`, `hint` y `code`; la prueba offline verifica que el log contiene el mensaje y el código, y que no contiene `[object Object]`.

**Impacto:** mejora el diagnóstico de fallos de integración sin cambiar respuestas ni seguridad.

---

### H-17 — BAJO — El header de IP no se valida antes de usarlo como `inet`

**Evidencia:** `extractClientIp()` devuelve cualquier cadena no vacía de `x-forwarded-for` o `x-real-ip`. El valor se pasa como `p_client_ip` a una función cuyo parámetro es `inet`. Un valor como `not-an-ip` provoca un error de conversión en PostgREST/Postgres y el proxy responde 500 en lugar de rechazar la petición o usar una IP segura.

**Impacto:** errores 500 evitables y ruido de diagnóstico; no permite emitir votos ni eludir la autenticación. Combinado con H-02, confirma que la IP no se trata como dato no confiable.

**Propuesta:** validar el formato (IPv4/IPv6) antes de llamar a la RPC y usar un valor de reserva explícito; idealmente, obtener la IP de un header gestionado por la plataforma. Añadir una prueba del handler con un header malformado. No se aplicó en esta fase.

---

## 9. Riesgos residuales y límites de esta auditoría

1. **Ningún control de base de datos fue ejecutado.** RLS, ACL, RPC y concurrencia siguen sin verificación real.
2. **La Edge Function no se ejecutó en Deno/Supabase.** Solo se probó el handler con dobles.
3. **El rate limiting no se probó con `inet`, concurrencia ni ventanas reales.** Su eficacia depende de la IP que reciba y de que la tabla se mantenga.
4. **La confianza en `x-forwarded-for` no se validó en un despliegue real.** H-02 queda abierto hasta comprobarlo.
5. **No se probó la restauración de una base desde cero.** H-04 y H-05 bloquean la reproducibilidad.
6. **No se auditó el frontend con un navegador real en esta fase.** La Fase 03.1 lo hizo con un mock; no sustituye a Supabase.
7. **No se revisaron credenciales reales ni se accedió a producción.** Correcto por restricción, pero implica que la configuración de despliegue no está validada.
8. **No hay auditoría administrativa (H-15) ni retención de rate limiting (H-07).** Son riesgos operativos y de gobernanza, no solo técnicos.

---

## 10. Correcciones propuestas no aplicadas

Ninguna de estas propuestas se ejecutó contra una base de datos:

```sql
-- H-01: fallar cerrado si la configuración no existe
select * into v_conf
from public.configuracion
where id = 1
for share;

if not found then
  raise exception 'Configuración electoral ausente' using errcode = 'P0003';
end if;

if v_conf.eleccion_abierta is not true then
  raise exception 'La elección está cerrada' using errcode = 'P0003';
end if;
```

```sql
-- H-03: cast tolerante por fila
begin
  v_mesa_id := nullif(v_item->>'mesa_id', '')::uuid;
exception
  when invalid_text_representation then
    v_mesa_id := null;
end;
```

```sql
-- H-05: política idempotente
drop policy if exists "admin_full_mesas" on public.mesas;
create policy "admin_full_mesas" on public.mesas
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
```

Antes de aplicar cualquiera de estos cambios se debe:

1. Crear el entorno local de la sección 4.
2. Ejecutar la línea base de pruebas y guardar los resultados.
3. Aplicar el cambio en una migración nueva (no editar una migración ya publicada).
4. Repetir las suites y `tests/security_privileges.sql`.
5. Revisar el diff y no desplegar sin autorización.

---

## 11. Archivos modificados en esta fase

| Archivo | Cambio |
|---|---|
| `webapp/Fase 04 - Auditoria e integracion Supabase.md` | **NUEVO**: este informe |
| `webapp/Cambios nuevos.md` | Entrada de Fase 04, conservando el historial anterior |
| `webapp/supabase/functions/voting-proxy/handler.ts` | `logError` con diagnóstico estructurado |
| `webapp/tests/voting-proxy-handler.test.js` | Regresión del log de errores PostgREST |

No se modificó ningún archivo fuera de `webapp/`. No se crearon tablas, migraciones, políticas ni funciones electorales.

---

## 12. Verificación final de esta fase

| Check | Resultado |
|---|---|
| `npm run build` | **Pasó**; 535 módulos; aviso informativo de chunk JS de 893.43 kB |
| `npm run typecheck` | **Pasó** (`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.edge.json`) |
| `npm run test:offline` | **26/26** pasaron |
| `node --check` de los seis scripts | **Pasó** |
| `git diff --check` | **Pasó** (solo avisos LF/CRLF de Git) |
| Archivos fuera de `webapp/` | **Ninguno** |

---

## 13. Siguiente paso recomendado

1. Instalar Docker Desktop y verificar `docker version`.
2. Ejecutar `npx supabase@latest init` y `npx supabase@latest start` dentro de `webapp/`.
3. Completar `.env.test` con las claves locales de `supabase status`.
4. Aplicar `schema.sql` y las migraciones `001`–`004` en orden.
5. Ejecutar `tests/security_privileges.sql` y las tres suites de integración en serie.
6. Servir `voting-proxy` y repetir `tests/voting.test.js` contra el runtime real.
7. Registrar los resultados reales en una nueva fase antes de proponer cambios de esquema o declarar el sistema listo.

No se inicia la Fase 05. No se hace commit, push, despliegue ni migración en esta fase.
