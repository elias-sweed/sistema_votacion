import type { Session } from '@supabase/supabase-js'

// El rol de administrador vive en app_metadata, que solo puede escribir el
// backend con la clave de servicio. Nunca se acepta user_metadata porque el
// propio usuario puede modificarlo.
export const ROL_ADMIN = 'admin'

export function esSesionAdmin(session: Session | null): boolean {
  const rol = session?.user?.app_metadata?.role
  return typeof rol === 'string' && rol.toLowerCase() === ROL_ADMIN
}
