# Operadores

Rol limitado para las cuatro cuentas ya creadas en Supabase Authentication.

## 1. Marcar las cuentas

Las cuatro cuentas ya están marcadas en App Metadata con `{"role":"operador"}`.
Si se agrega otra, edita la lista en `supabase/scripts/marcar_operadores.sql` y
ejecútalo en Supabase → SQL Editor. Después, esa persona debe cerrar sesión y
volver a ingresar.

El script registra un movimiento `alta` de operador por cada cuenta marcada y
es idempotente: al ejecutarlo otra vez no duplica esas filas. Su verificación
final debe devolver `filas_auditoria = 4`.

## 2. Aplicar la base de datos

Ejecutar **otra vez** en Supabase → SQL Editor (es idempotente):

1. `supabase/migrations/017_reparar_padron_grado_seccion.sql`
2. `supabase/migrations/018_operadores_auditoria.sql`

La 018 crea las políticas RLS limitadas, la tabla `auditoria_operador`, los
triggers y los RPC `listar_operadores`, `activar_operador` y
`desactivar_operador`. La pantalla Operadores usa esos RPC, así que **no
depende de que la Edge Function esté desplegada**.

## 3. Edge Function

La acción `operadores` se conservó en `voting-proxy` como ruta alternativa,
pero el panel ya no la usa. La Edge Function sí sigue siendo necesaria para el
respaldo de borrados; desplázala cuando tengas `SUPABASE_ACCESS_TOKEN`:

```powershell
npm run build:function-dashboard
npm run deploy:function
```

## Permisos

| Sección | Operador |
|---|---|
| Candidatos | Ver, agregar, editar, activar/desactivar. **No eliminar** |
| Mesa | Solo ver y copiar el enlace |
| Padrón | Ver, agregar, importar y eliminar |
| Inicio, Resultados, Configuración, Auditoría, Operadores | Sin acceso |

El menú del dock, las rutas y los atajos se filtran por rol. La UI oculta las
acciones no permitidas y la base de datos las verifica de nuevo.
