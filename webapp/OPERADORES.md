# Operadores

Rol limitado para las cuatro cuentas ya creadas en Supabase Authentication.

## 1. Marcar las cuentas

Edita la lista de correos en `supabase/scripts/marcar_operadores.sql` y ejecútalo en
Supabase → SQL Editor. El rol va en **App Metadata**: `{"role":"operador"}`.
Después, cada operador debe cerrar sesión y volver a ingresar.

## 2. Aplicar la base de datos

Ejecutar en este orden en Supabase → SQL Editor:

1. `supabase/migrations/017_reparar_padron_grado_seccion.sql`
2. `supabase/migrations/018_operadores_auditoria.sql`

La 018 crea las políticas RLS limitadas, la tabla `auditoria_operador` y los
triggers que registran altas, ediciones, activaciones, desactivaciones y borrados.

## 3. Desplegar la Edge Function

```powershell
npm run build:function-dashboard
npm run deploy:function
```

La acción `operadores` de `voting-proxy` solo responde a un JWT con
`app_metadata.role = 'admin'`. Desactiva una cuenta con `ban_duration` y revoca
sus sesiones; activarla vuelve a permitir el ingreso. Cada cambio se escribe en
la auditoría.

## Permisos

| Sección | Operador |
|---|---|
| Candidatos | Ver, agregar, editar, activar/desactivar. **No eliminar** |
| Mesa | Solo ver y copiar el enlace |
| Padrón | Ver, agregar, importar y eliminar |
| Inicio, Resultados, Configuración, Auditoría, Operadores | Sin acceso |

El menú del dock, las rutas y los atajos se filtran por rol. La UI oculta las
acciones no permitidas y la base de datos/Edge Function las verifican de nuevo.
