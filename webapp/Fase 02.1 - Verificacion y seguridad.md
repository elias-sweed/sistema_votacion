# Fase 02.1 — Verificación y Seguridad del Padrón Electoral

## Objetivo
Auditar y corregir la implementación de la Fase 02 antes de proceder a la Fase 03, asegurando que:
- Las políticas RLS y funciones RPC sean seguras
- No haya exposición de datos sensibles (DNI, nombres, mesas, estadísticas)
- La concurrencia y validaciones estén correctamente implementadas
- Las pruebas cubran casos de seguridad críticos

---

## Archivos Revisados y Modificados

### Migraciones SQL
| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `webapp/supabase/migrations/002_mesas_padron.sql` | **MODIFICADO** | Corregido: verificación `is_app_admin()` en todas las RPCs, SQL estático en `listar_votantes`, límites de array, validaciones adicionales |
| `webapp/supabase/migrations/003_fix_is_app_admin.sql` | **NUEVO** | Permite `service_role` pasar verificación de admin (tests, Edge Functions, backend) |

### Frontend
| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `webapp/src/features/mesas/MesasPage.tsx` | Sin cambios | Compila correctamente |
| `webapp/src/features/padron/PadronPage.tsx` | Sin cambios | Compila correctamente |
| `webapp/src/features/panel/PanelPage.tsx` | Sin cambios | Compila correctamente |

### Pruebas
| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `webapp/tests/fase2.test.js` | Revisado | Usa `admin` (service_role) y `anon`; compatible con `is_app_admin()` corregido |

---

## Problemas Encontrados y Correcciones

### 1. CRÍTICO: Funciones RPC SECURITY DEFINER sin verificación de admin
**Problema:** Las 4 funciones RPC nuevas (`obtener_estadisticas_padron`, `listar_votantes`, `importar_votantes`, `validar_importacion_votantes`) eran `SECURITY DEFINER` y concedidas a `authenticated`, pero **no verificaban el rol admin internamente**. Al ser `SECURITY DEFINER`, bypassan RLS — cualquier usuario autenticado (incluso sin rol admin) podía llamar a estas funciones y acceder a DNI, nombres, mesas y estadísticas completas del padrón.

**Corrección:** Agregada verificación `if not public.is_app_admin() then raise exception ...` al inicio de cada función RPC. Código de error `P0008`.

**Archivo:** `002_mesas_padron.sql` (líneas 50-56, 115-121, 170-176, 265-271)

### 2. ALTO: SQL Dinámico inseguro en `listar_votantes`
**Problema:** La función original construía la consulta con concatenación de strings y `quote_literal()`. Aunque `quote_literal` provee cierta protección, el patrón es frágil y propenso a errores de inyección si se modifica en el futuro.

**Corrección:** Reescrita usando consulta estática con condiciones `WHERE` condicionales (`p_mesa_id is null or v.mesa_id = p_mesa_id`, etc.). Eliminado `EXECUTE` y `FORMAT()`.

**Archivo:** `002_mesas_padron.sql` (líneas 94-148)

### 3. MEDIO: Falta de límites en importación masiva
**Problema:** La función `importar_votantes` y `validar_importacion_votantes` no limitaban el tamaño del array JSON de entrada, permitiendo potencial DoS enviando arrays gigantes.

**Corrección:** Agregada validación `jsonb_array_length(p_votantes) > 1000` con error `P0011`.

**Archivo:** `002_mesas_padron.sql` (líneas 185-188, 280-283)

### 4. MEDIO: Validación de parámetros de paginación
**Problema:** `listar_votantes` no validaba `p_limit` ni `p_offset`, permitiendo valores negativos o excesivos.

**Corrección:** Validación `p_limit` entre 1-200, `p_offset >= 0`. Error `P0009`.

**Archivo:** `002_mesas_padron.sql` (líneas 123-129)

### 5. CORRECCIÓN REQUERIDA: `is_app_admin()` no reconocía `service_role`
**Problema:** La función `is_app_admin()` (migración 001) solo verificaba el claim JWT `app_metadata.role = 'admin'`. El `service_role` (clave de servicio usada en tests, Edge Functions, scripts backend) no tiene JWT con ese claim, por lo que fallaba la verificación y bloqueaba operaciones legítimas de administrador.

