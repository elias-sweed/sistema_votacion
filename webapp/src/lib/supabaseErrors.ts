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
  "La base de datos rechazó la operación: tu usuario no tiene permisos de administrador. Aplica supabase/scripts/acceso_directo.sql en Supabase o asigna app_metadata {\"role\":\"admin\"} a tu usuario en Authentication → Users."

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
