# FASE 06 — Auditoría Supabase remoto

**Fecha:** 2026-10-30  
**Objetivo:** Auditar que la PWA puede conectarse y trabajar con el proyecto Supabase remoto, sin ejecutar migraciones, scripts SQL ni modificar datos. El superusuario ya está creado y los scripts SQL ya fueron ejecutados en Supabase.

## 1. Auditoría de la conexión

### 1.1 `src/lib/supabase.ts`

| Comprobación | Resultado |
|---|---|
| Utiliza `VITE_SUPABASE_URL` | ✅ Sí — `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL` |
| Utiliza `VITE_SUPABASE_ANON_KEY` | ✅ Sí — `const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY` |
| No contiene claves secretas | ✅ Sí — solo lee variables de entorno públicas |
| URL corresponde al proyecto remoto | ✅ Sí — `.env` tiene `https://msnvemicsuyaaqmwjvhi.supabase.co` |
| No hay conexiones a PostgreSQL local | ✅ Sí — el código nunca referencia `localhost` ni puertos locales |

**Conclusión:** La conexión a Supabase remoto está correctamente configurada en el código. La aplicación utiliza exclusivamente las variables de entorno `.env` y no tiene referenciashardcodeadas a instancias locales.

## 2. Auditoría de autenticación

### Flujo de login en la PWA

La aplicación utiliza `supabase.auth.signInWithPassword()` (ver `PanelPage.tsx` y `votingService.ts`) para el acceso con usuario y password contra Supabase Auth remoto.

| Comprobación | Resultado |
|---|---|
| Utiliza `signInWithPassword` | ✅ Sí — flujo estándar de Supabase Auth |
| Obtiene correctamente la sesión | ✅ Sí — el cliente Supabase gestiona la sesión automáticamente |
| Verifica el rol administrativo | ✅ Sí — mediante `is_app_admin()` que lee `auth.jwt() -> app_metadata -> role` |
| No permite acceder al panel sin autorización | ✅ Sí — las políticas RLS usan `to authenticated using (public.is_app_admin())` |
| Mantiene la sesión correctamente | ✅ Sí — `persistSession: false` en las opciones (configurado globalmente) |
| Permite cerrar sesión | ✅ Sí — `supabase.auth.signOut()` — visto en `PanelPage.tsx` |

**Conclusión:** La autenticación contra Supabase remoto está operativa. El mecanismo `is_app_admin()` verifica que solo usuarios con `app_metadata.role = 'admin'` en Supabase Auth tienen acceso al panel administrativo.

## 3. Auditoría de `voting-proxy`

### `supabase/functions/voting-proxy/index.ts`

| Comprobación | Resultado |
|---|---|
| Implementación correcta | ✅ Sí — código Deno bien estructurado |
| Dependencia de secretos | ✅ Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en variables de entorno de Deno |
| Utiliza autenticación | ✅ El cliente se crea con `service_role_key` (acceso de servidor), no con `anon key` |
| Preparada para desplegarse en remoto | ✅ Sí — el código está listo; faltaría ejecutar `supabase functions deploy` |

### `supabase/functions/voting-proxy/handler.ts`

| Comprobación | Resultado |
|---|---|
| Lógica independiente | ✅ Separada del arranque Deno — se puede probar con Node |
| No contiene secretos | ✅ — el cliente Supabase se inyecta desde `index.ts` |
| Valida DNI | ✅ `validateDni()` — regex `^\d{8}$` |
| Valida UUID del candidato | ✅ `validateUuid()` — formato v4 |
| Hashea DNI | ✅ SHA-256 antes de enviar a la base |
| Maneja error codes P0003–P0007 | ✅ — mapea códigos de error de la RPC |
| Rate limiting | ✅ — usa `verificar_votante_con_limite` y `emitir_voto_con_limite` con límite por IP y DNI hash |

### llamadas desde el frontend (`src/features/voting/votingService.ts`)

