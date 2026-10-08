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

**Pendiente manual del usuario:** ejecutar `webapp/supabase/schema.sql` en SQL Editor y crear el usuario admin en Authentication → Users. Tener `webapp/.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Fases PENDIENTES 🔲

| Fase | Descripción |
|---|---|
| 5. Mesas | CRUD de mesas/salones en panel admin |
| 6. Padrón electoral | Importar alumnos desde Excel/CSV (reusar lógica del Flutter: `votante_excel_row.dart`, `importar_votantes_use_case.dart`). Validar DNI 8 dígitos, asignar mesa |
| 7. Configuración elección | Abrir/cerrar votación (`configuracion.eleccion_abierta`), título |
| 8. Pantalla kiosco `/votar` | Flujo: ingresar DNI (numpad) → `verificar_votante` → mostrar candidatos activos → confirmar → `emitir_voto` → pantalla "¡Gracias!" → reset. Pública (anon), fuera del panel admin |
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
