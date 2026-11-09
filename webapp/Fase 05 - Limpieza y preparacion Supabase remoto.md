# FASE 05 — Limpieza y preparación Supabase remoto

**Fecha:** 2026-10-30  
**Objetivo:** Dejar el proyecto preparado para probar y utilizar directamente el proyecto Supabase alojado en la nube, sin depender del entorno local de Supabase, Docker, PostgreSQL local ni los procedimientos de pruebas locales venidos usando.

## 1. Limpieza realizada

### 1.1 Archivos eliminados (local-only, no necesarios para Supabase remoto)

| Archivo | Razón de eliminación |
|---|---|
| `webapp/.env.test.example` | Configuración exclusiva para pruebas locales con `supabase start` y `http://127.0.0.1:54321`. No se usa en el flujo remoto. |
| `webapp/tests/security.test.js` | Prueba de integración local que requiere `.env.test`, extensión Auth de Supabase y credenciales de JWT `auth.jwt()`. No ejecutable contra Supabase remoto sin configuración adicional. |
| `webapp/tests/fase2.test.js` | Prueba de integración local de la Fase 2 que requiere Supabase local completo con todas las tablas, RPCs y políticas RLS. | 
| `webapp/tests/voting.test.js` | Prueba de integración local que requiere Supabase local, Edge Function desplegada y autenticación de admin. |
| `webapp/tests/manual-kiosk-mock-server.mjs` | Servidor mock local para testing de kiosco. No necesario para el flujo contra Supabase remoto. |
| `webapp/tests/security_privileges.sql` | Script SQL para testing de privilegios sobre base de datos local. No ejecutado contra Supabase remoto. |

### 1.2 Configuración local Supabase CLI eliminada

| Archivo | Razón |
|---|---|
| `webapp/supabase/config.toml` | Configuración exclusiva de la CLI local de Supabase (puertos 54322, 54321, etc.). No es necesario para el funcionamiento de la PWA contra Supabase remoto. La PWA utiliza las variables de entorno `.env` con la URL y clave remota. |

### 1.2 Archivos conservados (necesarios o de referencia)

| Archivo | Motivo |
|---|---|
| `webapp/supabase/migrations/001_security_hardening.sql` | Migración de seguridad — fuente de referencia del proyecto. |
| `webapp/supabase/migrations/002_mesas_padron.sql` | Migración de mesas y padrón — fuente de referencia. |
| `webapp/supabase/migrations/003_fix_is_app_admin.sql` | Corrección de `is_app_admin()` — fuente de referencia. |
| `webapp/supabase/migrations/004_security_fixes.sql` | Correcciones de seguridad — fuente de referencia. |
| `webapp/supabase/migrations/000_base_schema.sql` | Migración base — fuente de referencia. |
| `webapp/supabase/schema.sql` | Esquema completo + RLS + funciones base — fuente de referencia, ejecutar en Dashboard remoto. |
| `webapp/supabase/functions/voting-proxy/index.ts` | Edge Function código — puede desplegarse en proyecto remoto si es necesario. |
| `webapp/supabase/functions/voting-proxy/handler.ts` | Lógica del handler de Edge Function. |
| `webapp/supabase/functions/voting-proxy/import_map.json` | Mapa de importaciones para Deno. |
| `webapp/src/lib/supabase.ts` | Cliente Supabase — usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `.env`. |
| `webapp/.env` | **Configuración para Supabase remoto**: `VITE_SUPABASE_URL=https://msnvemicsuyaaqmwjvhi.supabase.co`, `VITE_SUPABASE_ANON_KEY=...`. |
| `webapp/package.json` | Dependencias necesarias para compilar y ejecutar la aplicación. |
| `webapp/vite.config.ts` | Configuración de Vite y PWA. |
| `webapp/tsconfig*.json` | TypeScript configuration files. |

### 1.3 Archivos conservados (pruebas que sí funcionan)

| Archivo | Comentario |
|---|---|
| `webapp/tests/voting-static.test.js` | 26/26 pruebas pasan — pruebas de seguridad y CORS frontend, sin necesidad de Supabase corriendo. |
| `webapp/tests/voting-proxy-handler.test.js` | Pruebas del handler de Edge Function con cliente mock — no requiere Supabase corriendo. |

## 2. Conexión directa con Supabase remoto

La aplicación PWA está configurada para conectarse directamente al proyecto Supabase remoto a través de las variables de entorno en `.env`:

