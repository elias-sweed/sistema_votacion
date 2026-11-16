# Fase 02.2 — Correcciones de seguridad

## Alcance

Correcciones posteriores a la revisión de las migraciones 001-003. Esta fase no implementa el kiosco ni funcionalidades de la Fase 03. No se han ejecutado pruebas de base de datos todavía; los resultados de verificación se documentarán solo después de correrlas en Supabase local.

## Hallazgos y correcciones

### 1. RPC de votación y rate limiting

- Las funciones base `verificar_votante(text)` y `emitir_voto(text, uuid)` ya no tienen `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ni `service_role`; se revocan también los permisos EXECUTE previos en el esquema `public`.
- Las funciones limitadas `verificar_votante_con_limite(...)` y `emitir_voto_con_limite(...)` solo pueden ejecutarse como `service_role`. El flujo backend existente en `supabase/functions/voting-proxy/index.ts` usa esa clave en el servidor y conserva las llamadas a los wrappers.
- No se agregó ni se expuso la `service_role key` al frontend.
- Se retiró el `GRANT EXECUTE ON ALL FUNCTIONS` a `authenticated`. Las RPC administrativas del padrón reciben concesiones explícitas y mantienen su validación interna de administrador.

### 2. Control de administrador

`is_app_admin()` evalúa los claims firmados del JWT: `app_metadata.role = 'admin'` o `role = 'service_role'`. Se reemplaza el `COALESCE` que no expresaba OR y se elimina la comprobación de `current_user`, que no identifica al solicitante al entrar en una función `SECURITY DEFINER`. `app_metadata` no es modificable por el usuario autenticado; la asignación administrativa debe realizarse desde un canal de administración confiable.

### 3. Privilegios de tablas, RLS y resultados

- Se quita el `GRANT ALL` a `authenticated`: además de DML, permitía `TRUNCATE`, que no está filtrado por RLS. Se conceden solo privilegios DML necesarios, con las políticas RLS como control de filas; `votos` queda solo lectura para `authenticated`.
- Se conserva `SELECT` de `anon` en `candidatos`; la política RLS existente limita la lectura a candidatos activos.
- La vista `resultados` se configura con `security_invoker = true`, aplica las políticas RLS de sus tablas base, niega `SELECT` a `anon` y permite consulta a `authenticated` únicamente cuando esas políticas autorizan sus filas.
- `tests/security_privileges.sql` comprueba ACL de funciones, ausencia de `TRUNCATE`, accesos de la vista y `security_invoker`.

### 4. Migraciones e instalación

No se reescribieron las migraciones antiguas.

- **Base existente** con `schema.sql` y migraciones 001, 002 y 003 aplicadas: aplicar una sola vez `supabase/migrations/004_security_fixes.sql`.
- **Instalación limpia**: aplicar en orden `supabase/schema.sql`, migraciones 001, 002, 003 y 004. El esquema base también se dejó con políticas administrativas condicionadas por JWT, sin `EXECUTE` anon sobre las RPC base y con la vista como `security_invoker`.
- No reaplicar `schema.sql` sobre una base ya inicializada. Revisar el SQL de la migración antes de aplicarlo y conservar el procedimiento habitual de backup.

## Pruebas añadidas

`tests/security.test.js` comprueba acceso anon, usuario autenticado normal, usuario admin con `app_metadata`, intento de falsificar el rol mediante `user_metadata`, las llamadas RPC directas y wrappers, padrón, vista de resultados, rate limit y votos duplicados/concurrentes por el flujo backend con `service_role`.

`tests/fase2.test.js` amplía el control de acceso de padrón para anon, usuario normal y usuario admin. Ambos scripts rechazan una URL de base que no sea local, crean identificadores de fixture únicos y limpian solo sus propias filas para evitar tocar datos ajenos. La suite de seguridad restaura el estado previo de apertura de la elección.

Para ejecutar las pruebas de integración:

1. Iniciar Supabase local con Docker.
2. Configurar `.env.test` con la URL `localhost` y las claves locales impresas por Supabase; no utilizar claves reales.
3. Aplicar `schema.sql` y las migraciones en orden, incluyendo la nueva 004.
4. Ejecutar desde `webapp/`: `node tests/security.test.js` y `node tests/fase2.test.js`.
5. Ejecutar las aserciones SQL contra la misma base local con `psql "<DATABASE_URL local>" -v ON_ERROR_STOP=1 -f tests/security_privileges.sql`.

La suite JS de seguridad llama directamente a los wrappers como backend de confianza y confirma que clientes web no pueden invocarlos; no sustituye una prueba de despliegue HTTP real de la Edge Function.

## Riesgos y límites pendientes

- Debe validarse la migración sobre una instancia Supabase local compatible con `security_invoker` (PostgreSQL 15+).
- No se verificó en un despliegue que el gateway sanee el header IP usado por `voting-proxy`; un `x-forwarded-for` controlable por el cliente puede debilitar el rate limiting. Antes de producción, verificar qué header entrega el proxy de confianza y rechazar o ignorar valores aportados por el cliente.
- Los tokens con claim de administrador pueden seguir autorizando hasta expirar tras revocar el rol. Definir el procedimiento operacional de revocación/sesiones antes del uso real.
- No se verificó el despliegue ni la configuración de secretos de la Edge Function. La clave `service_role` debe permanecer exclusivamente en secretos del backend.
- Los resultados agregados se protegen por RLS; el momento en que se habilita el acceso a administradores debe definirse conforme al reglamento electoral.
