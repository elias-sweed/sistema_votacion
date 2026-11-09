# Informe de Permisos y RLS — Administrador Único

## 1. Diagnóstico del problema

### Causa raíz

Las políticas RLS del esquema usaban la función `is_app_admin()`, que verifica:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
```

Esto crea una dependencia del **claim `app_metadata` dentro del JWT**. El problema es que:

1. El claim `app_metadata` no siempre está presente en el JWT si el token no se refrescó después de asignarlo.
2. `signInWithPassword()` a veces devuelve un token que no incluye inmediatamente `app_metadata` actualizado.
3. Las operaciones DELETE masivo sin filtro WHERE en PostgREST son rechazadas con 400, independientemente de RLS, porque PostgREST requiere un filtro para operaciones de borrado masivo por seguridad.

### Síntomas observados

- `DELETE /rest/v1/votos` → 400 Bad Request
- `POST /rest/v1/rpc/borrar_todo` → 400 Bad Request
- "Tu usuario no tiene permisos de administrador"

### Solución adoptada

1. **Políticas RLS basadas en `auth.uid()`**: Se crea `es_admin_uuid()` que compara directamente el UUID del JWT con el del administrador. No depende de `app_metadata` ni de claims personalizados.
2. **GRANTs completos**: Se conceden `SELECT, INSERT, UPDATE, DELETE` a `authenticated` en todas las tablas.
3. **Permisos de secuencias**: `USAGE, SELECT` en las secuencias para que funcionen los `identity`.
4. **Permisos de funciones RPC**: Se aseguran los `EXECUTE` necesarios.

---

## 2. Migración SQL creada

Archivo: `webapp/supabase/migrations/013_admin_uuid_permisos_completos.sql`

La migración:
- Crea `public.es_admin_uuid()` basada en `auth.uid()`
- Elimina las políticas antiguas basadas en `is_app_admin()`
- Crea políticas nuevas para SELECT, INSERT, UPDATE, DELETE en las 5 tablas
- Concede GRANTs completos
- Concede permisos de secuencias y funciones RPC

---

## 3. UUID del administrador

```
1fbf5137-09fa-404f-8232-e21788a047f8
```

Este UUID fue identificado del usuario `votacion@jimenezpimentel.edu.pe` en Supabase Authentication → Users.

**Importante**: Si en el futuro cambias de usuario administrador, debes:
1. Crear el nuevo usuario en Authentication → Users
2. Actualizar el UUID en la función `es_admin_uuid()` y en las políticas
3. O ejecutar un `UPDATE` sobre las políticas existentes

---

## 4. Instrucciones exactas para ejecutar la migración

### Paso 1: Abrir Supabase SQL Editor

1. Entra a `https://app.supabase.com/project/msnvemicsuyaaqmwjvhi`
2. En el menú izquierdo, haz clic en **SQL Editor**
3. Haz clic en **New query**

### Paso 2: Copiar y pegar la migración

Copia **todo** el contenido de:

```
webapp/supabase/migrations/013_admin_uuid_permisos_completos.sql
```

Pégalo en el editor de SQL.

### Paso 3: Ejecutar

Haz clic en **Run** (o presiona `Ctrl+Enter`).

Deberías ver una tabla de políticas como resultado de la verificación final.

### Paso 4: Verificar que RLS está activo

Ejecuta esta consulta en el SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Todas las filas deben mostrar `rls_activado = true`.

### Paso 5: Cerrar sesión y volver a entrar

Para que el JWT se refresque con el UUID correcto:

1. En la aplicación, haz clic en **Cerrar sesión**
2. Vuelve a iniciar sesión con `votacion@jimenezpimentel.edu.pe`
3. Recarga la página

---

## 5. Pruebas para verificar que todo funciona

### Prueba 1: Consultar registros (SELECT)

En el panel de administración, verifica que puedes:
- Ver la lista de votantes en **Padrón**
- Ver la lista de mesas en **Mesas**
- Ver la configuración en **Configuración**

Si ves los datos, SELECT funciona.

### Prueba 2: Crear registros (INSERT)

- En **Mesas**, crea una mesa nueva (ej. "1° A") y verifica que aparece en la lista.
- En **Padrón**, agrega un votante manualmente y verifica que aparece.

### Prueba 3: Modificar registros (UPDATE)

- En **Mesas**, edita el nombre de una mesa y verifica el cambio.
- En **Configuración**, cambia el título y guarda.

### Prueba 4: Eliminar registros (DELETE)

- En **Mesas**, elimina una mesa individual (pide contraseña) y verifica que desaparece.
- En **Configuración**, usa "Eliminar todos los votantes" o "Eliminar todos los candidatos" y verifica.

### Prueba 5: Borrar todo de todo

- En **Configuración**, usa el botón "Borrar TODO de todo" (pide contraseña).
- Verifica que se borran votantes, candidatos, mesas y votos.

### Prueba 6: Verificar que anon NO puede operar

Abre una ventana de incógnito y ve a la URL del kiosco sin token. No deberías poder acceder al panel de administración (redirige a login).

### Prueba 7: Verificar políticas efectivas

En el SQL Editor, ejecuta:

```sql
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Deberías ver las políticas `admin_uuid_*` para cada tabla.

---

## 6. Estructura de políticas resultante

| Tabla | Políticas |
|-------|-----------|
| `mesas` | `admin_uuid_mesas_select`, `admin_uuid_mesas_insert`, `admin_uuid_mesas_update`, `admin_uuid_mesas_delete` |
| `votantes` | `admin_uuid_votantes_select`, `admin_uuid_votantes_insert`, `admin_uuid_votantes_update`, `admin_uuid_votantes_delete` |
| `candidatos` | `admin_uuid_candidatos_select`, `admin_uuid_candidatos_insert`, `admin_uuid_candidatos_update`, `admin_uuid_candidatos_delete`, `anon_uuid_candidatos_select` |
| `votos` | `admin_uuid_votos_select`, `admin_uuid_votos_insert`, `admin_uuid_votos_update`, `admin_uuid_votos_delete` |
| `configuracion` | `admin_uuid_configuracion_select`, `admin_uuid_configuracion_insert`, `admin_uuid_configuracion_update`, `admin_uuid_configuracion_delete` |

---

## 7. Notas de seguridad

- **RLS sigue activo**: Ninguna tabla tiene RLS desactivado.
- **Solo el UUID del admin**: Las políticas usan `auth.uid()` comparado con el UUID fijo. No se usa `raw_app_meta_data` ni `raw_user_meta_data`.
- **Anon no puede operar**: El rol `anon` solo tiene permiso de SELECT en `candidatos` (para el kiosco).
- **`service_role` no se usa desde el frontend**: Solo el backend (voting-proxy) usa `service_role`.

---

## 8. Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/013_admin_uuid_permisos_completos.sql` | Nueva migración con políticas por `auth.uid()` |
| `INFORME_PERMISOS.md` | Este informe |