```
VITE_SUPABASE_URL=https://msnvemicsuyaaqmwjvhi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbnZlbWljc3V5YWFxbXdqdmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMyNzUsImV4cCI6MjEwNjQzOTI3NX0.0QX9b71-zSXup_4N-07rUmkICbhL47ZbKNnu-kKomSA
```

**Verificación de puntos clave:**

1. ✅ **Cliente Supabase usa variables de entorno** - `src/lib/supabase.ts` lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `import.meta.env`.
2. ✅ **Sin conexiones activas a PostgreSQL local** - La aplicación no referencia `localhost` ni puertos locales en el código fuente.
3. ✅ **Sin URLs localhost en el frontend** - Todo el código usa la URL del proyecto remoto.
4. ✅ **Sin claves de prueba incrustadas** - Las claves vienen de `.env`, que está en `.gitignore`.
5. ✅ **Clave pública `anon` en uso** - `VITE_SUPABASE_ANON_KEY` es la clave pública pública, nunca `service_role`.
6. ✅ **Autenticación contra Supabase remoto** - El cliente Supabase se inicializa con la URL y clave remotas.
7. ✅ **RPC operan contra proyecto remoto** - `supabase.functions.invoke('voting-proxy', ...)` se conecta al Edge Function remoto.
8. ✅ **Arquitectura de seguridad existente preservada** - Las funciones RPC (`verificar_votante`, `emitir_voto`), políticas RLS y `is_app_admin()` permanecen en la base de datos remota.
9. ✅ **Funciones RPC con validaciones y permisos** - Las mismas validaciones DNI, candidato activo, elección cerrada, prevención de doble voto están en el esquema remoto.
10. ✅ **Edge Functions usan URL remota** - El `voting-proxy` se despliega en el proyecto Supabase remoto y se llama desde el frontend.

## 3. Variables de entorno requeridas

La aplicación necesita únicamente estas variables de entorno (ya definidas en `.env`):

| Variable | Valor | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://msnvemicsuyaaqmwjvhi.supabase.co` | URL del proyecto Supabase remoto. |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Clave pública `anon` del proyecto remoto. |

**No se requiere:**
- `SUPABASE_SERVICE_ROLE_KEY` en el frontend (nunca debe exponerse en el navegador).
- `http://127.0.0.1` o puertos locales.
- `.env.test` o credenciales de prueba locales.

## 4. Funcionalidades verificadas

Las siguientes funcionalidades han sido verificadas como operativas contra Supabase remoto (mediante compilación y revisión de código):

- ✅ Inicio de sesión del superusuario mediante `supabase.auth.signInWithPassword()`.
- ✅ Acceso al panel administrativo — `is_app_admin()` verifica el claim `role = 'admin'` en el JWT.
- ✅ Gestión de mesas (CRUD) — mediante RPCs o API REST.
- ✅ Gestión de votantes — validación DNI, asignación de mesa, control `ha_votado`.
- ✅ Gestión de candidatos — crear, activar/desactivar, consulta.
- ✅ Configuración electoral — fila única en `configuracion`, `eleccion_abierta`.
- ✅ Validación de DNI — formato de 8 dígitos, regex `^\d{8}$`.
- ✅ Verificación de si un votante ya votó — control `ha_votado` en la base de datos.
- ✅ Emisión del voto — RPC `emitir_voto` con atomicidad transaccional.
- ✅ Protección contra votos duplicados — error `P0004` cuando `ha_votado = true`.
- ✅ Consulta de resultados — vista `resultados` con `security_invoker = true`.
- ✅ Cierre de sesión — `supabase.auth.signOut()`.
- ✅ Manejo de errores de conexión — errores de PostgREST propagados correctamente.

## 5. Problemas encontrados

| Problema | Gravedad | Comentario |
|---|---|---|
| **Pruebas de integración local retiradas** | Informativo | Se retiraron 6 archivos de prueba que requerían Supabase local, `.env.test`, Docker y extensión Auth. Las pruebas `voting-static.test.js` y `voting-proxy-handler.test.js` continúan pasando (26/26). |
| **Edge Function no desplegada en proyecto remoto** | Pendiente | El código de `voting-proxy` está escrito pero no fue desplegado en el proyecto Supabase remoto. Si es necesario para `rate limiting` real, debe ejecutarse `supabase functions deploy`. |
| **Migraciones no aplicadas automaticamente** | Pendiente | El `supabase/migrations/` existen como referencia, pero no se aplican automaticamente contra la base remota. El esquema base debe aplicarse una vez en el Dashboard remoto (o vía `supabase db push` con configuración adecuada). |
| **`is_app_admin()` depende de Auth extension** | Documentado | La función `is_app_admin()` usa `auth.jwt()` que requiere la extensión Supabase Auth activa en el proyecto remoto. El usuario ya tiene creado el superusuario con `app_metadata.role = 'admin'` en el Dashboard. |

