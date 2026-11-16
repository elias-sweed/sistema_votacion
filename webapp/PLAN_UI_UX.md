# 🎨 Plan UI/UX — Panel de Administración

> **Alcance:** Rediseño visual y de interacción de todo el panel admin (`/admin`).
> **Stack actual:** React 19 · Tailwind CSS 4 · Motion (Framer) · Hugeicons · Supabase.
> **Filosofía:** Dark-mode profesional, limpio, con **jerarquía visual clara**, feedback inmediato y cero ambigüedad.

---

## Tabla de contenidos

1. [Diagnóstico general — ¿Por qué se ve "raro"?](#1-diagnóstico-general)
2. [Sistema de diseño unificado](#2-sistema-de-diseño-unificado)
3. [Layout y navegación (PanelPage + Dock)](#3-layout-y-navegación)
4. [Dashboard / Inicio](#4-dashboard--inicio)
5. [Candidatos](#5-candidatos)
6. [Mesas / Salones](#6-mesas--salones)
7. [Padrón Electoral](#7-padrón-electoral)
8. [Configuración](#8-configuración)
9. [Login](#9-login)
10. [Modales y diálogos](#10-modales-y-diálogos)
11. [Toasts y feedback](#11-toasts-y-feedback)
12. [Comportamiento al interactuar](#12-comportamiento-al-interactuar)
13. [Accesibilidad y responsive](#13-accesibilidad-y-responsive)
14. [Priorización de la implementación](#14-priorización)

---

## 1. Diagnóstico general

### Problemas detectados

| Problema | Dónde se nota |
|---|---|
| **Inconsistencia visual entre secciones** | Dashboard usa `MagicBento` con efectos spotlight; Mesas y Padrón usan tarjetas planas simples; Candidatos usa `TiltedCard` 3D. Cada sección parece un proyecto diferente. |
| **Sobrecarga de efectos decorativos** | El fondo ASCII animado (`GradientASCIIBackground`), el título con `MaskedHeading` animado, las cards con parallax y tilt — todo compite por la atención. El admin necesita *leer datos*, no asombrarse. |
| **Fondo de texto "Bungee Spice" en headings** | La tipografía de display multicolor es impactante para una landing page, pero en un panel de trabajo genera ruido visual y es difícil de leer rápido. Los headings `h2`/`h3` dentro del panel heredan esa fuente decorativa. |
| **Dock tipo macOS pegado al fondo** | Ocupa ~112 px de espacio vertical fijo (`pb-40`). En pantallas pequeñas quita casi ¼ de la vista. Los labels son pequeños y el efecto de magnificación, aunque bonito, no aporta productividad. |
| **Botones sin jerarquía clara** | En Mesas hay 6 botones por tarjeta (Copiar enlace, Abrir kiosco, Regenerar, Editar, Activar/Desactivar, Eliminar) todos del mismo tamaño y estilo. No hay primario vs secundario vs peligroso. |
| **Labels y textos repetitivos / genéricos** | "¿Estás seguro?" como título de modal no dice qué va a pasar. Los mensajes de éxito/error son `<p>` planos sin icono ni estructura. |
| **Formularios sin agrupación visual** | El formulario de agregar votante (Padrón) tiene 6 campos en una sola fila `lg:grid-cols-6` que se ve aplastada. No hay separación lógica entre "datos de identidad" y "datos de ubicación". |
| **Tablas sin herramientas de gestión** | La tabla de votantes no tiene selección múltiple, no se puede editar/eliminar un votante, no hay export. |
| **Tarjetas de resumen (stats cards) sin consistencia** | Dashboard usa `MagicBento`; Mesas usa `ResumenTarjeta` custom; Padrón usa `<div>` inline. Tres formas distintas de mostrar la misma información. |
| **Modales raw, sin animaciones** | Los modales se muestran/ocultan con un toggle booleano (`confirmandoSalida && ...`), sin transición enter/exit, sin focus trap. |
| **Sin breadcrumb ni indicador de sección** | El único indicador es la descripción en `SUBTITULOS[vista]`, difícil de notar. |
| **Select nativos** | Los `<select>` de Grado/Sección usan el dropdown del OS, que en dark mode se ve fuera de lugar. |

---

## 2. Sistema de diseño unificado

### 2.1 Tokens de color

```
Primario          : #3b82f6 (blue-500)  — acciones principales
Primario hover    : #2563eb (blue-600)
Secundario        : rgba(255,255,255,0.06)  — botones neutros
Secundario hover  : rgba(255,255,255,0.12)
Destructivo       : #ef4444 (red-500)  — eliminar, cerrar
Destructivo hover : #dc2626 (red-600)
Éxito             : #10b981 (emerald-500)
Advertencia       : #f59e0b (amber-500)
Info              : #3b82f6 (blue-500)
Superficie        : #0a0f1a  — fondo de cards/panels
Superficie raised : #111827  — cards sobre fondo
Borde             : rgba(255,255,255,0.08)
Borde activo      : rgba(59,130,246,0.5)
Texto primario    : #f1f5f9 (slate-100)
Texto secundario  : #94a3b8 (slate-400)
Texto muted       : #64748b (slate-500)
```

### 2.2 Tipografía

| Uso | Familia | Peso | Tamaño |
|---|---|---|---|
| **Título del panel** (`h1`) | `Inter` o `Ubuntu Mono Bold` | 700 | 28–32 px |
| **Títulos de sección** (`h2`) | `Inter` / `Ubuntu Mono Bold` | 700 | 20–22 px |
| **Subtítulos** (`h3`) | `Ubuntu Mono` | 600 | 16–18 px |
| **Cuerpo / labels** | `Ubuntu Mono` | 400 | 14 px |
| **Captions / badges** | `Ubuntu Mono` | 500 | 11–12 px |

> **Cambio clave:** Eliminar `Bungee Spice` del panel admin. Reservarla solo para la pantalla de votación del kiosco donde el impacto visual sí es deseable. En el admin, los headings deben ser legibles y rápidos.

### 2.3 Espaciado y layout

- **Max-width del panel:** `max-w-6xl` (1152 px) en lugar de `max-w-5xl` — dar más respiro.
- **Padding lateral:** `px-6 sm:px-10`.
- **Gap entre secciones:** `gap-8` (32 px).
- **Radius de cards:** `rounded-2xl` (16 px) uniforme.
- **Radius de botones:** `rounded-xl` (12 px) uniforme.
- **Radius de inputs:** `rounded-xl` (12 px) uniforme.

### 2.4 Componentes reutilizables a crear

| Componente | Propósito |
|---|---|
| `AdminCard` | Contenedor de sección con border, blur, shadow estandarizado |
| `StatCard` | Tarjeta de KPI (número grande + label + indicador de cambio) |
| `AdminButton` | Botón con variantes: `primary`, `secondary`, `danger`, `ghost` |
| `AdminInput` | Input con label, helper text, contador, error integrado |
| `AdminSelect` | Select custom (dropdown con estilos dark-mode) |
| `AdminTable` | Tabla con header fijo, filas alternadas, hover row, acciones |
| `AdminModal` | Modal con animación enter/exit, focus trap, escape handler |
| `SectionHeader` | Título de sección + descripción + acciones alineadas a la derecha |
| `EmptyState` | Estado vacío con icono, texto y CTA |
| `ActionBar` | Barra de acciones para tablas (buscar, filtrar, acciones masivas) |
| `Badge` | Etiqueta de estado: activo/inactivo, votó/pendiente |

---

## 3. Layout y navegación

### Problema actual
El **Dock estilo macOS** en la parte inferior es vistoso, pero:
- Ocupa espacio valioso (necesita `pb-40` de padding en el contenido).
- Los ítems se agrandan con hover (magnification), lo cual es impreciso en pantallas táctiles.
- No escala bien con más secciones futuras.
- No muestra contexto de dónde estás (no breadcrumb).

### Propuesta: Sidebar colapsable + Top bar

```
┌──────────────────────────────────────────────────────┐
│ [≡]  Panel de Control        admin@correo.com  [👤]  │  ← Top bar (h-14)
├─────┬────────────────────────────────────────────────┤
│  🏠 │                                                │
│  👥 │  Contenido principal                           │
│  📋 │                                                │
│  📇 │                                                │
│  ⚙️ │                                                │
│     │                                                │
│ ─── │                                                │
│  🚪 │                                                │
│     │                                                │
└─────┴────────────────────────────────────────────────┘
       ↑ Sidebar (w-16 collapsed / w-56 expanded)
```

#### Detalles del sidebar:
- **Desktop (≥ 1024 px):** sidebar visible, colapsable con botón hamburger.
  - Colapsado: solo iconos (w-16), tooltip al hover.
  - Expandido: iconos + labels (w-56).
- **Mobile (< 1024 px):** sidebar oculto, se abre como drawer overlay desde la izquierda con el botón hamburger.
- **Indicador activo:** barra vertical azul de 3 px a la izquierda del ítem activo + fondo highlight sutil.
- **Transición:** `transform 200ms ease` al abrir/cerrar.

#### Detalles del top bar:
- Logo / nombre del sistema a la izquierda.
- **Breadcrumb:** `Panel > Mesas` para mostrar dónde estás.
- A la derecha: email del admin + botón de cerrar sesión (avatar con dropdown simple).

#### Beneficios:
- Libera todo el ancho para el contenido.
- Patrón familiar de aplicaciones web admin (como Supabase, Vercel, etc.).
- Escala a más secciones sin problema.
- Mejor touch-target en mobile.

### Alternativa: Si deseas mantener el Dock

Si prefieres conservar el estilo dock por identidad visual:
- Reducir la magnification a `0` (sin zoom en hover) para que sea estático.
- Reducir `panelHeight` a 56 px y el padding inferior del contenido a `pb-24`.
- Agregar un **breadcrumb arriba del contenido** debajo del título.
- Mostrar labels siempre (no solo on hover).

---

## 4. Dashboard / Inicio

### Problemas actuales
- `MagicBento` tiene efecto spotlight y glow que distraen de los números.
- Las cards de "Accesos rápidos" son redundantes (ya tienes el Dock/sidebar).
- No hay vista de "acciones pendientes" o "atención requerida".

### Propuesta

#### 4.1 Barra de estado de la elección
En la parte superior del dashboard, un banner compacto:
```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Elección abierta · "Elección de Municipios Escolares"   │
│    I.E. Jimenez Pimentel                     [Configurar →] │
└─────────────────────────────────────────────────────────────┘
```
- Fondo verde sutil si está abierta, ámbar si está cerrada.
- Link rápido a configuración.

#### 4.2 Grid de stats (4 columnas)
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Votantes │ │ Votaron  │ │Pendientes│ │Particip. │
│   156    │ │    89    │ │    67    │ │  57.1%   │
│ en padrón│ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```
- Usar `StatCard` uniforme: número grande (32 px), label debajo (12 px muted).
- Sin efectos de spotlight ni glow. Solo bordes y sombras sutiles.
- Color del número: blanco para general, emerald para "votaron", sky para "pendientes", blue para "participación".

#### 4.3 Gráfico de participación (opcional)
- Barra de progreso horizontal grande (h-3) debajo del grid de stats.
- `{votaron}` en verde y `{pendientes}` en gris, con porcentaje al lado.

#### 4.4 Grid secundario (2 columnas)
```
┌─────────────────────┐ ┌─────────────────────┐
│ Candidatos          │ │ Mesas               │
│ 5 activos de 6      │ │ 8 activas de 10     │
│ [Ver candidatos →]  │ │ [Ver mesas →]       │
└─────────────────────┘ └─────────────────────┘
```
- Cards clicables que navegan a la sección.
- Hover: borde azul sutil, elevación de sombra.

#### 4.5 Quitar
- Eliminar el componente `MagicBento` del dashboard. Es excelente para una landing page pero no para un panel de trabajo.
- Eliminar "Accesos rápidos" — son redundantes con el sidebar/dock.

---

## 5. Candidatos

### Problemas actuales
- El formulario de nuevo candidato y la vista previa de TiltedCard están lado a lado. En pantallas medianas se comprimen.
- No hay opción de **editar nombre** ni **eliminar** un candidato existente.
- Las TiltedCards con efecto 3D son bonitas pero los botones de acción están escondidos en el reverso de la card (hay que hacer flip).
- El grid `lg:grid-cols-3` deja tarjetas de 240 px en un contenedor de 1024 px — se ven pequeñas.

### Propuesta

#### 5.1 Formulario de nuevo candidato
- Card con dos zonas: **formulario a la izquierda** + **preview a la derecha** (mantener este layout pero mejorar proporciones).
- Input de nombre: mantener el diseño actual (está bien).
- Zona de foto: mantener drag & drop (está bien).
- Vista previa: **Simplificar.** En lugar de TiltedCard 3D, mostrar un preview estático con la foto + nombre superpuesto, tal como se ve en la papeleta real. Más útil y menos distractivo.

#### 5.2 Lista de candidatos existentes
Cambiar de **grid de TiltedCards** a una **lista/tabla de candidatos** más funcional:

```
┌──────────────────────────────────────────────────────────────────┐
│ 📸  María Fernanda Rojas              ● Activo     [···]       │
│     Agregado el 15 nov 2026                                     │
├──────────────────────────────────────────────────────────────────┤
│ 📸  Carlos Pérez Gutiérrez            ○ Inactivo   [···]       │
│     Agregado el 15 nov 2026                                     │
└──────────────────────────────────────────────────────────────────┘
```

- Cada fila: miniatura de foto (40 px circle), nombre, badge activo/inactivo, menú `[···]` (three-dot menu).
- **Menú contextual** `[···]`: Editar nombre · Cambiar foto · Activar/Desactivar · Eliminar.
- Hover en la fila: fondo sutil highlight.
- El estado activo/inactivo se muestra con un `Badge` (chip verde o gris).

#### 5.3 Interacciones
- **Clic en el toggle "Activar/Desactivar":** Cambio inmediato (optimistic update) + toast de confirmación.
- **Clic en "Editar nombre":** El nombre se convierte en un input inline (inline edit) — sin modal.
- **Clic en "Eliminar":** Modal de confirmación con texto: "¿Eliminar al candidato **María Fernanda Rojas**? Esta acción no se puede deshacer."

#### 5.4 Opción adicional: Vista galería toggle
- Un botón `[☰ Lista] [▦ Galería]` para alternar entre la vista lista (recomendada) y la vista de cards con fotos grandes (para quienes prefieran visual).

---

## 6. Mesas / Salones

### Problemas actuales
- **6 botones** por mesa todos en fila horizontal (`flex-wrap gap-2`), todos del mismo tamaño, sin jerarquía. Es confuso.
- El formulario de grado/sección usa `<datalist>` que se ve inconsistente entre navegadores.
- La tarjeta de resumen de votos por mesa (`ResumenTarjeta`) es buena, pero la barra de progreso "Del total de votos" no tiene mucho contexto.
- El modal de confirmación para agregar mesa es innecesario para una acción no destructiva.

### Propuesta

#### 6.1 Resumen superior
Mantener las 4 tarjetas de resumen pero usar `StatCard` unificado:
```
Mesas activas: 8/10 | En padrón: 156 | Ya votaron: 89 | Votos: 89
```

#### 6.2 Formulario simplificado
```
┌─────────────────────────────────────────────────────────────────┐
│ Agregar mesa                                                     │
│                                                                   │
│ Grado [▼ Select]    Sección [▼ Select]    [+ Agregar mesa]       │
│                                                                   │
│ ℹ️ Cada mesa recibe un enlace único para votación.               │
└─────────────────────────────────────────────────────────────────┘
```
- **Reemplazar `<datalist>`** por `AdminSelect` custom con opciones visibles.
- **Eliminar modal de confirmación** para agregar mesa (no es destructivo). Agregar directamente al hacer clic.
- El aviso de privacidad moverlo a un tooltip (ℹ️) o colapsable, no a un banner visible siempre.

#### 6.3 Lista de mesas — Tarjetas rediseñadas

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1° A                                           ● Activa            │
│ Enlace: …a7f3b2 · 12 votos (13.5% del total)                      │
│ ███████░░░░░░░░                                                    │
│                                                                     │
│ [📋 Copiar enlace]  [🔗 Abrir kiosco]          [···]               │
└─────────────────────────────────────────────────────────────────────┘
```

**Jerarquía de acciones:**
1. **Primarias (siempre visibles):**
   - `Copiar enlace` — botón con icono, estilo `primary ghost` (texto azul, sin fondo).
   - `Abrir kiosco` — botón con icono, estilo `secondary`.
2. **Secundarias (en menú `[···]`):**
   - Editar nombre
   - Regenerar enlace
   - Activar / Desactivar
   - ────────── (separador)
   - Eliminar mesa (texto rojo)

Esto reduce los botones visibles de 6 a 2 + un menú. Mucho más limpio.

#### 6.4 Interacciones
- **Copiar enlace:** Clic → el texto del botón cambia a "✓ Copiado" por 2 s + toast.
- **Abrir kiosco:** Abre en nueva pestaña.
- **Regenerar enlace:** Modal de advertencia (el enlace actual deja de funcionar).
- **Eliminar:** Modal con campo de contraseña (mantener seguridad actual).
- **Editar nombre:** Inline edit (clic → el nombre se vuelve input → Enter para guardar, Escape para cancelar).

---

## 7. Padrón Electoral

### Problemas actuales
- El formulario de alta manual tiene 6 campos en una fila `lg:grid-cols-6` que se ve aplastada — los inputs quedan de ~120 px de ancho.
- La tabla de votantes no tiene acciones por fila (no se puede editar ni eliminar un votante).
- Los mensajes de error/éxito son `<p>` planos al fondo de la sección, fáciles de no ver.
- El importador CSV funciona pero su UI es básica — los pasos no se visualizan como flujo.

### Propuesta

#### 7.1 Stats del padrón
Mantener el grid de 4 stats pero unificar con `StatCard`:
```
Total: 156 | Votaron: 89 (emerald) | Pendientes: 67 (sky) | Participación: 57.1% (blue)
```

#### 7.2 Barra de filtros + búsqueda
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 [Buscar por DNI o nombre...          ]   ☐ Solo pendientes     │
│                                                                     │
│ Mostrando 50 de 156 votantes                           Pág. 1 de 4 │
└─────────────────────────────────────────────────────────────────────┘
```
- Mover la barra de búsqueda y filtros **arriba de la tabla**, no en una card separada.
- El contador de resultados y la paginación van integrados.

#### 7.3 Formulario de alta manual — Reorganizado

```
┌─────────────────────────────────────────────────────────────────────┐
│ Agregar votante                                                      │
│                                                                       │
│ ┌─ Identificación ──────────────────────────────────────────────┐   │
│ │ DNI [________]   Nombre [________________]   Apellido [_____]│   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌─ Ubicación (opcional) ────────────────────────────────────────┐   │
│ │ Grado [▼ Select]                Sección [▼ Select]           │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│                                               [+ Agregar votante]    │
└─────────────────────────────────────────────────────────────────────┘
```

- **2 filas** en lugar de 1 fila de 6 columnas.
- Primera fila: datos obligatorios (DNI + Nombre + Apellido) en `grid-cols-3`.
- Segunda fila: datos opcionales (Grado + Sección) en `grid-cols-2` con label visual "Opcionales".
- Botón alineado a la derecha debajo.

#### 7.4 Importación CSV — Con stepper visual

```
 ① Archivo  ──→  ② Validación  ──→  ③ Resultado
    ●              ○                   ○
```

- Un stepper horizontal arriba del bloque de importación.
- Paso 1: Upload con drag & drop (mantener estilo actual pero dentro de un `AdminCard`).
- Paso 2: Tabla de preview con resumen `{válidos} / {inválidos}`.
- Paso 3: Resultado con resumen y botón "Nueva importación".

#### 7.5 Tabla de votantes — Mejorada

- **Hover row:** `bg-white/[0.03]` en hover.
- **Acciones por fila:** Un botón `[···]` al final de cada fila → menú con: Editar datos · Eliminar votante.
- **Selección múltiple (futuro):** Checkboxes a la izquierda para acciones masivas.
- **Columna estado mejorada:** Badge con ícono (`✓ Votó` verde / `◷ Pendiente` azul).

---

## 8. Configuración

### Problemas actuales
- La sección es demasiado larga: estado de la elección + datos del centro + logo + modo ensayo + PIN + eliminar datos + borrar todo — todo en scroll vertical.
- Los botones de "Eliminar todos los votantes/candidatos/centro" están en un grid sin diferenciación visual de peligro.
- "Borrar TODO de todo" (el nombre) es informal para una acción nuclear.

### Propuesta

#### 8.1 Separar en sub-secciones con tabs o acordeones

```
Configuración
├── General (estado de la elección + datos del centro)
├── Seguridad (PIN + modo ensayo)
└── Zona peligrosa (eliminar datos)
```

**Opción A — Tabs internos:**
```
[ General ]  [ Seguridad ]  [ Zona peligrosa ]
```

**Opción B — Acordeones colapsables:** Cada subsección es un acordeón. "Zona peligrosa" empieza colapsada.

Recomendación: **Opción A (Tabs)** — más limpio y claro.

#### 8.2 Tab "General"

```
┌─────────────────────────────────────────────────────────────────┐
│ Estado de la elección                                            │
│                                                                   │
│ 🟢 Elección abierta                                             │
│ Los kioscos con enlace válido pueden registrar votos.            │
│                                              [🔴 Cerrar elección]│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Datos del centro                                                 │
│                                                                   │
│ Título      [Elección de Municipios Escolares        ]          │
│ Centro      [I.E. Jimenez Pimentel                   ]          │
│ Logo        [📷 Arrastrar o seleccionar...]                     │
│                                                                   │
│                                          [💾 Guardar cambios]    │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.3 Tab "Seguridad"

```
┌─────────────────────────────────────────────────────────────────┐
│ PIN de seguridad                                                 │
│ Segundo factor para acciones destructivas.                       │
│                                                                   │
│ Estado: ✓ Configurado                     [Cambiar PIN]          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Modo ensayo                                                      │
│ Prueba el sistema sin afectar datos reales.                      │
│                                                                   │
│ [Toggle ○ / ●]  Modo ensayo desactivado                          │
│                                                                   │
│ ℹ️ Los cambios se guardan solo en memoria.                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.4 Tab "Zona peligrosa"

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Zona peligrosa                                               │
│ Estas acciones son irreversibles y requieren tu contraseña       │
│ de administrador + PIN de seguridad.                             │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Eliminar padrón completo                                    │ │
│ │ Borra todos los votantes registrados.        [Eliminar →]   │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Eliminar todos los candidatos                               │ │
│ │ Borra todas las opciones de votación.        [Eliminar →]   │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Restablecer centro educativo                                │ │
│ │ Título, I.E y logo vuelven al predeterminado. [Restablecer]│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☢️ Reinicio total del sistema                               │ │
│ │ Elimina TODO: votantes, candidatos, mesas, votos y         │ │
│ │ restablece la configuración.                                │ │
│ │                                          [Reinicio total →] │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- Borde rojo sutil en toda la sección.
- Cada acción es una fila con descripción + botón alineado a la derecha.
- El botón de "Reinicio total" va separado con más espacio y borde doble rojo.
- Textos más formales: "Reinicio total del sistema" en vez de "Borrar TODO de todo".

---

## 9. Login

### Estado actual
- Está bastante bien diseñado (SpotlightCard, icono de escudo, gradientes).
- Cambios menores recomendados.

### Propuesta
- **Mantener** el diseño actual con los siguientes ajustes:
  - Cambiar `h1` de `Bungee Spice` a la fuente del sistema (Inter o Ubuntu Mono Bold) con gradient text.
  - Agregar **"mostrar/ocultar contraseña"** con ícono de ojo.
  - Agregar **feedback visual en el botón** cuando está cargando (spinner + texto "Ingresando…").
  - Mantener el `SpotlightCard` — se ve profesional aquí.

---

## 10. Modales y diálogos

### Diseño unificado del `AdminModal`

```
┌─────────────────────────────────────────────┐
│                                             │
│  [🔴]  Eliminar mesa 1° A                  │
│                                             │
│  Se borrará la mesa y su enlace.            │
│  Esta acción no se puede deshacer.          │
│                                             │
│  ┌─ Contraseña ──────────────────────────┐  │
│  │ [••••••••                          ]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ PIN de seguridad ────────────────────┐  │
│  │ [••••                              ]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│       [Cancelar]          [Eliminar mesa]   │
│                                             │
└─────────────────────────────────────────────┘
```

### Reglas de diseño de modales

| Aspecto | Especificación |
|---|---|
| **Ancho** | `max-w-md` (448 px) |
| **Fondo** | `bg-slate-900/95 backdrop-blur-xl` |
| **Borde** | `border border-white/12` |
| **Radio** | `rounded-2xl` |
| **Overlay** | `bg-black/60 backdrop-blur-sm` |
| **Icono** | Circular (40 px) con color semántico (rojo para destructivo, azul para info, verde para éxito) |
| **Título** | `text-lg font-semibold text-white` |
| **Descripción** | `text-sm text-slate-400` |
| **Botones** | Cancelar (secondary) a la izquierda, acción primaria a la derecha |
| **Botón destructivo** | Gradiente rojo, texto blanco |
| **Animación enter** | Scale 0.95 → 1.0 + opacity 0 → 1 (200 ms ease-out) |
| **Animación exit** | Scale 1.0 → 0.98 + opacity 1 → 0 (150 ms ease-in) |
| **Focus trap** | El foco queda dentro del modal, Tab cicla entre campos y botones |
| **Escape** | Cierra el modal (si no está procesando) |
| **Clic en overlay** | Cierra el modal (si no está procesando) |

### Textos de modal — Mejoras

| Actual | Propuesto |
|---|---|
| "¿Estás seguro?" | "Agregar mesa **1° A**" |
| "Borrar TODO de todo" | "Reinicio total del sistema" |
| "Sí, eliminar todo" | "Confirmar eliminación" |
| "Sí, borrar todo de todo" | "Confirmar reinicio total" |
| "Sí, agregar" | "Agregar mesa" |

---

## 11. Toasts y feedback

### Estado actual
- El `SwipeToast` existente es bueno técnicamente (swipe to dismiss, fuse timer).
- Pero los mensajes podrían tener más contexto.

### Propuesta de mejoras

#### Variantes de toast con iconos

| Variante | Icono | Color fondo | Color fuse |
|---|---|---|---|
| `success` | ✓ (checkmark) | `#064e3b` (emerald-950) | `#10b981` |
| `error` | ✕ (x-circle) | `#450a0a` (red-950) | `#ef4444` |
| `warning` | ⚠ (alert) | `#451a03` (amber-950) | `#f59e0b` |
| `info` | ℹ (info) | `#0c1a3d` (blue-950) | `#3b82f6` |

#### Textos de toast mejorados

| Acción | Título | Descripción |
|---|---|---|
| Candidato activado | "Candidato activado" | "**María Fernanda Rojas** ahora aparece en la papeleta." |
| Mesa eliminada | "Mesa eliminada" | "**1° A** fue eliminada permanentemente." |
| Enlace copiado | "Enlace copiado" | "El enlace de **1° A** está en el portapapeles." |
| Error de red | "Sin conexión" | "Verifica tu conexión a internet e intenta de nuevo." |
| Importación exitosa | "Importación completada" | "89 votantes agregados · 3 duplicados omitidos." |

---

## 12. Comportamiento al interactuar

### 12.1 Clicks y acciones

| Elemento | Comportamiento al hacer clic |
|---|---|
| **Ítem del sidebar/dock** | Transición suave del contenido (fade 150 ms). Indicador activo se mueve al ítem. URL cambia (`/admin/mesas`). |
| **StatCard en dashboard** | Cursor pointer → Navega a la sección correspondiente. Hover: borde azul + elevación de sombra. |
| **Botón primario (Agregar candidato, etc.)** | Cursor pointer. Hover: `brightness-110`. Active: `scale(0.98)` por 100 ms. Disabled: opacity 40%, cursor not-allowed. |
| **Botón destructivo** | Siempre abre un modal de confirmación. Nunca ejecuta directamente. |
| **Fila de tabla** | Hover: `bg-white/[0.03]`. No es clicable a menos que tenga acción. |
| **Menú `[···]`** | Abre dropdown hacia abajo/arriba (según espacio). Items con iconos a la izquierda. Items destructivos en rojo al final, separados por línea. |
| **Toggle (Activar/Desactivar)** | Cambio inmediato (optimistic update). Si falla, revert automático + toast de error. |
| **Inline edit** | Clic en "Editar" → el campo de texto se convierte en input con borde azul. Enter = guardar. Escape = cancelar. Blur = guardar. |
| **Copy to clipboard** | El botón cambia texto a "✓ Copiado" por 2 s. Toast de confirmación. |

### 12.2 Estados de carga

| Situación | Feedback visual |
|---|---|
| **Carga inicial de sección** | Skeleton loaders (mantener los actuales, son buenos). |
| **Enviando formulario** | Botón cambia a "Guardando…" con spinner. Inputs se deshabilitan. |
| **Acción en tabla** | Fila con opacity 50% + spinner en la celda de acciones. |
| **Modal procesando** | Ambos botones disabled. Botón primario muestra "Procesando…". |

### 12.3 Estados vacíos

| Sección | Empty state |
|---|---|
| **Candidatos** | Ilustración sutil + "Aún no hay candidatos. Agrega el primero para que aparezca en la papeleta." + botón "Agregar candidato". |
| **Mesas** | "No hay mesas configuradas. Crea la primera para generar un enlace de votación." + botón "Agregar mesa". |
| **Padrón** | "El padrón está vacío. Importa un CSV o agrega votantes manualmente." + dos botones. |

### 12.4 Confirmaciones inteligentes

- **Acciones no destructivas** (agregar candidato, agregar mesa): **Sin modal de confirmación.** Ejecutar directamente + toast de éxito + opción "Deshacer" en el toast por 5 s.
- **Acciones semi-destructivas** (desactivar candidato, desactivar mesa): **Sin modal.** Optimistic update + toast con "Deshacer".
- **Acciones destructivas** (eliminar mesa, eliminar todo): **Modal con contraseña/PIN.** Mantener la seguridad actual.
- **Acciones críticas** (cerrar elección, reinicio total): **Modal con doble confirmación** (contraseña + PIN).

### 12.5 Keyboard shortcuts (mejora futura)

| Shortcut | Acción |
|---|---|
| `1–5` | Navegar a sección 1–5 en el sidebar |
| `n` | Nuevo (candidato/mesa/votante según sección) |
| `/` | Focus en búsqueda |
| `Escape` | Cerrar modal / Cancelar edición |

---

## 13. Accesibilidad y responsive

### 13.1 Accesibilidad

| Requisito | Implementación |
|---|---|
| **Focus visible** | Outline `2px solid blue-400` con `offset 3px` en todos los interactivos. |
| **Roles ARIA** | Modales con `role="dialog"` + `aria-modal` (ya existe, mantener). |
| **Anuncio de cambios** | `aria-live="polite"` en zonas que cambian (stats, tabla). |
| **Labels** | Todo input con `<label>` asociado por `htmlFor`. |
| **Contraste** | Texto slate-400 (#94a3b8) sobre fondo #0a0f1a = ratio ~6:1 ✓. |
| **Touch targets** | Mínimo 44×44 px para botones en mobile. |

### 13.2 Responsive breakpoints

| Breakpoint | Adaptación |
|---|---|
| **< 640 px** (sm) | Sidebar como drawer. Stats en 2 cols. Tabla scroll horizontal. Formularios en 1 col. Botones full-width. |
| **640–1023 px** (md) | Sidebar como drawer. Stats en 2-4 cols. Tabla visible. Formularios en 2 cols. |
| **≥ 1024 px** (lg) | Sidebar visible (colapsable). Stats en 4 cols. Todo horizontal. |
| **≥ 1280 px** (xl) | Sidebar expandido por defecto. Más padding lateral. |

---

## 14. Priorización

### Fase 1 — Fundamentos (impacto alto, esfuerzo medio)
1. **Crear sistema de componentes**: `AdminCard`, `AdminButton`, `StatCard`, `SectionHeader`, `Badge`.
2. **Reemplazar tipografía**: Quitar `Bungee Spice` del panel. Usar Ubuntu Mono Bold o Inter para headings.
3. **Quitar `GradientASCIIBackground`** del panel admin (mantenerlo en login y kiosco si se desea).
4. **Quitar `MaskedHeading`** del panel. Título simple con texto.
5. **Rehacer el Dashboard**: Grid de `StatCard` + cards de navegación. Sin `MagicBento`.

### Fase 2 — Navegación (impacto alto, esfuerzo alto)
6. **Reemplazar Dock** por sidebar colapsable + top bar con breadcrumb.
7. **Agregar transiciones** entre secciones (fade/slide).

### Fase 3 — Secciones (impacto medio, esfuerzo medio)
8. **Mesas**: Reducir botones a 2 + menú `[···]`. Quitar modal para agregar.
9. **Candidatos**: Lista funcional en vez de TiltedCards. Acciones de editar/eliminar.
10. **Padrón**: Reorganizar formulario en 2 filas. Stepper de importación.
11. **Configuración**: Separar en tabs (General / Seguridad / Zona peligrosa).

### Fase 4 — Polish (impacto medio, esfuerzo bajo)
12. **Crear `AdminModal`** con animaciones y focus trap.
13. **Mejorar textos** de modales y toasts (más específicos y descriptivos).
14. **Mejorar empty states** con ilustraciones o iconos y CTA.
15. **Selects custom** en reemplazo de `<select>` nativos y `<datalist>`.

### Fase 5 — Extras (impacto bajo, esfuerzo variable)
16. **Botón mostrar/ocultar contraseña** en login y modales.
17. **Keyboard shortcuts**.
18. **Acciones masivas** en tabla del padrón (seleccionar + eliminar múltiples).
19. **Export CSV** del padrón.
20. **Toggle lista/galería** en candidatos.

---

> **Nota:** Este plan es solo de diseño y recomendaciones. No incluye implementación de código. Cuando estés listo para comenzar, podemos ejecutar fase por fase.