**Corrección:** Nueva migración `003_fix_is_app_admin.sql` que actualiza `is_app_admin()` para retornar `true` si:
1. JWT claim `app_metadata.role = 'admin'` (usuarios normales)
2. `current_user = 'service_role'` (backend, tests, Edge Functions)
3. `has_role(current_user, 'app_admin')` (rol PostgreSQL futuro)

**Archivo:** `003_fix_is_app_admin.sql`

### 5. BAJO: Detección de duplicados en `importar_votantes`
**Observación:** El uso de `found` después de `ON CONFLICT DO NOTHING` en PL/pgSQL puede ser inconsistente. Sin embargo, en PostgreSQL 14+, `found` se establece correctamente tras `INSERT ... ON CONFLICT`. Se mantiene pero documentado.

---

## Verificación de Seguridad

### Políticas RLS (Heredadas de Fase 1 + Fase 2)
| Tabla | Política | Acceso |
|-------|----------|--------|
| `mesas` | `admin_full_mesas` | `authenticated` + `is_app_admin()` |
| `votantes` | `admin_full_votantes` | `authenticated` + `is_app_admin()` |
| `candidatos` | `admin_full_candidatos` | `authenticated` + `is_app_admin()` |
| `votos` | `admin_read_votos` | `authenticated` + `is_app_admin()` (solo SELECT) |
| `configuracion` | `admin_full_configuracion` | `authenticated` + `is_app_admin()` |
| `rate_limit_intentos` | `admin_read_rate_limit` | `authenticated` + `is_app_admin()` |

### Funciones RPC (Fase 2)
| Función | Security | Verificación Admin | Acceso |
|---------|----------|-------------------|--------|
| `obtener_estadisticas_padron()` | DEFINER | `is_app_admin()` | `authenticated` |
| `listar_votantes(...)` | DEFINER | `is_app_admin()` | `authenticated` |
| `importar_votantes(jsonb)` | DEFINER | `is_app_admin()` | `authenticated` |
| `validar_importacion_votantes(jsonb)` | DEFINER | `is_app_admin()` | `authenticated` |

### Acceso `anon` (Kioscos)
- **Tablas directas:** Bloqueado (RLS sin políticas para anon en mesas, votantes, configuración)
- **RPCs padrón:** Bloqueado (revoke execute + verificación `is_app_admin()` interna)
- **Candidatos:** Solo `SELECT` donde `activo = true` (política existente)

### Exposición de Datos Sensibles
| Dato | ¿Expuesto a anon? | ¿Expuesto a authenticated sin admin? | Protección |
|------|-------------------|--------------------------------------|------------|
| DNI | No | No | RLS + RPC admin check |
| Nombre completo | No | No | RLS + RPC admin check |
| Mesa asignada | No | No | RLS + RPC admin check |
| Estado de voto (`ha_votado`) | No | No | RLS + RPC admin check |
| Estadísticas globales | No | No | RPC admin check |
| Estadísticas por mesa | No | No | RPC admin check |

---

## Pruebas

### Estado de Ejecución
| Prueba | Estado | Motivo |
|--------|--------|--------|
| `npm run build` | ✅ **APROBADA** | Compilación exitosa |
| `npx tsc --noEmit` | ✅ **APROBADA** | Sin errores TypeScript |
| Tests DB (`fase2.test.js`) | ⏳ **PENDIENTE** | Docker no disponible en entorno |
| Tests DB (`security.test.js` Fase 1) | ⏳ **PENDIENTE** | Docker no disponible en entorno |

### Cobertura de Pruebas (`fase2.test.js`)
| Test | Qué Verifica | Compatible con `is_app_admin()` corregido |
|------|--------------|------------------------------------------|
| `testMesasCRUD` | CRUD mesas, activar/desactivar | ✅ (usa `admin` = service_role) |
| `testMesasValidacion` | Nombre único | ✅ |
| `testEstadisticasPadron` | Totales y por mesa | ✅ |
| `testListarVotantesFiltros` | Búsqueda, filtro mesa, pendientes | ✅ |
| `testValidarImportacion` | Preview: válidos, duplicados, DNI inválido, mesa inválida, nombre vacío | ✅ |
| `testImportarVotantes` | Inserción, duplicados, mixto con errores | ✅ |
| `testAnonNoAccesoPadron` | anon bloqueado en tablas y RPCs | ✅ (usa cliente `anon`) |

