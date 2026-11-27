# Fase 03.1 — Verificación integral del kiosco electoral

**Fecha:** 2026-10-27  
**Rama:** `migracion-react` (sin commits ni despliegues)  
**Alcance:** auditoría y estabilización de la Fase 03 dentro de `webapp/`. No se añadieron funciones electorales nuevas, migraciones, resultados, actas ni reglas de negocio.

---

## 1. Objetivo

Comprobar de punta a punta el kiosco `/votar` implementado en la Fase 03, corregir defectos reproducibles y dejar constancia de qué se verificó realmente y qué sigue pendiente. La revisión se apoyó en los documentos de Fase 02.1, 02.2 y 03, pero no asumió sus conclusiones como prueba.

---

## 2. Entorno real de verificación

| Recurso | Estado |
|---|---|
| Node.js | v24.14.1 |
| npm | 11.11.0 |
| Docker | No disponible |
| Supabase CLI | No disponible |
| `psql` | No disponible |
| Deno | No disponible |
| `webapp/.env.test` | No existe |
| Navegador integrado | Disponible (Chromium) |

Con este entorno fue posible verificar el frontend real, el handler del proxy y el build. **No fue posible** ejecutar Postgres, RLS, las RPC ni la Edge Function dentro de Deno/Supabase.

---

## 3. Defectos encontrados y correcciones

### 3.1 Crítico: la acción `candidatos` era inalcanzable

**Hallazgo:** en `voting-proxy/index.ts`, el bloque `if (body.action === "candidatos")` estaba anidado dentro de la rama `if (body.action === "estado")`. Como `"candidatos"` nunca es igual a `"estado"`, la petición caía siempre en `"Acción no válida"`. El kiosco no podía cargar opciones y, por tanto, no podía iniciar la votación.

**Corrección:** la lógica HTTP se movió a `supabase/functions/voting-proxy/handler.ts` con ramas hermanas para `estado`, `candidatos`, `verificar` y `votar`. `index.ts` quedó como entrada delgada de Deno que inyecta el cliente Supabase.

**Regresión cubierta:** `tests/voting-static.test.js` comprueba que `candidatos` no está anidado en `estado`; `tests/voting-proxy-handler.test.js` ejecuta la acción y verifica que solo devuelve candidatos activos y los campos `id`, `nombre`, `foto_url`.

### 3.2 Alto: un DNI inexistente se mostraba como “respuesta inválida”

**Hallazgo:** cuando la RPC no devolvía filas, el proxy respondía sin el campo `nombre`. El servicio del frontend exigía que `nombre` fuera string y clasificaba la respuesta como inválida, en lugar de informar que no existía habilitación para ese DNI.

**Corrección:** el proxy devuelve siempre `nombre: null` y un campo explícito `existe`; el servicio valida `data.nombre != null` y usa `existe` para distinguir “no encontrado” de una respuesta malformada. También se mapea `P0001` a un error de identificación de sesión.

**Regresión cubierta:** pruebas del handler para DNI inexistente, DNI ya votado, rate limit y respuesta malformada; prueba estática de `nombre: null`.

### 3.3 Medio: pantallas terminales sin salida controlada

**Hallazgo:** después de un voto exitoso o de una respuesta ambigua no había un control explícito para preparar el kiosco para el siguiente votante o para que el personal reanudara el flujo.

**Corrección:** se añadieron botones de reinicio en las pantallas de éxito y de respuesta ambigua. El reinicio limpia DNI, nombre, selección y mensajes, recarga estado/candidatos y **no reenvía el voto**. En la pantalla ambigua el texto indica expresamente que el personal debe verificar el estado antes de continuar.

### 3.4 Medio: `npx tsc --noEmit` no comprobaba el código

**Hallazgo:** el `tsconfig.json` raíz es un archivo de solución con `"files": []` y referencias a `tsconfig.app.json` y `tsconfig.node.json`. Ejecutar `npx tsc --noEmit` sin `-b` no compila los proyectos referenciados: termina con código 0 aunque haya errores en `src/`. La Fase 03 documentó ese comando como “Pasó”, pero no era una verificación real del frontend.

**Corrección:** se añadió el script `npm run typecheck`, que comprueba explícitamente la app, la configuración de Vite/Node y el handler del Edge Function mediante `tsconfig.edge.json`. El build sigue usando `tsc -b`, que sí compila las referencias.

### 3.5 Baja: artefactos locales de prueba podían versionarse

**Corrección:** `.gitignore` incluye `.env.test` y `.env.*.local`, además de las entradas previas. No se añadieron credenciales ni secretos.

### 3.6 Doble envío: verificado, no reproducido

El guard `submittingRef` y el estado `submitting` bloquean el segundo clic antes de cualquier petición. En la prueba real de doble clic se observó **una sola** petición `votar` y una sola pantalla de éxito. No se cambió este mecanismo; se dejó cubierto por la verificación manual y por la protección transaccional existente del servidor.

