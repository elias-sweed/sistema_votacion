# Fase 02 - Padrón Electoral

## Objetivo
Implementar la gestión completa de mesas/salones y el padrón electoral con importación masiva, validación, búsqueda y estadísticas, manteniendo la seguridad establecida en Fase 1.

---

## Archivos creados/modificados

### Base de datos (migraciones)
| Archivo | Descripción |
|---------|-------------|
| `webapp/supabase/migrations/002_mesas_padron.sql` | Migración que añade: campo `activo` en mesas, índices en votantes, funciones RPC para estadísticas, listado paginado, validación e importación masiva |

### Frontend - Componentes nuevos
| Archivo | Descripción |
|---------|-------------|
| `webapp/src/features/mesas/MesasPage.tsx` | CRUD completo de mesas: crear, listar, editar inline, activar/desactivar |
| `webapp/src/features/padron/PadronPage.tsx` | Gestión completa del padrón: estadísticas, filtros, búsqueda, paginación, importación CSV con preview y validación |

### Frontend - Modificados
| Archivo | Cambio |
|---------|--------|
| `webapp/src/features/panel/PanelPage.tsx` | Navegación extendida: 3 pestañas (Candidatos, Mesas, Padrón Electoral) |

### Pruebas
| Archivo | Descripción |
|---------|-------------|
| `webapp/tests/fase2.test.js` | Suite de 7 pruebas: Mesas CRUD, validaciones, estadísticas, listado con filtros, validación importación, importación masiva, seguridad anon |

---

## Funcionalidades implementadas

### 1. Gestión de Mesas (`MesasPage.tsx`)
- **Crear**: Formulario con validación (mín. 2 caracteres), nombre único
- **Listar**: Tabla con nombre, estado (activo/inactivo), fecha creación
- **Editar**: Edición inline con botones Guardar/Cancelar
- **Activar/Desactivar**: Toggle que mantiene integridad referencial (votantes existentes conservan su mesa)
- **Seguridad**: Solo admin (claim `role=admin`) puede acceder via RLS

### 2. Padrón Electoral (`PadronPage.tsx`)

#### Dashboard de estadísticas
- Tarjetas: Total votantes, Votaron, Pendientes, % Participación
- Desglose por mesa: total, votaron, pendientes, % participación por mesa
- Datos en tiempo real via RPC `obtener_estadisticas_padron()`

#### Filtros y búsqueda
- **Búsqueda**: Por DNI o nombre (ILIKE, tiempo real al escribir)
- **Filtro por mesa**: Select con mesas activas
- **Solo pendientes**: Checkbox para ver solo quienes no han votado
- **Paginación**: 50 filas por página, controles Anterior/Siguiente

#### Importación CSV
1. **Selección de archivo**: Input `accept=".csv"`, validación extensión
2. **Preview/Validación** (RPC `validar_importacion_votantes`):
   - Valida cada fila: DNI (8 dígitos), nombre (requerido), mesa_id (existe y activa)
   - Detecta duplicados contra BD actual
   - Muestra tabla con estado: ✓ Válido / ✗ Error con motivo
   - Resumen: X válidos, Y inválidos
3. **Confirmación e importación** (RPC `importar_votantes`):
   - Transacción atómica: inserta solo válidos, ignora duplicados (ON CONFLICT)
   - Devuelve: insertados, duplicados, errores detallados por fila
   - Actualiza automáticamente estadísticas y lista

#### Tabla de votantes
- Columnas: DNI (monoespacio), Nombre, Mesa, Estado (Votó/Pendiente con badges), Registrado
- Estados visuales: fila verde suave para votados, ámbar para pendientes
- Paginación integrada

### 3. Base de datos - Funciones RPC nuevas

| Función | Parámetros | Retorno | Uso |
|---------|------------|---------|-----|
| `obtener_estadisticas_padron()` | — | Totales globales + array por mesa | Dashboard |
| `listar_votantes(p_mesa_id, p_busqueda, p_solo_pendientes, p_limit, p_offset)` | Filtros + paginación | Votantes + `total_count` | Lista paginada |
| `validar_importacion_votantes(p_votantes jsonb)` | Array JSON | Validos, invalidos, errores, preview | Preview importación |
| `importar_votantes(p_votantes jsonb)` | Array JSON | Insertados, duplicados, errores, detalle | Importación real |

---

## Validaciones implementadas

### DNI
- Formato: exactamente 8 dígitos (`^[0-9]{8}$`)
- Normalización: elimina no-dígitos antes de validar
- Unicidad: PK en BD + detección en preview/importación

### Nombre
- Requerido, no vacío después de trim
- Sin límite de caracteres (solo validación básica)

### Mesa
- Debe existir en tabla `mesas`
- Debe estar `activo = true`
- FK con `ON DELETE RESTRICT` protege integridad