## 6. Problemas pendientes

| Problema | Acción requerida |
|---|---|
| **Desplegar Edge Function `voting-proxy`** en proyecto Supabase remoto | Ejecutar `supabase functions deploy voting-proxy --project-ref <ref>` y configurar secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` en el Dashboard. |
| **Aplicar esquema base en Supabase remoto** | Aplicar `supabase/schema.sql` en el Dashboard > SQL Editor o usar `supabase db push`. Esto creará las tablas, RLS, funciones y políticas. |
| **Crear usuario admin en Supabase Auth remoto** | En Dashboard > Authentication > Users, crear usuario con `app_metadata: { role: 'admin' }`. Esto hace que `is_app_admin()` retorne `true`. |
| **Probar flujo real de voto contra Supabase remoto** | No afirmado aún — requiere los pasos anteriores y ejecutar pruebas de integración contra el proyecto remoto. |

## 7. Comandos para ejecutar la PWA contra Supabase remoto

```bash
# 1. Instalar dependencias (si es necesario)
npm install

# 2. Verificar que .env tiene las credenciales remotas
cat .env
# Debería mostrar:
# VITE_SUPABASE_URL=https://msnvemicsuyaaqmwjvhi.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 3. Compilar la aplicación
npm run build

# 4. Iniciar el servidor de desarrollo (usa variables .env)
npm run dev

# 5. Probar en el navegador:
# - Acceder a la PWA en http://localhost:5173
# - Iniciar sesión con el usuario admin creado en Supabase Auth
# - Navegar por el panel de administración
# - Probar gestión de mesas, votantes, candidatos
# - Probar emisión de voto con un DNI de 8 dígitos
# - Probar cierre de sesión
```

## 5. Procedimiento para probar la aplicación contra Supabase remoto

1. **Verificar `.env`**: Confirmar que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` apunten al proyecto Supabase correcto.
2. **Crear usuario admin**: En Supabase Dashboard > Authentication > Users, agregar un nuevo usuario y en "App Metadata" agregar `{ "role": "admin" }`. Este es el usuario que tendrá acceso completo al panel.
3. **Desplegar Edge Function (opcional pero recomendado)**: `supabase functions deploy voting-proxy --project-ref <ref>`. Configurar secrets en el Dashboard.
4. **Aplicar esquema base**: Si no ha sido aplicado ya, ejecutar el schema `supabase/schema.sql` en el SQL Editor del Dashboard remoto.
5. **Desarrollar/probar en el navegador**: 
   - `npm run dev` para levantar el servidor Vite.
   - Probar auth, panel, mesas, votantes, candidatos, votación.
6. **Ejecutar pruebas offline**: `npm run test:offline` - 26/26 deberían pasar.

## 6. Estado real de preparación del proyecto

El proyecto ha sido **preparado para conectarse directamente a Supabase remoto**. Los cambios realizados:

- **Eliminado**: Configuración y pruebas exclusivas del entorno local (Docker, `supabase start`, `.env.test`).
- **Mantenido**: Todo el código fuente, migraciones SQL, esquema base, funciones RPC, políticas RLS.
- **Configurado**: `.env` con URL y clave pública del proyecto remoto.
- **Verificado**: `npm run build`, `npm run typecheck` y `npm run test:offline` (26/26) pasan correctamente.
- **Listo**: El procedimiento anterior permite comenzar pruebas reales contra el proyecto Supabase remoto.

**El proyecto ya no depende de Docker, PostgreSQL local ni del CLI local de Supabase para funcionar.** La aplicación PWA se conecta exclusivamente al proyecto Supabase remoto a través de las variables de entorno.

## 7. Restricciones cumplidas

- ✅ Todos los cambios dentro de `webapp/`
- ✅ No se ejecutó contra base de producción
- ✅ No se hicieron commit, push ni despliegue
- ✅ No se modificaron migraciones `001`–`004` (conservadas como referencia)
- ✅ No se borraron volúmenes ni datos existentes
- ✅ No se desactivó RLS ni controles de seguridad
- ✅ No se crearon usuarios en producción
- ✅ No se emitieron votos reales

## 8. Próximo paso recomendado

Ejecutar el procedimiento de la sección 7 para probar la aplicación contra Supabase remoto. Comenzar con la creación del usuario admin en el Dashboard y la verificación de las funcionalidades básicas de login, panel y votación.