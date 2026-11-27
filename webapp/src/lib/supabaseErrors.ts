type SupabaseErrorLike =
  | {
      code?: string | null
      message?: string | null
      details?: string | null
      hint?: string | null
    }
  | null
  | undefined

export const MENSAJE_PERMISOS =
  "La base de datos rechazó la operación: tu usuario no tiene permisos de administrador. Aplica la migración supabase/migrations/016_borrado_total_safeupdate.sql en el SQL Editor de Supabase y verifica que tu usuario tenga app_metadata {\"role\":\"admin\"} en Authentication → Users."

export const MENSAJE_SAFEUPDATE =
  "Supabase tiene activa la protección safeupdate y rechaza los DELETE sin WHERE (código 21000, «DELETE requires a WHERE clause»). Aplica la migración supabase/migrations/016_borrado_total_safeupdate.sql: recrea las funciones de borrado con WHERE y restaura los permisos de la tabla votos."

function textoDe(error: SupabaseErrorLike): string {
  if (!error) return ''
  return `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
}

export function esErrorDePermisos(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const texto = textoDe(error)
  return (
    code === '42501' ||
    code === 'P0008' ||
    texto.includes('row-level security') ||
    texto.includes('acceso denegado') ||
    texto.includes('permission denied') ||
    texto.includes('violates row-level security')
  )
}

export function esErrorSafeupdate(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const texto = textoDe(error)
  return (
    code === '21000' ||
    texto.includes('requires a where clause') ||
    texto.includes('safeupdate')
  )
}

export function mensajeDeError(error: SupabaseErrorLike, mensajePorDefecto: string): string {
  if (esErrorSafeupdate(error)) return MENSAJE_SAFEUPDATE
  if (esErrorDePermisos(error)) return MENSAJE_PERMISOS
  return mensajePorDefecto
}
