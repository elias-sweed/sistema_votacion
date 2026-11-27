# Fase 12 — Seguridad de acceso y despliegue

Estado: **código y configuración listos; despliegue remoto pendiente de
credenciales y dominio**.

Objetivo: cerrar el acceso de prueba que abría el panel a cualquier usuario
autenticado, endurecer el manejo de sesión y caché en equipos compartidos y
dejar listo el despliegue de `voting-proxy`.

---

## 1. Cambios aplicados en el código

### 1.1 Gate de administrador real

- `src/lib/session.ts`: nueva función `esSesionAdmin(session)`.
  Solo devuelve `true` cuando `session.user.app_metadata.role === 'admin'`.
- `src/App.tsx`: se eliminó `const esAdmin = session !== null`.
  Ahora una sesión sin rol admin ve `AccessDeniedPage`, no el panel.
- `src/features/auth/AccessDeniedPage.tsx`: usa el mismo helper.
- El rol se lee de **app_metadata** (firmado por Supabase). Nunca de
  `user_metadata`, que el propio usuario puede editar.

### 1.2 Sesión y caché sin datos persistentes

- `src/lib/supabase.ts`: la sesión de Auth se guarda en `sessionStorage`
  (o en memoria si el navegador lo bloquea), no en `localStorage`.
  Sobrevive a recargas de la pestaña, pero desaparece al cerrarla.
- `src/lib/panelCache.ts`: la caché del panel (que incluye DNI y nombres del
  padrón) pasó de `localStorage` a `sessionStorage`.
- `limpiarCacheLegado()` purga al arrancar cualquier caché antigua que haya
  quedado en `localStorage` de equipos ya usados.
- Al cerrar sesión se limpia la caché del panel.

### 1.3 Validación de entorno

- `src/lib/env.ts`: valida `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  con mensajes claros.
- `src/components/ConfigErrorPage.tsx`: pantalla de configuración incompleta
  en lugar de un arranque roto.

### 1.4 SQL

- `supabase/migrations/005_admin_role_hardening.sql`: restaura
  `is_app_admin()` para aceptar únicamente `app_metadata.role = 'admin'`
  o el claim `service_role`. Revoca `EXECUTE` de `public` y `anon`.
- `supabase/scripts/acceso_directo.sql`: ya **no** abre el panel a cualquier
  usuario. Ahora escribe `app_metadata.role = 'admin'` en un correo concreto.
- `supabase/scripts/agregar_admin.sql`: mismo mecanismo, con correo editable.
- `supabase/scripts/super_admin.sql`: marcado como obsoleto (registraba a
  todos los usuarios como administradores).
- `supabase/scripts/crear_usuario.mjs`: al crear o reparar el usuario admin,
  ahora incluye `app_metadata: { role: 'admin' }`.
- `supabase/scripts/verificar_produccion.mjs`: comprueba que `voting-proxy`
  responde con el formato esperado.

### 1.5 PWA y cabeceras de Vercel

`vercel.json` mantiene el rewrite de SPA y añade:

| Ruta | Cabeceras | Motivo |
|---|---|---|
| `/assets/(.*)` | `Cache-Control: public, max-age=31536000, immutable` | Los nombres llevan hash; se pueden cachear un año. |
| `/sw.js` | `no-cache, no-store, must-revalidate` + `Content-Type` JS | El navegador debe ver siempre la última versión del service worker. |
| `/workbox-(.*).js` | `no-cache` | Igual que `sw.js`. |
| `/manifest.webmanifest` | `application/manifest+json` + `no-cache` | Evita que el manifest quede obsoleto. |
| Todas | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` | Endurecimiento básico. |

El service worker **solo precachea el shell** (HTML, JS, CSS, fuentes e
iconos). No se cachean consultas a Supabase, respuestas de `voting-proxy` ni
votos. La votación sigue siendo online-only: ver `MODO_KIOSCO.md`.

> La CSP queda pendiente: requiere ajustar orígenes de Supabase y estilos
> inline antes de activarla en producción.

> Importante: `usuarios_admin` deja de usarse para autorizar. No se elimina
> la tabla para no borrar datos, pero ya no influye en `is_app_admin()`.

---

## 2. Despliegue (requiere credenciales)

Estos pasos no se pudieron ejecutar desde el entorno de análisis porque no
había `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` ni sesión de
`supabase login`.

### 2.1 Aplicar la migración 005

Opción A — SQL Editor del dashboard:

1. Abrir Supabase → SQL Editor.
2. Pegar y ejecutar el contenido de
   `webapp/supabase/migrations/005_admin_role_hardening.sql`.

