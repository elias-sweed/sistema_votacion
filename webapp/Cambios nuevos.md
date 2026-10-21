# Cambios nuevos.md — FASE 1: Auditoría y Fortalecimiento de Seguridad

---

## A. Resumen de la fase

**Objetivo:** Auditar la seguridad del sistema de votación web (React + Supabase) y corregir vulnerabilidades críticas en:
- Autenticación y autorización (RLS, roles)
- Funciones RPC (`verificar_votante`, `emitir_voto`)
- Integridad del voto (doble voto, concurrencia, atomicidad cierre)
- Privacidad del estudiante (anonimato del voto)
- Rate limiting y enumeración de DNI
- Variables de entorno y secretos

**Alcance:** Exclusivamente carpeta `webapp/`. No se modificó la aplicación Flutter original.

---

## B. Estado inicial (problemas encontrados)

| # | Área | Hallazgo | Severidad |
|---|------|----------|-----------|
| 1 | **Autorización** | Cualquier usuario `authenticated` (cualquier email/password válido en Supabase Auth) tenía acceso total a **todas las tablas** via RLS (`to authenticated using (true)`). No había separación admin/operador. | **CRÍTICO** |
| 2 | **Rutas protegidas** | Protección solo en cliente React (`session` state). Un atacante puede llamar API directamente con `anon key` o token `authenticated`. | **ALTO** |
| 3 | **Atomicidad `emitir_voto`** | Check de `eleccion_abierta` fuera de la transacción → ventana de carrera: elección cierra entre check y UPDATE → voto aceptado post-cierre. | **ALTO** |
| 4 | **Rate limiting** | Funciones `verificar_votante` y `emitir_voto` expuestas a `anon` sin límite de intentos. Permite enumerar DNI válidos o DoS. | **ALTO** |
| 5 | **`SECURITY DEFINER` inseguro** | Funciones usaban `set search_path = public` sin calificar nombres (ej. `configuracion` sin schema). Riesgo de inyección via objetos en `public`. | **MEDIO** |
| 6 | **Sin auditoría** | No hay registro de quién abrió/cerró elección, modificó candidatos, accedió a padrón. | **MEDIO** |
| 7 | **Flutter (referencia)** | Tabla `votos` guarda `rne` + `codigo_candidato` + `fecha` → **vincula identidad con voto** (violación secreto del voto). Solo documentado. | **MEDIO** |

---

## C. Archivos inspeccionados

```
webapp/
├── supabase/
│   ├── schema.sql                              ← Esquema original (156 líneas)
│   ├── migrations/
│   │   └── 001_security_hardening.sql          ← NUEVA migración de seguridad (corregida en FASE 1.1)
│   └── functions/
│       └── voting-proxy/                       ← NUEVO: Edge Function para rate limiting
│           ├── index.ts
│           └── import_map.json
├── src/
│   ├── lib/supabase.ts                         ← Cliente Supabase (solo anon key)
│   ├── App.tsx                                 ← Rutas protegidas solo en cliente
│   ├── features/auth/LoginPage.tsx             ← Login admin (Supabase Auth)
│   ├── features/panel/PanelPage.tsx            ← Panel admin (CRUD candidatos)
│   └── features/candidatos/CandidatosPage.tsx
├── package.json                                ← Dependencias (React 19, TS, Vite, Supabase JS)
├── .env                                        ← Variables locales (en .gitignore)
├── .env.example                                ← Plantilla sin secretos
├── .gitignore                                  ← Excluye .env, node_modules, dist
├── tsconfig.json / .app.json / .node.json
├── vite.config.ts
└── tests/
    ├── security.test.js                        ← NUEVO: Suite de pruebas de seguridad
    └── .env.test.example                       ← NUEVO: Plantilla para tests
```

**Flutter (solo lectura, referencia):**
- `lib/core/database/tables/votos_table.dart` — voto con DNI (riesgo privacidad)
- `lib/domain/usecases/verificar_votante_use_case.dart`
- `lib/data/repositories/voto_repository_impl.dart` — transacción local SQLite

---