---

## 4. Archivos creados y modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `webapp/supabase/functions/voting-proxy/handler.ts` | **NUEVO** | Lógica HTTP testeable; rutas hermanas, validación, respuestas explícitas y errores controlados |
| `webapp/supabase/functions/voting-proxy/index.ts` | Modificado | Entrada Deno delgada; inyecta el cliente Supabase en `handleProxyRequest` |
| `webapp/src/features/voting/votingService.ts` | Modificado | Validación de `nombre` nulo, `existe`, mapeo de `P0001` y errores de voto |
| `webapp/src/features/voting/VotingKioskPage.tsx` | Modificado | Reinicio controlado en éxito/ambiguo; flujo y limpieza de identidad |
| `webapp/tests/voting-proxy-handler.test.js` | **NUEVO** | 18 pruebas del handler con Supabase simulado |
| `webapp/tests/voting-static.test.js` | Modificado | 7 pruebas estáticas, incluida la regresión de `candidatos` |
| `webapp/tests/manual-kiosk-mock-server.mjs` | **NUEVO** | Backend de fixtures local para prueba manual en navegador; no usa Supabase |
| `webapp/package.json` | Modificado | Scripts `typecheck` y `test:offline` |
| `webapp/tsconfig.edge.json` | **NUEVO** | Typecheck del handler del Edge Function |
| `webapp/.gitignore` | Modificado | Ignora `.env.test` y `.env.*.local` |

No se modificaron migraciones, `schema.sql`, RLS ni permisos. No se creó ninguna migración nueva.

---

## 5. Pruebas automatizadas ejecutadas

| Comando | Resultado real |
|---|---|
| `npm run build` | **Pasó**. 535 módulos; `dist/assets/index-*.js` = 893.43 kB (aviso de chunk > 500 kB). |
| `npm run typecheck` | **Pasó**. `tsconfig.app.json`, `tsconfig.node.json` y `tsconfig.edge.json` sin errores. |
| `npm run test:offline` | **Pasó: 25/25**. 18 pruebas del handler + 7 pruebas estáticas. |
| `node --check` sobre `voting-static.test.js`, `voting-proxy-handler.test.js`, `voting.test.js`, `security.test.js`, `fase2.test.js` y `manual-kiosk-mock-server.mjs` | **Pasó** en los seis archivos. |
| `git diff --check` | **Pasó**. Solo avisos de Git sobre conversión LF→CRLF; sin errores de espacio. |
| `node tests/voting.test.js` | **Bloqueado**. `Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.test` (código 1). |
| `node tests/security.test.js` | **Bloqueado** por la misma causa. |
| `node tests/fase2.test.js` | **Bloqueado** por la misma causa. |
| `tests/security_privileges.sql` | **No ejecutado**: no hay `psql` ni base local. |

`node --test` requiere Node con soporte de ejecución directa de TypeScript (el entorno usó Node 24). No se declaran aprobadas las suites de integración.

---

## 6. Verificación manual en navegador real

**Método:** Vite en `http://127.0.0.1:5173` con `VITE_SUPABASE_URL=http://127.0.0.1:8787` y una clave anónima ficticia, contra `tests/manual-kiosk-mock-server.mjs`. Ese servidor reutiliza el handler real del proxy y un cliente Supabase simulado. **No sustituye** una prueba contra Supabase/Postgres: no valida RLS, transacciones, `SECURITY DEFINER`, rate limiting real ni la Edge Function desplegada.

| Caso | Resultado observado |
|---|---|
| Carga inicial de `/votar` | Pasó. Mostró título y solo Lista A/Lista B; Lista C inactiva quedó excluida. |
| DNI válido `12345678` | Pasó. Mostró confirmación de identidad con “Ana Torres”. |
| DNI inexistente | Pasó. Mostró “No encontramos una habilitación de voto para esos datos”. |
| DNI ya votado `22222222` | Pasó. Mostró que el votante ya emitió su voto. |
| Rate limit de verificación | Pasó. Mostró el mensaje de límite de intentos. |
| Elección cerrada | Pasó. Mostró “La votación está cerrada” y no permitió iniciar. |
| Doble clic en “Confirmar y emitir voto” | Pasó. Se envió exactamente **una** petición `votar`; se mostró la pantalla de éxito. |
| Respuesta perdida después de registrar el voto | Pasó. Se mostró la pantalla ambigua; una verificación posterior confirmó `haVotado: true` para ese DNI. |
| Fallo de red real durante el envío | Pasó. Se detuvo el servidor de fixtures antes de confirmar; la pantalla ambigua apareció y, tras reiniciar el servidor, `/__control/state` mostró `haVotado: false`: **no se registró voto**. |
| Reinicio desde éxito/ambiguo | Pasó. Volvió al paso de DNI y recargó estado/candidatos sin reenviar el voto. |
| `/` sin sesión | Pasó. Redirigió a `/login` y mostró el formulario de acceso restringido. |
| `/` con sesión no admin | No ejecutado con autenticación real; el guard de cliente redirige a `/votar`, pero la autorización efectiva sigue dependiendo de RLS/RPC. |
| Login/panel admin real | No ejecutado: no hay usuario ni proyecto Supabase local. |

