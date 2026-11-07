// Caché ligera del panel en localStorage.
// Permite mostrar el contenido ya visitado al instante (sin skeletons)
// mientras se refresca en segundo plano.
//
// Se limpia al cerrar sesión para no dejar datos del padrón en el equipo.

const PREFIJO = 'sv-panel-cache:v1:'

export const CLAVES_CACHE = {
  dashboard: 'dashboard',
  candidatos: 'candidatos',
  mesas: 'mesas',
  padronLista: 'padron:lista',
  padronMesas: 'padron:mesas',
  padronEstadisticas: 'padron:estadisticas'
} as const

type Entrada<T> = {
  guardadoEn: number
  data: T
}

export function leerCache<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave)
    if (!crudo) return null
    const entrada = JSON.parse(crudo) as Entrada<T>
    if (!entrada || typeof entrada !== 'object' || !('data' in entrada)) return null
    return entrada.data
  } catch {
    return null
  }
}

export function guardarCache<T>(clave: string, data: T): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify({ guardadoEn: Date.now(), data }))
  } catch {
    // Si localStorage está lleno o bloqueado, la app sigue funcionando sin caché.
  }
}

export function limpiarCachePanel(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const clave = localStorage.key(i)
      if (clave?.startsWith(PREFIJO)) claves.push(clave)
    }
    claves.forEach((clave) => localStorage.removeItem(clave))
  } catch {
    // Sin acceso a localStorage no hay nada que limpiar.
  }
}
