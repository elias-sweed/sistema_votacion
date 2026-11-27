import type { Session } from '@supabase/supabase-js'
import {
  ROL_ADMIN,
  ROL_OPERADOR,
  puedeAccederPanel,
  puedeVerSeccion,
  primeraSeccion,
  type RolPanel,
  type SeccionPanel,
} from './roles'

export { ROL_ADMIN, ROL_OPERADOR }
export type { RolPanel, SeccionPanel }

// El rol vive en app_metadata, que solo puede escribir el backend con la clave
// de servicio. Nunca se acepta user_metadata porque el propio usuario puede
// modificarlo.
export function rolDeSesion(session: Session | null): RolPanel | null {
  const rol = session?.user?.app_metadata?.role
  if (typeof rol !== 'string') return null
  const normalizado = rol.toLowerCase()
  if (normalizado === ROL_ADMIN) return ROL_ADMIN
  if (normalizado === ROL_OPERADOR) return ROL_OPERADOR
  return null
}

export function esSesionAdmin(session: Session | null): boolean {
  const rol = session?.user?.app_metadata?.role
  return typeof rol === 'string' && rol.toLowerCase() === ROL_ADMIN
}

export function esSesionOperador(session: Session | null): boolean {
  const rol = session?.user?.app_metadata?.role
  return typeof rol === 'string' && rol.toLowerCase() === ROL_OPERADOR
}

export function puedeEntrarPanel(session: Session | null): boolean {
  return puedeAccederPanel(rolDeSesion(session))
}

export function sesionPuedeVer(session: Session | null, seccion: SeccionPanel): boolean {
  return puedeVerSeccion(rolDeSesion(session), seccion)
}

export function seccionInicial(session: Session | null): SeccionPanel {
  return primeraSeccion(rolDeSesion(session))
}