### Duplicados
- Detección en preview (consulta BD)
- Manejo en importación: `ON CONFLICT (dni) DO NOTHING` + conteo via `found`

---

## Seguridad

### RLS (heredada de Fase 1)
- `mesas`: `authenticated` + `is_app_admin()` para ALL
- `votantes`: `authenticated` + `is_app_admin()` para ALL
- `anon`: Sin acceso directo a mesas, votantes, configuración

### Funciones RPC
- `SECURITY DEFINER` con `search_path = pg_catalog, public`
- `grant execute` solo a `authenticated`
- `revoke execute` de `anon` y `public`
- Validación de entrada en cada función

### Frontend
- Solo `anon key` expuesta
- Rutas protegidas por sesión en React (consistente con Fase 1)
- Archivos CSV procesados en cliente (no se suben a storage)

---

## Pruebas

### Ejecutadas (build + typecheck)
| Prueba | Resultado |
|--------|-----------|
| `npm run build` | ✅ Exit code 0, dist generado |
| `npx tsc --noEmit` | ✅ Sin errores |

### Pendientes (requieren Supabase local + Docker)
| Prueba | Descripción |
|--------|-------------|
| `testMesasCRUD` | Crear, listar, editar, activar/desactivar mesas |
| `testMesasValidacion` | Nombre único rechazado |
| `testEstadisticasPadron` | Totales y por mesa correctos |
| `testListarVotantesFiltros` | Búsqueda, filtro mesa, solo pendientes |
| `testValidarImportacion` | Preview detecta válidos, duplicados, DNI inválido, mesa inválida, nombre vacío |
| `testImportarVotantes` | Inserción, duplicados, mixto con errores |
| `testAnonNoAccesoPadron` | anon bloqueado en tablas y RPCs |

**Comando para ejecutar:**
```bash
cd webapp
supabase start
# Aplicar schema.sql + 001_security_hardening.sql + 002_mesas_padron.sql
cp .env.test.example .env.test  # completar con keys locales
node tests/fase2.test.js
```

---

## Decisiones de diseño

| Tema | Decisión | Razón |
|------|----------|-------|
| **Soft delete mesas** | Campo `activo` boolean | Preserva integridad referencial; votantes históricos conservan mesa |
| **CSV nativo (sin librería)** | Parsing manual simple | Evita dependencia pesada (`xlsx` ~2MB); Excel puede exportarse a CSV |
| **Importación via RPC** | `importar_votantes(jsonb)` | Transacción atómica en BD; evita race conditions; validación centralizada |
| **Preview separado** | `validar_importacion_votantes` | UX: usuario ve errores antes de confirmar; no modifica BD |
| **Paginación server-side** | RPC con `limit/offset` | Escalable; no carga todo el padrón en memoria |
| **Estadísticas via RPC** | Agregación en BD | Rendimiento; evita transferir miles de filas al cliente |

---

## Limitaciones conocidas / Pendientes

1. **Excel real (.xlsx)**: No implementado. Requiere librería `xlsx` o `sheetjs`. Documentado en UI.
2. **Drag & drop archivo**: Solo input nativo. Mejorable en UX futura.
3. **Exportar padrón**: No implementado (fase posterior).
4. **Editar/Eliminar votante individual**: No en UI actual (solo importación masiva). Puede agregarse si necesario.
5. **Pruebas automatizadas**: Requieren Docker + Supabase local. Documentado en `tests/fase2.test.js`.
6. **Rate limiting importación**: No aplicado (solo admin, uso esporádico). Si se expone a más usuarios, considerar.

---

## Migraciones a aplicar (orden)

```sql
-- 1. Esquema base
-- webapp/supabase/schema.sql

-- 2. Seguridad Fase 1
-- webapp/supabase/migrations/001_security_hardening.sql

-- 3. Mesas y Padrón Fase 2
-- webapp/supabase/migrations/002_mesas_padron.sql
```

### Verificación post-migración
```sql
-- Verificar campos nuevos
SELECT column_name FROM information_schema.columns WHERE table_name = 'mesas' AND column_name = 'activo';

-- Verificar funciones
SELECT proname FROM pg_proc WHERE proname IN (
  'obtener_estadisticas_padron',
  'listar_votantes',
  'validar_importacion_votantes',
  'importar_votantes'
);

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'votantes' AND indexname LIKE 'idx_votantes_%';
```

---

## Próximos pasos (Fase 3+)

- Kiosco de votación (`/votar`) con Edge Function rate limiting
- Registro de voto via `emitir_voto_con_limite`
- Resultados en vivo con Supabase Realtime
- Generación de acta PDF
- PWA / modo offline

---

**Fecha:** 2026-10-21  
**Estado:** **IMPLEMENTADO Y COMPILADO** — Pendiente verificación en BD local (requiere Docker)