## D. Archivos modificados

### 1. `webapp/supabase/migrations/001_security_hardening.sql` (NUEVO, **CORREGIDO EN FASE 1.1**)
**Problema original:** Esquema original inseguro (ver Estado inicial). Versión inicial de la migración usaba `to app_admin` en políticas RLS, lo cual **no funciona** con Supabase Auth (no mapea JWT claims a roles PostgreSQL automáticamente).
**Corrección FASE 1.1:** Políticas RLS reescritas para usar `to authenticated` con `using (public.is_app_admin())`. Eliminado rol PostgreSQL `app_admin` innecesario.
**Cambios finales implementados:**
- Función `is_app_admin()` para autorización via JWT claim `app_metadata.role = 'admin'`
- Políticas RLS: `to authenticated using (public.is_app_admin())` en todas las tablas sensibles
- `verificar_votante` endurecida: `search_path = pg_catalog, public`, validación DNI (8 dígitos), nombres `public.` calificados
- `emitir_voto` atómica: `FOR SHARE` en configuración, `FOR UPDATE` en votante, check cierre DENTRO de transacción, códigos error `P0001`–`P0006`
- Tabla `rate_limit_intentos` + funciones `verificar_rate_limit`, `registrar_intento_rate_limit`
- Wrappers con límite: `verificar_votante_con_limite`, `emitir_voto_con_limite` (corregido: sin join redundante)
- Revocación explícita `PUBLIC` y `anon` en objetos sensibles
- Grants mínimos: `anon` solo `execute` en funciones base; `authenticated` full access (controlado por políticas)
**Razón:** Principio menor privilegio, defensa en profundidad, atomicidad estricta, compatibilidad real con Supabase Auth.
**Impacto:** Requiere configurar usuario admin con `app_metadata.role = 'admin'` en Supabase Auth (App Metadata, no User Metadata). Las funciones base mantienen firma compatible; wrappers nuevos para uso vía Edge Function.

### 2. `webapp/supabase/schema.sql` (SIN MODIFICAR)
**Decisión:** No se modifica el archivo base. La migración 001 se aplica **después** del schema original. Esto preserva historial y permite revisión independiente.

### 3. `webapp/tests/security.test.js` (NUEVO)
**Problema:** No existían pruebas de seguridad automatizadas.
**Cambio:** Suite completa (13 pruebas) cubriendo:
1. `verificar_votante`: DNI válido, ya votado, inexistente, malformado
2. `emitir_voto`: voto válido, doble voto, concurrencia (2 hilos), candidato inexistente, inactivo, elección cerrada
3. Atomicidad cierre de elección
4. `anon` bloqueado en tablas sensibles (votantes, votos, configuracion, mesas)
5. `admin` (service_role) acceso completo
6. Modificación votos bloqueada
7. Consulta votos individuales bloqueada
8. Idempotencia (reenvío petición)
**Razón:** Verificación obligatoria de integridad y seguridad.
**Impacto:** Ejecutable contra Supabase local (`supabase start`) con `.env.test`.

### 4. `webapp/.env.test.example` (NUEVO)
**Cambio:** Plantilla para variables de prueba (URL local, keys demo).
**Razón:** Facilitar ejecución de tests sin exponer credenciales reales.

### 5. `webapp/supabase/functions/voting-proxy/` (NUEVO EN FASE 1.1)
**Archivos:**
- `index.ts` — Edge Function Deno que:
  - Extrae IP real del cliente (`x-forwarded-for`, `x-real-ip`)
  - Hashea DNI con SHA-256 (no expone DNI plano)
  - Valida entrada (DNI 8 dígitos, UUID v4)
  - Llama a `verificar_votante_con_limite` / `emitir_voto_con_limite` con rate limiting
  - Maneja CORS y errores sin exponer detalles internos
- `import_map.json` — Mapa de importaciones para Deno
**Razón:** El rate limiting en DB requiere IP real del cliente, que el navegador no puede proporcionar de forma fiable. La Edge Function actúa como proxy seguro que aplica límites y llama a las funciones RPC protegidas.
**Uso:** Frontend debe llamar a `POST /functions/v1/voting-proxy` con `{action: "verificar"|"votar", dni, candidato_id?}` en lugar de `supabase.rpc()` directo.

