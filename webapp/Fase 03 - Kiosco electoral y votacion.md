# Fase 03 — Kiosco electoral y votación

## 1. Estado inicial y auditoría

La revisión previa a la implementación confirmó:

- La aplicación solo tenía `/login` y el panel `/`; no había pantalla ni ruta de kiosco.
- El esquema real registra apertura/cierre en `configuracion.eleccion_abierta` y título en `configuracion.titulo`. `votantes.ha_votado` controla si el DNI ya emitió voto.
- El esquema define `candidatos` con `id`, `nombre`, `foto_url` y `activo`; no existe otro criterio de elegibilidad.
- La política pública de lectura de candidatos activos está comentada en la migración 001; el navegador anónimo no debe consultar directamente esa tabla.
- La Edge Function `supabase/functions/voting-proxy/index.ts` ya invocaba los wrappers `verificar_votante_con_limite` y `emitir_voto_con_limite` con `service_role`. Ningún componente React la usaba.
- La migración 004 restringe las RPC base y reserva los wrappers para `service_role`; por eso el navegador no debe invocar esas funciones ni leer configuración directamente.
- No había cliente de pruebas de interfaz ni un entorno Supabase local disponible. No se asumieron resultados de pruebas de base de datos.

## 2. Funcionalidades implementadas

- Ruta pública `/votar`, separada del panel administrativo. El panel `/` exige sesión con `app_metadata.role = 'admin'`; un usuario con sesión normal es dirigido al kiosco.
- El kiosco consulta el estado/título y los candidatos por acciones de `voting-proxy`; la acción `candidatos` solo devuelve filas activas y los campos `id`, `nombre` y `foto_url`. No se amplió RLS para acceso anónimo.
- El flujo incluye entrada de DNI, validación de ocho dígitos, consulta de elegibilidad, confirmación mínima de identidad, selección única de candidato, pantalla de revisión y confirmación final.
- Al confirmar, la única ruta utilizada es `supabase.functions.invoke('voting-proxy', ...)`. No se llaman desde React las RPC base ni los wrappers protegidos.
- El servidor vuelve a validar DNI, candidato, estado electoral y voto previo; el bloqueo atómico existente en `emitir_voto` permanece sin cambios.
- Se bloquea el doble clic en interfaz. Una respuesta exitosa muestra confirmación inequívoca y limpia el DNI, la identidad y la selección de memoria. No se guarda estado de votante o voto en almacenamiento persistente.
- Una respuesta de red o inesperada durante el envío se considera ambigua: la pantalla borra los datos y no reintenta. Indica solicitar verificación al personal, en lugar de afirmar que hubo éxito o fracaso.
- La respuesta pública de verificación ya no incluye mesa. En la confirmación de la opción no se muestra la identidad del votante.
- No se implementaron conteo público, resultados en vivo, acta ni reglas electorales nuevas.

## 3. Archivos creados y modificados

| Archivo | Cambio |
|---|---|
| `src/App.tsx` | Ruta `/votar` y guard de panel administrativo por claim admin |
| `src/features/voting/VotingKioskPage.tsx` | Flujo accesible del kiosco y estados de proceso |
| `src/features/voting/votingService.ts` | Consultas tipadas a Edge Function, validación y clasificación de errores |
| `src/index.css` | Estados visibles de botones y foco para controles del kiosco |
| `supabase/functions/voting-proxy/index.ts` | Acción de estado electoral, validación de payload, respuesta de verificación sin mesa y manejo explícito de errores |
| `tests/voting.test.js` | Pruebas de integración locales del kiosco y del proxy |
| `tests/voting-static.test.js` | Pruebas locales de secretos en frontend, uso del proxy y minimización de respuesta |
| `tests/security_privileges.sql` | Comprueba permisos esperados de `anon`, `authenticated` y `service_role` |
| `Cambios nuevos.md` | Entrada histórica de la Fase 03 |

## 4. Cambios de base de datos y migraciones

No se añadieron tablas ni columnas, no se alteró RLS y no se creó una nueva migración. La apertura/cierre sigue siendo el booleano existente `configuracion.eleccion_abierta`; el envío del voto continúa sujeto a su comprobación atómica en el servidor. La migración 004 no se reescribió ni se cambiaron sus permisos.

## 5. Pruebas ejecutadas y resultados reales

