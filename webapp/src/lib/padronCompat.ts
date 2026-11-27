/**
 * Compatibilidad con dos versiones del esquema remoto:
 *  - completa: `votantes` tiene `grado` y `seccion` (migración 010 aplicada);
 *  - incompleta: solo `dni` y `nombre`, pero los RPC ya piden grado/sección.
 *
 * En la versión incompleta se sigue usando REST para que el padrón, la
 * importación y el alta manual no fallen con el error 42703/400.
 */

import { supabase } from './supabase'
import type { FilaPadron } from './importarPadron'

export type VotanteListado = {
  dni: string
  nombre: string
  grado: string | null
  seccion: string | null
  ha_votado: boolean
  creado_en: string
  total_count?: number
}

export type OpcionesListado = {
  busqueda: string
  soloPendientes: boolean
  limit: number
  offset: number
}

export type OpcionesTodosVotantes = Omit<OpcionesListado, 'limit' | 'offset'> & {
  tamanoPagina?: number
}

type ErrorListado = { message: string; code?: string } | null

type ResultadoLote = {
  insertados: number
  duplicados: number
  errores: Array<{ fila: number; dni: string; nombre: string; error: string }>
  detalle: Array<{ dni: string; nombre: string; estado: string }>
}

let conColumnas: boolean | null = null

/** Patrón seguro para `ilike` dentro de un `or` de PostgREST. */
export function patronBusqueda(busqueda: string): string {
  return busqueda
    .replace(/[%,()\\\r\n\t]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('%')
}

/** Se comprueba una vez por carga de página. */
export async function detectarColumnasPadron(): Promise<boolean> {
  if (conColumnas !== null) return conColumnas

  const { error } = await supabase.from('votantes').select('grado,seccion').limit(1)
  const faltan = Boolean(
    error && (error.code === '42703' || /grado|seccion/i.test(error.message))
  )
  if (faltan) {
    console.warn(
      '[sistema-votacion] Padrón en modo compatible: la tabla votantes no tiene grado/seccion ' +
        '(aplica la migración 017). Error original:',
      error
    )
  }
  conColumnas = !faltan
  return conColumnas
}

export async function listarVotantes(opciones: OpcionesListado): Promise<{
  filas: VotanteListado[]
  total: number
  error: ErrorListado
}> {
  if (await detectarColumnasPadron()) {
    const { data, error } = await supabase.rpc('listar_votantes', {
      p_busqueda: opciones.busqueda || null,
      p_solo_pendientes: opciones.soloPendientes,
      p_limit: opciones.limit,
      p_offset: opciones.offset
    })
    if (error) return { filas: [], total: 0, error }
    const filas = (data ?? []) as VotanteListado[]
    return { filas, total: Number(filas[0]?.total_count ?? 0), error: null }
  }

  let consulta = supabase
    .from('votantes')
    .select('dni,nombre,ha_votado,creado_en', { count: 'exact' })
    .order('nombre')
    .range(opciones.offset, opciones.offset + opciones.limit - 1)

  if (opciones.soloPendientes) consulta = consulta.eq('ha_votado', false)
  const patron = patronBusqueda(opciones.busqueda)
  if (patron) consulta = consulta.or(`dni.ilike.*${patron}*,nombre.ilike.*${patron}*`)

  const { data, count, error } = await consulta
  if (error) return { filas: [], total: 0, error }

  const filas: VotanteListado[] = (data ?? []).map((fila) => ({
    dni: fila.dni,
    nombre: fila.nombre,
    grado: null,
    seccion: null,
    ha_votado: fila.ha_votado,
    creado_en: fila.creado_en
  }))
  return { filas, total: count ?? 0, error: null }
}

/**
 * `listar_votantes` acepta como máximo 200 filas por llamada. Para que el
 * padrón muestre los registros reales aunque supere el límite de una sola
 * petición, se recorre con offset hasta completar todas las páginas.
 */
export async function listarTodosVotantes(opciones: OpcionesTodosVotantes): Promise<{
  filas: VotanteListado[]
  total: number
  error: ErrorListado
}> {
  const tamano = Math.min(200, Math.max(1, Math.floor(opciones.tamanoPagina ?? 200)))
  const filas: VotanteListado[] = []
  let total = 0
  let offset = 0

  while (true) {
    const pagina = await listarVotantes({
      busqueda: opciones.busqueda,
      soloPendientes: opciones.soloPendientes,
      limit: tamano,
      offset
    })
    if (pagina.error) return { filas: [], total: 0, error: pagina.error }

    total = Number(pagina.total ?? pagina.filas.length)
    filas.push(...pagina.filas)
    if (pagina.filas.length < tamano) break

    offset += tamano
    if (total > 0 && offset >= total) break
    // Si el backend ignorara el offset, esto evita un bucle infinito.
    if (offset > 100000) break
  }

  return { filas, total: total || filas.length, error: null }
}

export async function importarLotePadron(filas: FilaPadron[]): Promise<ResultadoLote> {
  if (await detectarColumnasPadron()) {
    const { data, error } = await supabase.rpc('importar_votantes', { p_votantes: filas })
    if (error) throw error
    const parcial = data?.[0]
    return {
      insertados: Number(parcial?.insertados ?? 0),
      duplicados: Number(parcial?.duplicados ?? 0),
      errores: parcial?.errores ?? [],
      detalle: parcial?.detalle ?? []
    }
  }

  // Sin las columnas, se guarda lo que la tabla remota sí tiene.
  const { data, error } = await supabase
    .from('votantes')
    .upsert(
      filas.map((fila) => ({ dni: fila.dni, nombre: fila.nombre })),
      { onConflict: 'dni', ignoreDuplicates: true, count: 'exact' }
    )
    .select('dni')
  if (error) throw error

  const insertados = Array.isArray(data) ? data.length : 0
  return {
    insertados,
    duplicados: Math.max(0, filas.length - insertados),
    errores: [],
    detalle: []
  }
}

export async function insertarVotantePadron(fila: FilaPadron) {
  const registro = (await detectarColumnasPadron())
    ? fila
    : { dni: fila.dni, nombre: fila.nombre }

  return supabase.from('votantes').insert(registro)
}