Opción B — Management API (PowerShell, desde `webapp/`):

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_tu_token"
node supabase/scripts/aplicar_sql.mjs supabase/migrations/005_admin_role_hardening.sql
```

### 2.2 Otorgar el rol admin al correo correcto

Editar el correo en `supabase/scripts/acceso_directo.sql` y ejecutarlo en el
SQL Editor. Luego el usuario debe **cerrar sesión y volver a entrar** para
que el JWT incluya `app_metadata.role = "admin"`.

Alternativa sin SQL: Authentication → Users → seleccionar usuario →
App Metadata → `{ "role": "admin" }` → guardar → refrescar sesión.

Verificación: el script imprime los correos con rol admin. Si la lista está
vacía, nadie podrá entrar al panel.

### 2.3 Desplegar la Edge Function

Desde `webapp/`:

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_tu_token"
npm run deploy:function
```

El comando usa `--no-verify-jwt` porque el kiosco es público por diseño y el
control real está en la función (rate limiting + RPC con `service_role`).
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase
automáticamente en las funciones alojadas.

### 2.4 Verificar

```powershell
npm run verify:prod
```

Debe imprimir `OK: voting-proxy está desplegada y responde correctamente.`
Si responde 404, la función no se desplegó. Si responde 401/403, revisar
`--no-verify-jwt`.

### 2.5 Configurar el proyecto en Vercel

1. Importar el repositorio en Vercel.
2. **Root Directory:** `webapp`.
3. **Framework Preset:** Vite (build `npm run build`, output `dist`).
4. Variables de entorno (Production y Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Dominio: usar el dominio `*.vercel.app` o uno propio. El service worker y
   la instalación PWA requieren HTTPS; Vercel lo entrega por defecto.

No hace falta definir `SUPABASE_SERVICE_ROLE_KEY` en Vercel: esa clave vive
solo en la Edge Function.

### 2.6 Redesplegar la PWA

El cambio de gate y de sesión solo llega a producción al desplegar:

```powershell
vercel --prod
```

o haciendo push a la rama conectada en Vercel.

Tras el despliegue, comprobar que `/sw.js` responde con `no-cache` y que
`/manifest.webmanifest` devuelve `application/manifest+json`.

### 2.7 Dejar listo el kiosco

Una vez desplegado, seguir `MODO_KIOSCO.md`:

1. Copiar el enlace de cada mesa desde **Mesas**.
2. Abrir Chrome o Edge con `--kiosk` en la máquina del salón.
3. Verificar el checklist del día de la elección.

La app es instalable como PWA, pero el voto requiere conexión: si se cae la
red, el kiosco avisa y bloquea la confirmación.

---

## 3. Comprobaciones posteriores

1. Entrar con un usuario **sin** rol admin: debe verse “Acceso al panel
   restringido”, no el panel.
2. Entrar con el usuario admin: debe abrir el panel.
3. Recargar la pestaña: la sesión admin se mantiene.
4. Cerrar la pestaña y abrir de nuevo: debe pedir login otra vez.
5. En DevTools → Application:
   - `localStorage` no debe contener claves `sv-panel-cache:v1:*`.
   - `sessionStorage` puede contener la caché mientras la pestaña está abierta.
6. Abrir `/votar` y completar un voto de prueba.
7. En DevTools → Application → Service Workers: el SW debe estar activo y
   `Cache Storage` solo debe contener el precache del shell.
8. Detener la red (DevTools → Network → Offline) y recargar `/login`: la app
   debe cargar y mostrar el aviso “Sin conexión”.
9. En `/votar` sin red: debe verse el aviso y el botón de confirmar voto debe
   quedar deshabilitado.

---

## 4. Riesgos y notas

- Si se aplica la migración 005 y ningún usuario tiene el rol admin, el panel
  queda bloqueado hasta ejecutar `acceso_directo.sql`. Es el comportamiento
  correcto; hacerlo en una ventana de mantenimiento.
- `sessionStorage` no protege frente a XSS. La mitigación real es CSP y evitar
  inyectar HTML; queda pendiente en la fase de endurecimiento (P2).
- El bundle principal ronda los 841 kB (~245 kB gzip). La división en chunks
  con `manualChunks` sigue pendiente como mejora de rendimiento; el precache
  del shell no incluye el fondo grande del kiosco (`fondo-*.jpg`).
- Las cabeceras de seguridad son básicas. `X-Frame-Options: SAMEORIGIN` evita
  embeber la app en otros sitios, pero no sustituye una CSP completa.