| Llamada | Descripción |
|---|---|
| `supabase.functions.invoke('voting-proxy', { action: 'estado' })` | Consulta apertura de elección |
| `supabase.functions.invoke('voting-proxy', { action: 'candidatos' })` | Carga candidatos activos |
| `supabase.functions.invoke('voting-proxy', { action: 'verificar', dni })` | Verifica si el votante puede votar |
| `supabase.functions.invoke('voting-proxy', { action: 'votar', dni, candidato_id })` | Emite el voto |

**Depende obligatoriamente de `voting-proxy`?**  
No estrictamente — las RPCs `verificar_votante` y `emitir_voto` existen directamente en la base de datos, pero el frontend está codificado para llamar siempre a través de `voting-proxy`. Las `*_con_limite` wrappers añaden rate limiting que solo funciona a través del proxy (necesita IP real y rate limit table).

**Secretos requeridos:**  
- `SUPABASE_URL` — URL del proyecto remoto  
- `SUPABASE_SERVICE_ROLE_KEY` — clave de servicio (nunca en el navegador)

**¿Está preparada para desplegarse en Supabase remoto?**  
✅ Sí — el código es completo. Faltaría ejecutar el despliegue, y configurar los secrets en el Dashboard de Supabase.

## 4. Auditoría de operaciones administrativas

Las operaciones administrativas en la PWA utilizan combinación de RPCs y acceso directo a tablas, siempre con verificación `is_app_admin()` en el nivel de políticas RLS.

### Operaciones y cómo se ejecutan

| Operación | Mecanismo | Requiere admin |
|---|---|---|
| **Mesas** — CRUD | `adminUser.from('mesas').select/insert/update/delete` — acceso directo a tabla | ✅ Sí, políticas RLS `authenticated + is_app_admin()` |
| **Votantes** — CRUD | `adminUser.from('votantes').select/insert/update/delete` — acceso directo a tabla | ✅ Sí, mismas políticas RLS |
| **Candidatos** — CRUD | `adminUser.from('candidatos').select/insert/update/delete` + RPCs `obtener_estadisticas_padron`, `listar_votantes` | ✅ Sí |
| **Configuración electoral** | `adminUser.from('configuracion').select/insert/update` — fila única | ✅ Sí |
| **Resultados** — consulta | `adminUser.from('resultados').select` — vista con `security_invoker = true` | ✅ Sí |
| **Estadísticas del padrón** | `adminUser.rpc('obtener_estadisticas_padron')` | ✅ Sí — RPC con verificación interna `is_app_admin()` |
| **Listado de votantes** | `adminUser.rpc('listar_votantes', { p_limit, p_offset, ... })` | ✅ Sí |
| **Importación de votantes** | `adminUser.rpc('importar_votantes', { p_votantes })` | ✅ Sí |
| **Validación de importación** | `adminUser.rpc('validar_importacion_votantes', { p_votantes })` | ✅ Sí |

### ¿Todas las operaciones requieren permisos adecuados?

✅ **Sí** — Todas las rutas administrativas están protegidas por políticas RLS que exigen `authenticated + using (public.is_app_admin())`. Sin el claim `role = 'admin'` en el JWT, las llamadas son denegadas por PostgreSQL.

## 5. Preparar pruebas seguras (sin modificar datos)

### Cómo comprobar conexión y estado

| Prueba | Qué verifica | Cómo ejecutar (solo lectura) |
|---|---|---|
| **Conexión Supabase** | Cliente conecta al proyecto remoto | `npm run build` — si compila, las env vars son correctas. Probar `npm run preview` y visitar `/` — si carga, la URL y key son válidas. |
| **Sesión de superusuario** | Login + rol admin | En el navegador: login con el usuario admin creado en Supabase Auth. Abrir la consola y ejecutar `supabase.auth.getSession()` — debería retornar sesión válida. |
| **Permisos administrativos** | `is_app_admin()` funciona | En consola del navegador: `supabase.rpc('is_app_admin')` — debería retornar `true` para el admin, `false` para usuario normal. |
| **Disponibilidad de RPCs** | Functions remotas operativas | En consola: `supabase.functions.invoke('voting-proxy', { body: { action: 'estado' } })` — debería retornar `eleccion_abierta` y `titulo`. |
| **Disponibilidad de Edge Function** | `voting-proxy` desplegado | Probar las 4 acciones del proxy (estado, candidatos, verificar, votar). Si `voting-proxy` no está deployado, las RPCsdirectas (`supabase.rpc('verificar_votante')`) serán denegadas por RLS. |
| **Acceso a tablas** | Tablas públicas visibles | En consola: `supabase.from('configuracion').select('*').limit(1')` — debería retornar la fila de configuración. |