La prueba de doble clic y la de respuesta ambigua se hicieron con controles del servidor de fixtures (`/__control/state`, `/__control/fail-next-vote-after-record`, `/__control/rate-limit-next-verify`, `/__control/close`). El fallo de red se provocó deteniendo el proceso, no simulándolo en el cliente.

### Reproducción

```bash
cd webapp
node tests/manual-kiosk-mock-server.mjs
# En otra terminal:
VITE_SUPABASE_URL=http://127.0.0.1:8787 VITE_SUPABASE_ANON_KEY=local-test-anon npm run dev
# Abrir http://127.0.0.1:5173/votar
```

El servidor de fixtures imprime los DNI habilitados y los controles disponibles. Es solo para desarrollo local; no debe desplegarse.

---

## 7. Pruebas pendientes y motivos

| Pendiente | Motivo | Qué falta para ejecutarla |
|---|---|---|
| `tests/voting.test.js` | Falta `.env.test` y un Supabase local | Docker/CLI, `supabase start`, migraciones 001–004 y variables locales |
| `tests/security.test.js` | Igual | Igual |
| `tests/fase2.test.js` | Igual | Igual |
| `tests/security_privileges.sql` | No hay `psql` ni base | Cliente PostgreSQL y base local |
| Edge Function en Deno | No hay Deno ni Supabase CLI | `supabase functions serve` o despliegue en proyecto de prueba |
| Rate limiting real por IP | El mock no valida `rate_limit_intentos` ni la IP de plataforma | Prueba de integración con la función desplegada |
| Login/panel admin | No hay credenciales ni Auth local | Usuario con `app_metadata.role = 'admin'` |
| PWA/offline, resultados, acta | Fuera del alcance de Fase 03.1 | Fases posteriores |

---

## 8. Riesgos y observaciones

1. **La verificación de interfaz no prueba la base de datos.** El mock reutiliza el handler real, pero no RLS, transacciones, permisos ni la Edge Function en Deno. No debe declararse el sistema listo para producción hasta ejecutar las suites de integración en un entorno real.
2. **CORS del proxy.** El handler responde con `Access-Control-Allow-Origin: *`. Es el comportamiento previo y permite que cualquier origen llame al kiosco público. Antes de producción conviene restringirlo al origen del kiosco en la configuración de despliegue; no se cambió en esta fase para no alterar el contrato sin probarlo contra el entorno real.
3. **Rate limiting dependiente de la IP.** El proxy confía en `x-forwarded-for`/`x-real-ip`. Hay que confirmar en el proveedor desplegado que esos encabezados no puedan falsificarse y que la IP corresponda al cliente.
4. **Envío ambiguo.** No existe clave de idempotencia de extremo a extremo. La interfaz no reenvía automáticamente y el servidor bloquea el segundo voto, pero el personal debe verificar el estado cuando la respuesta se pierde. Es el comportamiento documentado, no una confirmación de éxito.
5. **Guard de rutas solo en cliente.** `/` redirige según la sesión, pero la seguridad efectiva del panel sigue en RLS y en las verificaciones `is_app_admin()` de las RPC. No se ampliaron permisos.
6. **Scripts de desarrollo.** `manual-kiosk-mock-server.mjs` y `tsconfig.edge.json` son artefactos de verificación; el primero no debe incluirse en un despliegue.

---

## 9. Conclusión

- **Funciona y fue verificado en navegador real (con backend de fixtures):** carga de estado y candidatos activos, verificación de DNI, rechazo de DNI inexistente/ya votado, rate limit mostrado, elección cerrada, selección única, doble clic bloqueado, éxito, respuesta ambigua, fallo de red sin voto registrado y reinicio controlado.
- **Corregido:** rama `candidatos` inalcanzable (crítico), DNI inexistente tratado como respuesta inválida, falta de salida en pantallas terminales, typecheck engañoso y artefactos `.env` no ignorados.
- **Automatizado y aprobado:** build, typecheck (app + node + edge) y 25/25 pruebas offline.
- **Pendiente y bloqueado:** todas las pruebas contra Supabase/Postgres/Deno, RLS, transacciones, rate limiting real, login admin y despliegue.

**Estado:** Fase 03.1 completada en el nivel verificable de este entorno. El kiosco es funcional y está listo para continuar el desarrollo, pero **no está verificado para producción** hasta ejecutar las suites de integración reales.
