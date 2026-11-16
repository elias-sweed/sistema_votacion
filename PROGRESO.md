# Sistema de Votación Web — Contexto de Migración

**Proyecto:** I.E. Jimenez Pimentel (Primaria) — votaciones digitales.
**Repo:** https://github.com/elias-sweed/sistema_votacion
**Rama activa:** `migracion-react` (Flutter Desktop original intacto en `main`)
**Stack web:** React 19 + Vite 7 + TypeScript + Tailwind v4 + Supabase + Vercel + GitHub

---

## Estructura actual del repo

```
sistema_votacion/
├── lib/, pubspec.yaml, ...   ← App Flutter ORIGINAL (no tocar)
├── webapp/                   ← NUEVA app web React
│   ├── src/
│   │   ├── App.tsx                    ← sesión + rutas protegidas
│   │   ├── lib/supabase.ts            ← cliente Supabase
│   │   └── features/
│   │       ├── auth/LoginPage.tsx     ← login admin (Supabase Auth)
│   │       ├── panel/PanelPage.tsx    ← layout panel + nav
│   │       └── candidatos/CandidatosPage.tsx
│   └── supabase/schema.sql            ← esquema + RLS + funciones
```

## Decisiones tomadas (no revertir sin preguntar)

1. **Un solo admin** (el dueño del proyecto). Login con Supabase Auth (email+password). NO hay tabla `admin` propia ni contraseñas en BD.
2. **Voto anónimo y secreto:** la tabla `votos` NO guarda DNI ni timestamp. Solo `candidato_id` + `mesa_id`.
3. **Kioscos con rol `anon` de Supabase:** NO tienen políticas directas sobre tablas. Solo ejecutan:
   - `verificar_votante(p_dni)` → devuelve nombre/mesa/puede_votar sin exponer el padrón.
   - `emitir_voto(p_dni, p_candidato_id)` → transacción atómica: valida elección abierta, DNI válido y no usado, candidato activo; marca `ha_votado` e inserta voto.
4. **RLS activado en todas las tablas.** Rol `authenticated` = acceso total (admin). Rol `anon` = solo candidatos activos + las 2 funciones.
5. **Principios de código:** programación defensiva, guard clauses, funciones puras, inmutabilidad, idempotencia (doble clic no duplica votos), UI con 5 estados (loading/empty/error/success), validación inline, numpad para DNI.

---

## Fases COMPLETADAS ✅

| Fase | Estado | Detalle |
|---|---|---|
| 1. Rama y scaffold | ✅ | `migracion-react`, `webapp/` con Vite+React+TS+Tailwind v4 |
| 2. Supabase base | ✅ | `schema.sql` escrito: tablas (mesas, votantes, candidatos, votos, configuracion), RLS, funciones `verificar_votante`/`emitir_voto`, vista `resultados` |
| 3. Auth admin | ✅ | Login con Supabase Auth, rutas protegidas, signOut |
| 4. Módulo Candidatos | ✅ | CRUD básico (agregar, activar/desactivar), estados UI |
| 5. Mesas | ✅ | CRUD de mesas/salones + enlaces de kiosco |
| 6. Padrón electoral | ✅ | Importación CSV/Excel, alta manual, búsqueda, eliminación individual y masiva |
| 7. Configuración elección | ✅ | Abrir/cerrar votación, título, centro, logo, PIN de seguridad y zona peligrosa |
| 8. Pantalla kiosco `/votar` | ✅ | DNI con numpad → verificación → candidatos → confirmación → agradecimiento |

**Pendiente manual del usuario:** ejecutar `webapp/supabase/schema.sql` en SQL Editor y crear el usuario admin en Authentication → Users. Tener `webapp/.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Plan UI/UX (`webapp/PLAN_UI_UX.md`)

| Fase | Estado | Detalle |
|---|---|---|
| 1. Fundamentos | ✅ | Componentes base (`AdminCard`, `AdminButton`, `StatCard`, `SectionHeader`, `Badge`), tipografía Ubuntu Mono en el panel, dashboard sin fondos ASCII ni `MaskedHeading` |
| 2. Navegación | ✅ | Sidebar colapsable + top bar con breadcrumb y transiciones entre secciones |
| 3. Secciones | ✅ | Mesas simplificadas, candidatos con lista/galería editable, padrón en 2 filas con stepper de importación, configuración en pestañas |
| 4. Polish | ✅ | `AdminModal` con foco y tonos, textos de modales/toasts específicos, empty states con icono y CTA, `AdminSelect` propio |
| 5. Extras | ✅ | Mostrar/ocultar contraseña, atajos de teclado (`1`–`5`, `/`, `Esc`), acciones masivas en padrón, export CSV filtrado, toggle lista/galería |

**Detalles del cierre de UI/UX:**
- `Bungee Spice` quedó reservada al kiosco mediante `.font-display`; el panel usa Ubuntu Mono.
- Las acciones destructivas exigen confirmación con contraseña y PIN cuando corresponde.
- La eliminación masiva de votantes solo permite seleccionar a quienes aún no han votado (evita re-votación).
- El export CSV pagina de 200 en 200 porque `listar_votantes` limita `p_limit` a 200.
- La zona peligrosa ahora se desbloquea únicamente tras validar PIN + correo + contraseña del admin autenticado, y puede volver a bloquearse.

## Fases PENDIENTES 🔲

| Fase | Descripción |
|---|---|
| 9. Resultados en vivo | Vista `resultados` + Supabase Realtime en panel admin. Exportar acta PDF |
| 10. Robustez offline | vite-plugin-pwa + cola de votos en IndexedDB si se cae internet |
| 11. Modo quiosco | Instrucciones: `chrome --kiosk <url>/votar`, pantalla completa |
| 12. Deploy | Vercel con Root Directory = `webapp`, variables de entorno, dominio |
| 13. Datos de menores | Cumplir Ley 29733: borrar padrón post-elección, mínimizar datos |

## Comandos útiles

```bash
cd webapp
npm install
npm run dev        # desarrollo
npm run build      # verificar que compila
git checkout migracion-react
git push -u origin migracion-react
```

## Referencias del proyecto original (Flutter)

- Normalización de RNE/DNI: `lib/domain/value_objects/rne.dart`
- Importación Excel: `lib/data/models/votante_excel_row.dart`, `lib/domain/usecases/importar_votantes_use_case.dart`
- Flujo votante (DNI→candidato→confirmar): `lib/features/flujo_votante`
- Evitar doble voto ya existía: `ha_votado` en votantes