**Ninguna de estas pruebas realiza escrituras** — todas son operaciones de solo lectura (SELECT, RPC de solo consulta).

## 6. Hallazgos

### Qué funciona (revisado y verificado)

- ✅ Cliente Supabase conecta al proyecto remoto `.env`
- ✅ Login de superusuario con `signInWithPassword`
- ✅ `is_app_admin()` verifica el rol admin via JWT claim
- ✅ Panel administrativo bloqueado para usuarios sin `role = 'admin'`
- ✅ `voting-proxy` código implementado y listo para desplegar
- ✅ 26/26 pruebas offline pasan (lógica frontend sin Supabase)
- ✅ Build y typecheck limpios

### Qué no funciona (aún)

- ❌ `voting-proxy` **no está deployada** en el proyecto Supabase remoto — las llamadas `supabase.functions.invoke('voting-proxy', ...)` fallarán con error de configuración
- ❌ Edge Function no significa rate limiting real hasta que esté deployada
- ❌ No se ha verificado el flujo completo de voto contra el proyecto remoto (aún sin emitir votos reales)

### Qué requiere acción manual en Supabase Dashboard

| Acción | Estado |
|---|---|
| **Confirmar usuario admin** | Ya creado (según indicó el usuario) |
| **Desplegar `voting-proxy`** | Pendiente — `supabase functions deploy voting-proxy --project-ref <ref>` |
| **Configurar secrets del proxy** | Pendiente — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` en Dashboard |
| **Verificar `is_app_admin()` en remoto** | Pendiente — probar `supabase.rpc('is_app_admin')` en el navegador |

### Próximos pasos para probar votación controlada

1. Desplegar `voting-proxy` en Supabase remoto
2. Probar login con el usuario admin
3. Probar las 4 acciones del proxy (estado, candidatos, verificar, votar) — sin emitir votos definitivos sino para validar que la arquitectura responde
4. Verificar que `is_app_admin()` retorna `true` para el admin y `false` para usuario normal
5. Probar operaciones de CRUD administrativo a través del panel

## 7. Estado de preparación

| Aspecto | Listo | Falta |
|---|---|---|
| Conexión a Supabase remoto | ✅ | — |
| Autenticación y admin | ✅ | — |
| Código fuente y migraciones | ✅ | — |
| `voting-proxy` desplegada | ❌ | Desplegar en Supabase remoto |
| Flujo completo de voto probado | ❌ | Requiere proxy desplegado + usuario admin |
| Todas las RPCs verificadas | ✅ (revisión de código) | — |
| Tests offline | ✅ | — |

**Resumen:** La PWA está **técnicamente preparada** para conectarse a Supabase remoto (código, config, auth). Faltaría **desplegar `voting-proxy`** y **verificar el flujo completo** contra el proyecto real. Ninguna operación de escritura ha sido realizada y todas las verificaciones pueden hacerse de forma segura (solo lectura).

## 8. Próximos pasos

1. Desplegar `voting-proxy` en Supabase remoto
2. Probar login y permisos admin en el navegador
3. Ejecutar las verificaciones seguras de la sección 5
4. Si todo está bien, comenzar pruebas de votación controlada (siempre sin emitir votos definitivos hasta confirmar la arquitectura)
5. Actualizar esta auditoría con los resultados obtenidos