| Comprobación | Resultado |
|---|---|
| `npm run build` | Pasó (Vite generó el build); reportó aviso de chunk JavaScript superior a 500 kB |
| `npx tsc --noEmit` | Pasó |
| `node --check tests/security.test.js`, `tests/fase2.test.js`, `tests/voting.test.js`, `tests/voting-static.test.js` | Pasó |
| `node --test tests/voting-static.test.js` | Pasó: 4 pruebas (sin service role en frontend, sin RPC base en navegador, separación de identidad y respuesta de éxito minimizada) |
| `git diff --check` | Pasó |
| Búsqueda de `SUPABASE_SERVICE_ROLE_KEY`, `service_role` y RPC base de votación dentro de `src/` | Sin coincidencias |
| `node tests/voting.test.js` | No ejecutable: abortó porque faltan variables locales `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.test` |

Las pruebas de integración de base de datos y Edge Function no se ejecutaron: no existe `.env.test` y no están disponibles Docker, Supabase CLI ni `psql`. No se declaran aprobadas.

## 6. Pruebas pendientes y motivos

Ejecutar en un entorno Supabase local controlado, nunca con credenciales de producción:

1. Aplicar el esquema y las migraciones 001–004.
2. Configurar `.env.test` con la URL `localhost` y las claves locales anon/service_role.
3. Servir `voting-proxy` localmente con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de esa instancia local.
4. Ejecutar `node tests/voting.test.js`, `node tests/security.test.js` y `node tests/fase2.test.js`.
5. Ejecutar `tests/security_privileges.sql` con `psql` contra la base local.
6. Hacer prueba manual de interfaz con votante fixture en elección abierta y cerrada.

La suite de integración verifica DNI vacío e inválido, DNI inexistente, ya votado, elección cerrada, exposición de candidatos activos (y exclusión de inactivos), confirmación backend, reintento/duplicado, solicitudes concurrentes, respuesta sin vínculo de DNI/voto y llamadas directas bloqueadas. No se prueba automáticamente el render/selección de interfaz, error de red ambiguo ni el estado global sin candidatos activos porque no hay runner de navegador/componentes configurado. No debe cambiarse la elección global ni eliminar candidatos existentes para simular esos casos en una base compartida.

## 7. Riesgos y decisiones que requieren revisión

- **No listo para una elección real hasta aplicar y probar las migraciones y la Edge Function en Supabase local y después validar el despliegue.**
- El límite por IP depende del encabezado que el gateway confiable entregue a `voting-proxy`. La función todavía usa `x-forwarded-for`/`x-real-ip`; hay que confirmar en el despliegue que el cliente no pueda falsificar el valor empleado por el rate limit.
- La acción de consulta de estado y la lista de candidatos se sirven a visitantes públicos por diseño. Debe revisarse que publicar título, apertura y candidatos activos concuerde con las reglas de la institución.
- La foto de candidato se carga desde `foto_url` guardada por administración; el navegador hace una petición al host de esa URL.
- La respuesta de red al enviar un voto puede ser ambigua. La aplicación no reintenta; el personal debe comprobar el estado del votante antes de autorizar cualquier acción posterior. La prevención final de doble voto depende del mecanismo transaccional de PostgreSQL.
- La asignación/revocación del claim admin y el tiempo de expiración de JWT siguen siendo procesos administrativos externos al kiosco.

## 8. Prueba manual completa

1. En una instalación local, aplicar `schema.sql` y las migraciones 001–004; crear candidatos activos, asignar un DNI de prueba al padrón y abrir `configuracion.eleccion_abierta`.
2. Configurar los secretos locales de la Edge Function y servir `voting-proxy`. No colocar la service role key en variables `VITE_*`.
3. Iniciar la aplicación y abrir `/votar`. Comprobar que solo aparecen candidatos activos.
4. Intentar DNI vacío, formato inválido, uno inexistente y uno previamente votado. Confirmar mensajes sin datos de mesa/padrón.
5. Ingresar un DNI habilitado, confirmar identidad y comprobar que la pantalla de selección ya no muestra el nombre del votante.
6. Seleccionar una opción y avanzar a la revisión. Comprobar que aún no se ha registrado el voto.
7. Confirmar una vez y verificar la confirmación de éxito; en la base, comprobar `ha_votado = true` y un único voto sin DNI asociado.
8. Repetir la operación con el mismo DNI y comprobar que la base/restricción de voto previo la rechaza.
9. Probar con elección cerrada y sin candidato activo en un entorno aislado de fixtures; no modificar candidatos ni estado de una elección real.
10. Simular pérdida de respuesta en un entorno de prueba: el kiosco debe presentar resultado ambiguo, borrar los datos en pantalla y no reenviar automáticamente.
