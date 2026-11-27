// Permisos del panel. El rol viene de app_metadata (firmado por Supabase Auth),
// nunca de user_metadata. El front oculta acciones; la base de datos y la Edge
// Function las verifican de nuevo.

export const ROL_ADMIN = 'admin'
export const ROL_OPERADOR = 'operador'

export type RolPanel = typeof ROL_ADMIN | typeof ROL_OPERADOR

export type SeccionPanel =
  | 'inicio'
  | 'candidatos'
  | 'mesas'
  | 'padron'
  | 'resultados'
  | 'configuracion'
  | 'auditoria'
  | 'operadores'

export const SECCIONES_POR_ROL: Record<RolPanel, readonly SeccionPanel[]> = {
  admin: [
    'inicio',
    'candidatos',
    'mesas',
    'padron',
    'resultados',
    'configuracion',
    'auditoria',
    'operadores',
  ],
  operador: ['candidatos', 'mesas', 'padron'],
}

export function rolDeSession(session: { user?: { app_metadata?: Record<string, unknown> } } | null): RolPanel | null {
  const rol = session?.user?.app_metadata?.role
  if (typeof rol !== 'string') return null
  const normalizado = rol.toLowerCase()
  if (normalizado === ROL_ADMIN) return ROL_ADMIN
  if (normalizado === ROL_OPERADOR) return ROL_OPERADOR
  return null
}

export function puedeAccederPanel(rol: RolPanel | null): boolean {
  return rol !== null
}

export function puedeVerSeccion(rol: RolPanel | null, seccion: SeccionPanel): boolean {
  return rol !== null && SECCIONES_POR_ROL[rol].includes(seccion)
}

export function primeraSeccion(rol: RolPanel | null): SeccionPanel {
  return rol ? SECCIONES_POR_ROL[rol][0] ?? 'candidatos' : 'candidatos'
}