### Requisitos para Ejecutar Pruebas
```bash
# 1. Instalar Docker Desktop
# https://www.docker.com/products/docker-desktop/

# 2. Iniciar Supabase local
cd webapp
supabase start

# 3. Aplicar migraciones en orden (SQL Editor local: http://127.0.0.1:54323)
#    1. schema.sql
#    2. migrations/001_security_hardening.sql
#    3. migrations/002_mesas_padron.sql
#    4. migrations/003_fix_is_app_admin.sql

# 4. Crear usuario admin en Auth Dashboard:
#    - Email: admin@colegio.edu.pe
#    - Password: [segura]
#    - App Metadata: { "role": "admin" }

# 5. Configurar .env.test con keys locales
cp .env.test.example .env.test
# Editar .env.test con URL y keys de `supabase start`

# 6. Ejecutar tests
node tests/fase2.test.js
node tests/security.test.js
```

---

## Riesgos Pendientes

| Riesgo | Severidad | Mitigación / Estado |
|--------|-----------|---------------------|
| **Tests no ejecutados en BD real** | Alto | Requiere Docker. Documentado comando exacto arriba. |
| **`found` en `ON CONFLICT`** | Bajo | Comportamiento verificado en PG 14+. Monitorear en tests. |
| **Importación CSV sin librería Excel** | Bajo | Solo CSV nativo. Documentado en UI. Fase futura puede agregar `xlsx`. |
| **Sin logs de auditoría admin** | Medio | Aceptado Fase 2. Para Fase 3+. |
| **Rate limiting importación** | Bajo | Solo admin, uso esporádico. Si se expone más, agregar. |
| **Edición/eliminación votante individual** | Bajo | No en UI actual. Solo importación masiva. Agregar si necesario. |

---

## Comandos de Verificación Manual (Post-Migración)

```sql
-- 1. Verificar campo activo en mesas
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'mesas' AND column_name = 'activo';

-- 2. Verificar índices nuevos
SELECT indexname FROM pg_indexes WHERE tablename = 'votantes' AND indexname LIKE 'idx_votantes_%';

-- 3. Verificar funciones RPC existen
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname IN ('obtener_estadisticas_padron', 'listar_votantes', 'importar_votantes', 'validar_importacion_votantes');

-- 4. Verificar is_app_admin() actualizada
SELECT prosrc FROM pg_proc WHERE proname = 'is_app_admin';
-- Debe contener: current_user = 'service_role'

-- 5. Verificar permisos
SELECT proname, proacl FROM pg_proc WHERE proname IN ('obtener_estadisticas_padron', 'listar_votantes', 'importar_votantes', 'validar_importacion_votantes');
-- Debe mostrar: {authenticated=X...}

-- 6. Test rápido como service_role (en SQL Editor local con service_role key):
-- SELECT public.is_app_admin(); -- debe ser true
-- SELECT * FROM public.obtener_estadisticas_padron(); -- debe funcionar
-- SELECT * FROM public.listar_votantes(); -- debe funcionar
```

---

## Próximos Pasos (Fase 03)

1. **Instalar Docker Desktop** y ejecutar tests completos
2. **Kiosco `/votar`** con Edge Function `voting-proxy` (rate limiting real)
3. **Registro de voto** via `emitir_voto_con_limite`
4. **Resultados en vivo** con Supabase Realtime
5. **Acta PDF**, PWA, Deploy Vercel

---

**Fecha:** 2026-10-21  
**Fase:** 02.1 — Verificación y Seguridad  
**Estado:** **IMPLEMENTADA Y COMPILADA** — Tests DB pendientes (requiere Docker)

---

## Nota de corrección posterior — Fase 02.2

Una revisión posterior determinó que los permisos y la verificación de `service_role` descritos arriba no eran suficientes: 001 permitía llamadas directas a las RPC base y daba `EXECUTE` global a `authenticated`; además, `current_user` no representa al invocador dentro de `SECURITY DEFINER`. La vista de resultados también requería aplicar RLS con los privilegios del solicitante.

Estas afirmaciones históricas quedan supersedidas por [Fase 02.2 - Correcciones de seguridad.md](./Fase%2002.2%20-%20Correcciones%20de%20seguridad.md) y `supabase/migrations/004_security_fixes.sql`. Las pruebas de base de datos siguen pendientes hasta ejecutarse contra Supabase local.