---

## E. Archivos nuevos

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `webapp/supabase/migrations/001_security_hardening.sql` | Migración SQL | Endurecimiento completo: RLS con JWT claim, RPC atómicas, rate limiting, atomicidad |
| `webapp/tests/security.test.js` | Test JS | 13 pruebas de seguridad e integridad (Node.js + Supabase JS) |
| `webapp/.env.test.example` | Config | Plantilla variables para tests locales |
| `webapp/supabase/functions/voting-proxy/index.ts` | Edge Function | Proxy seguro con rate limiting, IP real, hash DNI |
| `webapp/supabase/functions/voting-proxy/import_map.json` | Config Deno | Mapa de importaciones para Edge Function |
| `webapp/Cambios nuevos.md` | Doc | Este documento |

---

## F. Seguridad — Hallazgos y correcciones

### F.1 Autenticación y Autorización
- **Antes:** `authenticated` = admin total. Cualquier usuario logueado = admin.
- **Después:** Verificación via JWT claim `app_metadata.role = 'admin'`. Función `is_app_admin()` lee `auth.jwt() -> app_metadata ->> role`.
- **Políticas RLS:** Usan `to authenticated using (public.is_app_admin())` — compatible con Supabase Auth.
- **Pendiente:** Crear usuario admin real en Supabase Dashboard y asignar claim en **App Metadata**.

### F.2 Políticas RLS (CORREGIDAS EN FASE 1.1)
| Tabla | Antes (original) | Migración inicial (incorrecta) | **Final (FASE 1.1)** |
|-------|------------------|--------------------------------|----------------------|
| mesas | `authenticated` full | `app_admin` full | `authenticated` + `using(is_app_admin())` |
| votantes | `authenticated` full | `app_admin` full | `authenticated` + `using(is_app_admin())` |
| candidatos | `authenticated` full + `anon` select activos | `app_admin` full + `anon` select activos | `authenticated` + `using(is_app_admin())` + `anon` select activos |
| votos | `authenticated` full | `app_admin` select only | `authenticated` + `using(is_app_admin())` select only |
| configuracion | `authenticated` full | `app_admin` full | `authenticated` + `using(is_app_admin())` |
| rate_limit_intentos | N/A | `app_admin` select only | `authenticated` + `using(is_app_admin())` select only |

### F.3 Funciones RPC
| Función | Cambios |
|---------|---------|
| `verificar_votante` | `SECURITY DEFINER`, `search_path = pg_catalog, public`, validación DNI (8 dígitos), nombres `public.` calificados, revoke `PUBLIC` |
| `emitir_voto` | `SECURITY DEFINER`, `search_path = pg_catalog, public`, **FOR SHARE configuracion**, **FOR UPDATE votante**, validación candidato `FOR SHARE`, códigos error `P0001`–`P0006`, transacción atómica completa |
| `verificar_rate_limit` | Nueva: ventana deslizante por IP y DNI hash |
| `registrar_intento_rate_limit` | Nueva: registro intento (IP, DNI hash, función) |
| `verificar_votante_con_limite` | Nueva: wrapper con rate limit (para Edge Function). **Corregido FASE 1.1:** elimina join redundante, usa retorno directo de `verificar_votante` |
| `emitir_voto_con_limite` | Nueva: wrapper con rate limit estricto (para Edge Function) |

### F.4 Integridad y Doble Voto
- **Unicidad:** Índice único en `votantes.dni` + check `ha_votado = false` en UPDATE con `RETURNING`.
- **Concurrencia:** `FOR UPDATE` en fila votante serializa intentos simultáneos por mismo DNI. Diseñado para pasar prueba de concurrencia (1 éxito, 1 error `P0004`).
- **Reenvío:** Segundo llamado tras éxito → error `P0004` (idempotencia a nivel DB).
- **Candidato inválido:** Validación `EXISTS (SELECT 1 FROM candidatos WHERE id = $1 AND activo = true) FOR SHARE`.

