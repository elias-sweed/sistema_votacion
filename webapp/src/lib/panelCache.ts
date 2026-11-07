// Caché ligera del panel en sessionStorage.
// Permite mostrar el contenido ya visitado al instante (sin skeletons)
// mientras se refresca en segundo plano.
//
// Se usa sessionStorage (no localStorage) para que el padrón, con DNI y
// nombres, desaparezca al cerrar la pestaña y no quede en equipos compartidos.
// limpiarCachePanel() se llama además al cerrar sesión.

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

function almacen(): Storage | null {
  try {
    const prueba = '__sv_cache_probe__'
    sessionStorage.setItem(prueba, '1')
    sessionStorage.removeItem(prueba)
    return sessionStorage
  } catch {
    return null
  }
}

export function leerCache<T>(clave: string): T | null {
  try {
    const store = almacen()
    if (!store) return null
    const crudo = store.getItem(PREFIJO + clave)
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
    const store = almacen()
    if (!store) return
    store.setItem(PREFIJO + clave, JSON.stringify({ guardadoEn: Date.now(), data }))
  } catch {
    // Si el almacenamiento está lleno o bloqueado, la app sigue funcionando sin caché.
  }
}

function borrarPrefijo(store: Storage | null): void {
  if (!store) return
  const claves: string[] = []
  for (let i = 0; i < store.length; i += 1) {
    const clave = store.key(i)
    if (clave?.startsWith(PREFIJO)) claves.push(clave)
  }
  claves.forEach((clave) => store.removeItem(clave))
}

export function limpiarCachePanel(): void {
  try {
    borrarPrefijo(almacen())
  } catch {
    // Sin acceso al almacenamiento no hay nada que limpiar.
  }
}

// Versiones anteriores guardaban el padrón en localStorage. Se purga al
// arrancar para no dejar DNI ni nombres de votantes en equipos ya usados.
export function limpiarCacheLegado(): void {
  try {
    borrarPrefijo(localStorage)
  } catch {
    // localStorage puede estar bloqueado por el navegador.
  }
}
