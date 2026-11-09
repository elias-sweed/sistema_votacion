// ============================================================
// Almacén en memoria para el Modo Ensayo (pruebas).
//
// Cuando el modo ensayo está activo, las operaciones del
// padrón y las mesas se guardan aquí en lugar de Supabase.
// Al cerrar la pestaña o recargar, todo se pierde.
// ============================================================

type VotanteEnsayo = {
  dni: string
  nombre: string
  grado: string | null
  seccion: string | null
  ha_votado: boolean
  creado_en: string
}

type MesaEnsayo = {
  id: string
  nombre: string
  activo: boolean
  creado_en: string
  token_acceso: string | null
}

type EstadoEnsayo = {
  activo: boolean
  votantes: VotanteEnsayo[]
  mesas: MesaEnsayo[]
  votosContador: number // contador simple de votos emitidos
  configuracion: {
    eleccion_abierta: boolean
    titulo: string
    centro: string
    logo_url: string | null
  }
}

const ESTADO_INICIAL: EstadoEnsayo = {
  activo: false,
  votantes: [],
  mesas: [],
  votosContador: 0,
  configuracion: {
    eleccion_abierta: false,
    titulo: 'Elección de Municipios Escolares',
    centro: 'I.E. Jimenez Pimentel',
    logo_url: null,
  },
}

let estado: EstadoEnsayo = { ...ESTADO_INICIAL }
let escuchadores: Array<() => void> = []

export function obtenerEstadoEnsayo(): EstadoEnsayo {
  return estado
}

export function estaActivoEnsayo(): boolean {
  return estado.activo
}

export function activarEnsayo(): void {
  estado = {
    ...ESTADO_INICIAL,
    activo: true,
  }
  notificar()
}

export function desactivarEnsayo(): void {
  estado = { ...ESTADO_INICIAL, activo: false }
  notificar()
}

export function limpiarEnsayo(): void {
  estado = {
    ...ESTADO_INICIAL,
    activo: estado.activo,
  }
  notificar()
}

export function suscribirEnsayo(cb: () => void): () => void {
  escuchadores.push(cb)
  return () => {
    escuchadores = escuchadores.filter((c) => c !== cb)
  }
}

function notificar(): void {
  for (const cb of escuchadores) cb()
}

// --- Operaciones del padrón ---

export function ensayoAgregarVotante(votante: Omit<VotanteEnsayo, 'creado_en'>): void {
  estado.votantes.push({ ...votante, creado_en: new Date().toISOString() })
  notificar()
}

export function ensayoListarVotantes(filtros?: {
  busqueda?: string
  soloPendientes?: boolean
  pagina?: number
  pageSize?: number
}): { votantes: VotanteEnsayo[]; total: number } {
  let lista = [...estado.votantes]

  if (filtros?.busqueda) {
    const b = filtros.busqueda.toLowerCase()
    lista = lista.filter(
      (v) => v.dni.toLowerCase().includes(b) || v.nombre.toLowerCase().includes(b)
    )
  }

  if (filtros?.soloPendientes) {
    lista = lista.filter((v) => !v.ha_votado)
  }

  const total = lista.length
  const pagina = filtros?.pagina ?? 1
  const pageSize = filtros?.pageSize ?? 50
  const desde = (pagina - 1) * pageSize
  lista = lista.slice(desde, desde + pageSize)

  return { votantes: lista, total }
}

export function ensayoContarVotantes(): number {
  return estado.votantes.length
}

export function ensayoContarVotaron(): number {
  return estado.votantes.filter((v) => v.ha_votado).length
}

export function ensayoMarcarVotante(dni: string): boolean {
  const idx = estado.votantes.findIndex((v) => v.dni === dni)
  if (idx === -1) return false
  estado.votantes[idx].ha_votado = true
  estado.votosContador += 1
  notificar()
  return true
}

// --- Operaciones de mesas ---

export function ensayoAgregarMesa(mesa: Omit<MesaEnsayo, 'id' | 'creado_en'>): MesaEnsayo {
  const nueva: MesaEnsayo = {
    id: crypto.randomUUID(),
    creado_en: new Date().toISOString(),
    ...mesa,
  }
  estado.mesas.push(nueva)
  notificar()
  return nueva
}

export function ensayoListarMesas(): MesaEnsayo[] {
  return [...estado.mesas]
}

export function ensayoActualizarMesa(id: string, nombre?: string, activo?: boolean): boolean {
  const idx = estado.mesas.findIndex((m) => m.id === id)
  if (idx === -1) return false
  if (nombre !== undefined) estado.mesas[idx].nombre = nombre
  if (activo !== undefined) estado.mesas[idx].activo = activo
  notificar()
  return true
}

export function ensayoEliminarMesa(id: string): boolean {
  const idx = estado.mesas.findIndex((m) => m.id === id)
  if (idx === -1) return false
  estado.mesas.splice(idx, 1)
  notificar()
  return true
}

export function ensayoEliminarTodasMesas(): void {
  estado.mesas = []
  notificar()
}

export function ensayoContarMesas(): number {
  return estado.mesas.length
}

export function ensayoContarMesasActivas(): number {
  return estado.mesas.filter((m) => m.activo).length
}

export function ensayoContarVotos(): number {
  return estado.votosContador
}