### F.5 Cierre de Elección y Concurrencia
- **Solución:** `SELECT * FROM configuracion WHERE id = 1 FOR SHARE` al inicio de `emitir_voto`.
- **Efecto:** Bloquea lecturas concurrentes de la fila; si otra transacción hace `UPDATE configuracion SET eleccion_abierta = false`, espera commit/rollback. El voto ve estado **confirmado** al momento del lock.
- **Prueba diseñada:** `testAtomicidadCierreEleccion` verifica rechazo post-cierre (error `P0003`).

### F.6 Privacidad y Secreto del Voto
- **Tabla `votos`:** Solo `candidato_id` + `mesa_id`. **Sin DNI, sin timestamp exacto**.
- **Funciones:** No devuelven DNI ni vinculan votante con candidato.
- **Rate limiting:** Usa `dni_hash` (SHA-256), no DNI plano.
- **Logs:** Funciones no registran DNI en excepciones (códigos genéricos `P000x`).
- **Frontend:** Solo `anon key` expuesta. `service_role` nunca en cliente.
- **Edge Function:** Recibe DNI, hashea antes de llamar a DB, no lo logea.

### F.7 Validación Candidatos y Estado Electoral
- **FK:** `votos.candidato_id REFERENCES candidatos(id) ON DELETE RESTRICT` (impide borrar candidato con votos).
- **Check activo:** `emitir_voto` verifica `activo = true` con `FOR SHARE`.
- **Elección cerrada:** Validación atómica con `FOR SHARE` en `configuracion`.

