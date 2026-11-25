type SupabaseErrorLike =
  | {
      code?: string | null
      message?: string | null
      details?: string | null
      hint?: string | null
    }
  | null
  | undefined

const MENSAJE_PERMISOS =
  "La base de datos rechazó la operación: tu usuario no tiene permisos de administrador. Aplica la migración supabase/migrations/015_borrar_todo_robusto.sql en el SQL Editor de Supabase y verifica que tu usuario tenga app_metadata {\"role\":\"admin\"} en Authentication → Users."

export function esErrorDePermisos(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const texto = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return (
    code === '42501' ||
    code === 'P0008' ||
    texto.includes('row-level security') ||
    texto.includes('acceso denegado') ||
    texto.includes('permission denied') ||
    texto.includes('violates row-level security')
  )
}

export function mensajeDeError(error: SupabaseErrorLike, mensajePorDefecto: string): string {
  if (esErrorDePermisos(error)) return MENSAJE_PERMISOS
  return mensajePorDefecto
}

export { MENSAJE_PERMISOS }