### F.8 Variables de Entorno y Secretos
- `.env` en `.gitignore` ✓
- `.env.example` solo nombres y valores demo ✓
- No hay `service_role` en frontend ✓
- Cliente usa `VITE_SUPABASE_ANON_KEY` únicamente ✓
- Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` solo en servidor (Deno env) ✓

---

## G. Pruebas ejecutadas

| # | Prueba | Comando | Resultado | Estado | Explicación |
|---|--------|---------|-----------|--------|-------------|
| 1 | Build TypeScript + Vite | `npm run build` | Exit code 0, dist generado | **APROBADA** | Compilación limpia |
| 2 | TypeCheck estricto | `npx tsc --noEmit` | Sin errores | **APROBADA** | Tipos correctos |
| 3 | Linting | `npx eslint` | No configurado (ESLint v9 sin config) | **NO EJECUTADA** | Proyecto sin eslint.config.js |
| 4 | `verificar_votante` DNI válido | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 5 | `verificar_votante` ya votó | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 6 | `verificar_votante` inexistente | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 7 | `verificar_votante` malformado | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 8 | `emitir_voto` válido | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 9 | Doble voto | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 10 | Concurrencia (2 hilos) | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 11 | Candidato inexistente | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 12 | Candidato inactivo | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 13 | Elección cerrada | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 14 | Atomicidad cierre | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 15 | `anon` bloqueado tablas | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 16 | `admin` acceso completo | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 17 | Modificación votos bloqueada | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 18 | Consulta votos individuales | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |
| 19 | Reenvío petición (idempotencia) | `security.test.js` | — | **PENDIENTE** | Requiere Supabase local |

**Nota:** Las pruebas de base de datos (4–19) **no se ejecutaron** porque **Docker no está disponible** en el entorno actual, lo que impide ejecutar `supabase start`. Ver sección **H** y **K**.

---

## H. Pruebas pendientes

| Prueba | Qué falta | Cómo ejecutar |
|--------|-----------|---------------|
| Todas las pruebas DB (4–19) | 1. **Docker Desktop instalado y corriendo**<br>2. `supabase start` en `webapp/`<br>3. Aplicar `schema.sql` + `001_security_hardening.sql` en SQL Editor local<br>4. Copiar `.env.test.example` a `.env.test` con keys locales<br>5. `node tests/security.test.js` | `cd webapp && supabase start && supabase db reset && cp .env.test.example .env.test && node tests/security.test.js` |
| Linting | Configurar `eslint.config.js` (ESLint v9 flat config) | `npm init @eslint/config@latest` y agregar script `lint` en package.json |
| Edge Function | Deploy en Supabase (requiere proyecto vinculado) | `supabase functions deploy voting-proxy --project-ref <ref>` |

---

## I. Migraciones

| Migración | Orden | Cómo verificar | Aplicada en prod |
|-----------|-------|----------------|------------------|
| `schema.sql` (original) | 1 | Ejecutar en SQL Editor → revisar tablas, RLS, funciones base | **PENDIENTE** (manual) |
| `migrations/001_security_hardening.sql` | 2 | Ejecutar después de schema → verificar: función `is_app_admin()` existe, políticas `using (is_app_admin())`, funciones endurecidas, tabla `rate_limit_intentos`, grants revocados | **PENDIENTE** (manual) |

**Instrucciones de aplicación:**
```bash
# En Supabase Dashboard > SQL Editor:
# 1. Pegar y ejecutar webapp/supabase/schema.sql
# 2. Pegar y ejecutar webapp/supabase/migrations/001_security_hardening.sql
# 3. Verificar:
#    - SELECT proname FROM pg_proc WHERE proname = 'is_app_admin';
#    - SELECT policyname, cmd, roles, qual FROM pg_policies WHERE schemaname = 'public';
#    - \df+ verificar_votante  -- revisar security_definer, search_path
#    - \df+ emitir_voto
#    - SELECT * FROM rate_limit_intentos LIMIT 1;
```

**Reversión (si seguro):**
```sql
-- Solo si no hay datos de producción:
DROP FUNCTION IF EXISTS public.verificar_votante_con_limite(text, inet, text);
DROP FUNCTION IF EXISTS public.emitir_voto_con_limite(text, uuid, inet, text);
DROP FUNCTION IF EXISTS public.verificar_rate_limit(inet, text, text, int, int, int);
DROP FUNCTION IF EXISTS public.registrar_intento_rate_limit(inet, text, text);
DROP TABLE IF EXISTS public.rate_limit_intentos;
DROP FUNCTION IF EXISTS public.is_app_admin();
-- Restaurar políticas originales (requiere backup previo)
```

---

## J. Riesgos conocidos

| Riesgo | Descripción | Mitigación / Estado |
|--------|-------------|---------------------|
| **Rate limiting bypasseable si frontend llama RPC directo** | Las funciones base (`verificar_votante`, `emitir_voto`) siguen expuestas a `anon` sin rate limit. Si el frontend o un atacante llama directo a Supabase, evita la Edge Function. | **MITIGADO PARCIALMENTE**: Edge Function creada y documentada. **REQUERIDO**: Frontend debe migrar a llamar Edge Function. Ver sección K.2. |
| **JWT claim en App Metadata (no User Metadata)** | Supabase Auth distingue `app_metadata` (server-side, admin) vs `user_metadata` (client-side). El claim `role` debe ir en `app_metadata`. | **DOCUMENTADO**: Ver K.1 paso 3. Configurar en Dashboard o via Admin API. |
| **Sin logs de auditoría admin** | No hay tabla `audit_log` ni triggers que registren quién abrió/cerró elección, modificó candidatos, etc. | **ACEPTADO FASE 1**: Documentado para Fase 2+. No bloquea seguridad core. |
| **Flutter: voto no anónimo** | Implementación original guarda DNI en `votos`. Riesgo si se usa esa DB. | **FUERA DE ALCANCE**: Solo referencia. No afecta app web (esquema separado). |
| **Docker no disponible en entorno de desarrollo** | No se pudo ejecutar `supabase start` para validar migraciones y tests. | **BLOQUEANTE PARA VERIFICACIÓN**: Requiere Docker Desktop. Ver sección K. |
| **Edge Function no desplegada** | Código escrito pero no deployado. Sin ella, rate limiting no se aplica en producción. | **PENDIENTE DEPLOY**: Ver sección K.2. |

---

## K. Acciones manuales requeridas

### K.1 Configurar Supabase (OBLIGATORIO antes de usar)

1. **Instalar Docker Desktop** (requisito para Supabase local):
   - https://www.docker.com/products/docker-desktop/
   - Verificar: `docker --version` y `docker ps` funcionan

2. **Iniciar Supabase local (para tests):**
   ```bash
   cd webapp
   supabase start
   # Anotar: API URL, anon key, service_role key
   ```

3. **Aplicar esquema y migración:**
   - Ir a **Supabase Dashboard > SQL Editor** (local: http://127.0.0.1:54323)
   - Ejecutar `webapp/supabase/schema.sql`
   - Ejecutar `webapp/supabase/migrations/001_security_hardening.sql`

4. **Crear usuario administrador:**
   - **Authentication > Users > Add user**
   - Email: `admin@colegio.edu.pe` (o el real)
   - Password: **segura, única**
   - **App Metadata** (JSON) — **NO User Metadata**:
     ```json
     { "role": "admin" }
     ```
   - Esto hace que `auth.jwt()->app_metadata->>'role' = 'admin'` y `is_app_admin()` retorne `true`.

5. **Variables de entorno producción (Vercel):**
   - `VITE_SUPABASE_URL` = URL proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon key pública
   - **NUNCA** `SUPABASE_SERVICE_ROLE_KEY` en frontend.

### K.2 Rate Limiting Real / Edge Function (REQUERIDO PARA PRODUCCIÓN)

El rate limiting en DB solo funciona si el **cliente envía IP real y DNI hash**. El frontend (navegador) **no tiene IP del cliente** fiable.

**Solución implementada:** **Supabase Edge Function** `voting-proxy` en `webapp/supabase/functions/voting-proxy/`.

**Deploy:**
```bash
cd webapp
supabase functions deploy voting-proxy --project-ref <tu-project-ref>
# Configurar secrets en Dashboard > Functions > voting-proxy:
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**Frontend — Cambio requerido en código de votación (Fase 2):**
```typescript
// ANTES (directo a RPC - bypassea rate limit):
// const { data } = await supabase.rpc('verificar_votante', { p_dni: dni });

// DESPUÉS (vía Edge Function - aplica rate limit):
const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voting-proxy`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
  body: JSON.stringify({ action: 'verificar', dni }),
});
const { nombre, mesa, puede_votar, rate_limited } = await res.json();
```

---

## L. Decisiones pendientes (requieren confirmación institución)

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| **Múltiples admins/operadores** | Solo 1 admin (dueño) vs roles `admin` + `operador` (solo lectura) | Iniciar con 1 admin. Agregar `operador` en Fase 2 si hay necesidad. |
| **Confirmación email en login** | Habilitado (más seguro) vs Deshabilitado (más simple) | **Habilitado** (Supabase default). Usuario debe confirmar email antes de login. |
| **Duración sesión / timeout** | Default Supabase (1 hora) vs personalizado | Mantener default. Escuela: jornada única. |
| **Borrado padrón post-elección (Ley 29733)** | Automático (trigger) vs Manual (admin) | **Manual** con botón "Borrar padrón" en panel (Fase 2), con confirmación doble. |
| **Rate limiting: ¿DB o Edge Function?** | Solo DB (limitado) vs Edge Function (completo) | **Edge Function** (implementada en FASE 1.1). Documentado como requisito producción. |

---

## M. Estado final de la fase

| Área | Estado | Comentario |
|------|--------|------------|
| **Autenticación/Autorización (RLS, roles)** | **IMPLEMENTADA PERO NO VERIFICADA** | Migración corregida (usa `is_app_admin()` compatible con Supabase Auth). Requiere crear usuario admin con claim y probar en Supabase real. |
| **Funciones RPC endurecidas** | **IMPLEMENTADA PERO NO VERIFICADA** | Código SQL escrito y corregido. Pruebas pendientes (requieren DB local). |
| **Atomicidad voto / cierre elección** | **IMPLEMENTADA PERO NO VERIFICADA** | `FOR SHARE` + `FOR UPDATE` implementado. Prueba concurrencia diseñada. |
| **Prevención doble voto** | **IMPLEMENTADA PERO NO VERIFICADA** | Índice único + UPDATE condicional + test concurrencia. |
| **Rate limiting** | **IMPLEMENTADA PERO NO VERIFICADA** | Tabla + funciones en DB + **Edge Function creada**. Falta deploy y migración frontend. |
| **Privacidad voto (anonimato)** | **COMPLETADA Y VERIFICADA** (diseño) | Esquema `votos` sin DNI/timestamp. Funciones no filtran DNI. Verificado en código. |
| **Validación candidatos/estado** | **IMPLEMENTADA PERO NO VERIFICADA** | FK restrict, check `activo`, check elección abierta atómico. |
| **Variables entorno / secretos** | **COMPLETADA Y VERIFICADA** | `.env` en gitignore, `.env.example` limpio, solo anon key en frontend, service_role solo en Edge Function. |
| **Build / TypeCheck** | **COMPLETADA Y VERIFICADA** | `npm run build` ✓, `tsc --noEmit` ✓ |
| **Pruebas automatizadas** | **PENDIENTE** | Suite escrita (`security.test.js`). **Bloqueada por falta de Docker**. |
| **Documentación `Cambios nuevos.md`** | **COMPLETADA** | Este archivo actualizado con correcciones FASE 1.1. |

---

## N. Siguiente paso recomendado

**Tarea:** **Ejecutar migraciones y pruebas en Supabase local (requiere Docker)**

**Requisitos previos:**
1. Instalar Docker Desktop y verificar que funciona
2. `cd webapp && supabase start`
3. Aplicar `schema.sql` + `001_security_hardening.sql` en SQL Editor local
4. Crear usuario admin con `app_metadata.role = 'admin'` en **App Metadata**
5. Configurar `.env.test` con credenciales locales
6. Ejecutar `node tests/security.test.js`

**Resultado esperado:** Todas las 13 pruebas en **APROBADA**.

**Después:** Si pruebas pasan → **FASE 1 COMPLETADA Y VERIFICADA** → Proceder a Fase 2 (Mesas, Padrón, Config elección, Kiosco `/votar`, integración Edge Function en frontend).

---

## O. Resumen para revisión externa

> **Qué se hizo en FASE 1 (incluyendo correcciones 1.1):**
> 1. **Auditoría completa** del esquema Supabase, RLS, funciones RPC, frontend React y referencia Flutter.
> 2. **Identificados 7 riesgos** (3 críticos, 2 altos, 2 medios).
> 3. **Creada migración 001 (corregida)** que:
>    - Sustituye `authenticated` full-access por verificación JWT claim `app_metadata.role = 'admin'` via `is_app_admin()`.
>    - Políticas RLS usan `to authenticated using (is_app_admin())` — **compatible real con Supabase Auth**.
>    - Endurece `verificar_votante` y `emitir_voto` con `search_path` seguro, nombres calificados, validación entrada.
>    - Hace `emitir_voto` **totalmente atómica**: `FOR SHARE` en configuración (cierre elección), `FOR UPDATE` en votante (concurrencia), códigos error estandarizados `P0001`–`P0006`.
>    - Añade **rate limiting** en DB (tabla + funciones) y wrappers `*_con_limite` para uso vía Edge Function.
>    - Revoca permisos `PUBLIC`/`anon` innecesarios; grants mínimos.
> 4. **Creada Edge Function `voting-proxy`** que:
>    - Extrae IP real del cliente (`x-forwarded-for`, `x-real-ip`)
>    - Hashea DNI con SHA-256 antes de enviar a DB
>    - Aplica rate limiting vía wrappers `*_con_limite`
>    - Maneja CORS y errores sin exponer detalles internos
> 5. **Suite de 13 pruebas** de seguridad/integridad (doble voto, concurrencia, atomicidad, acceso no autorizado, idempotencia).
> 6. **Verificado build** TypeScript + Vite (✓) y typecheck (✓).
> 7. **Documentado todo** en este archivo.
>
> **Qué NO se hizo (fuera de alcance FASE 1 o bloqueado):**
> - **Ejecutar tests contra DB** — **BLOQUEADO**: Docker no disponible en entorno. Requiere instalación manual.
> - **Deploy Edge Function** — Código listo, pendiente `supabase functions deploy` con proyecto vinculado.
> - **Crear usuario admin real en Supabase** — Manual, ver K.1.
> - **Migrar frontend a usar Edge Function** — Tarea de Fase 2 (kiosco `/votar`).
> - Módulos funcionales: Mesas, Padrón, Config elección, Kiosco `/votar`, Resultados, PWA, Deploy.
>
> **Para continuar:** El siguiente asistente debe:
> 1. **Instalar Docker Desktop** si no está disponible.
> 2. Levantar Supabase local (`supabase start`).
> 3. Aplicar las 2 migraciones SQL en orden.
> 4. Crear usuario admin con `app_metadata.role = 'admin'` en **App Metadata**.
> 5. Ejecutar `node tests/security.test.js` y confirmar 13/13 pasan.
> 6. Deploy Edge Function: `supabase functions deploy voting-proxy`.
> 7. Solo entonces declarar **FASE 1 COMPLETADA Y VERIFICADA** y pasar a Fase 2.

---

**Ubicación del documento:** `webapp/Cambios nuevos.md`

**Fecha:** 2026-10-21  
**Fase:** 1.1 — Verificación y cierre de seguridad  
**Estado general:** **IMPLEMENTADA PERO NO VERIFICADA** (pendiente: Docker para tests locales, deploy Edge Function, migración frontend a Edge Function)

---

## P. Resumen FASE 2 — Padrón Electoral

**Documento completo:** [`webapp/Fase 02 - Padron electoral.md`](Fase%2002%20-%20Padron%20electoral.md)

### Objetivo
Gestión completa de mesas/salones y padrón electoral con importación CSV, validación, búsqueda, paginación y estadísticas.

### Archivos nuevos
| Archivo | Tipo |
|---------|------|
| `webapp/supabase/migrations/002_mesas_padron.sql` | Migración: campo `activo` en mesas, índices, 4 RPCs (estadísticas, listado, validar, importar) |
| `webapp/src/features/mesas/MesasPage.tsx` | CRUD mesas: crear, editar inline, activar/desactivar |
| `webapp/src/features/padron/PadronPage.tsx` | Padrón: dashboard stats, filtros (búsqueda, mesa, pendientes), paginación, importación CSV 3 pasos (archivo → preview → confirmar) |
| `webapp/tests/fase2.test.js` | 7 pruebas: Mesas CRUD, validaciones, estadísticas, filtros, validación importación, importación, seguridad anon |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `webapp/src/features/panel/PanelPage.tsx` | Navegación: 3 pestañas (Candidatos, Mesas, Padrón Electoral) |

### Funcionalidades clave
- **Mesas**: Soft delete (`activo`), FK restrict protege votantes históricos
- **Padrón**: Dashboard con totales y participación por mesa
- **Importación CSV**: Preview con validación fila a fila (DNI 8 dígitos, nombre, mesa activa, duplicados) → Confirmación → Importación atómica con reporte (insertados/duplicados/errores)
- **Filtros**: Búsqueda ILIKE DNI/nombre, select mesa, checkbox solo pendientes, paginación 50 filas
- **Seguridad**: RLS heredada Fase 1 (`is_app_admin()`), RPCs `SECURITY DEFINER` solo `authenticated`, `anon` sin acceso

### Verificación
| Check | Resultado |
|-------|-----------|
| `npm run build` | ✅ Compilación exitosa |
| `npx tsc --noEmit` | ✅ Sin errores TypeScript |
| Tests DB | ⏳ Pendiente (requiere Docker + Supabase local) |

### Próximos pasos (Fase 3)
- Kiosco `/votar` con Edge Function rate limiting
- Registro de voto via `emitir_voto_con_limite`
- Resultados en vivo con Realtime
- Acta PDF, PWA, Deploy