// ============================================================
// Borrado robusto de datos.
//
// Orden de intentos para cada operación:
//   1. RPC de Postgres (SECURITY DEFINER). Es la vía rápida y
//      transaccional. Requiere la migración 016 aplicada.
//   2. Edge Function `voting-proxy` con la clave de servicio. Sirve de
//      respaldo si la RPC no está disponible o si safeupdate
//      rechaza el DELETE. La función verifica que el JWT sea de
//      un administrador antes de borrar.
//   3. Borrado directo tabla por tabla con filtros WHERE.
//      safeupdate permite los DELETE que llevan WHERE.
//
// Nota: Supabase carga la librería safeupdate en PostgREST y
// rechaza los DELETE sin WHERE con el código 21000. Por eso el
// paso 3 siempre usa `.not(...)` o `.eq(...)`.
// ============================================================

import { supabase } from './supabase'
import {
  MENSAJE_PERMISOS,
  MENSAJE_SAFEUPDATE,
  esErrorDePermisos,
  esErrorSafeupdate,
} from './supabaseErrors'

export type TablaBorrable =
  | 'votos'
  | 'votantes'
  | 'candidatos'
  | 'mesas'
  | 'configuracion'

export type ResultadoBorrado = {
  ok: boolean
  metodo: 'rpc' | 'edge' | 'directo' | 'ninguno'
  errores: string[]
}

type ErrorLike =
  | {
      code?: string | null
      message?: string | null
      details?: string | null
      hint?: string | null
    }
  | null
  | undefined

const CONFIG_POR_DEFECTO = {
  eleccion_abierta: false,
  titulo: 'Elección de Municipios Escolares',
  centro: 'I.E. Jimenez Pimentel',
  logo_url: null as string | null,
  actualizado_en: new Date().toISOString(),
}

function describirError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const e = error as ErrorLike
    const campos = [e?.message, e?.details, e?.hint, e?.code]
      .filter((valor): valor is string => typeof valor === 'string' && valor.length > 0)
    if (campos.length > 0) return campos.join(' | ')
  }
  return String(error)
}

async function describirErrorFuncion(error: unknown): Promise<string> {
  if (error && typeof error === 'object') {
    const contexto = (error as { context?: unknown }).context
    if (contexto instanceof Response) {
      try {
        const cuerpo = (await contexto.clone().json()) as { error?: unknown }
        if (typeof cuerpo?.error === 'string' && cuerpo.error.length > 0) {
          return cuerpo.error
        }
      } catch {
        // La respuesta no era JSON; se usa el mensaje genérico.
      }
    }
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
  }
  return describirError(error)
}

async function intentarRpc(
  nombre: string,
  args?: Record<string, unknown>
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc(nombre, args)
    return error ? describirError(error) : null
  } catch (error) {
    return describirError(error)
  }
}

async function intentarEdge(tabla: string, id?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('voting-proxy', {
      body: { action: 'borrar', tabla, ...(id ? { id } : {}) },
    })
    if (error) return await describirErrorFuncion(error)
    const payload = data as { success?: boolean; error?: string } | null
    if (!payload || payload.success !== true) {
      return payload?.error ?? 'La función no confirmó el borrado.'
    }
    return null
  } catch (error) {
    return describirError(error)
  }
}

async function borrarDirecto(tabla: TablaBorrable): Promise<string | null> {
  if (tabla === 'configuracion') {
    const { error } = await supabase
      .from('configuracion')
      .update(CONFIG_POR_DEFECTO)
      .eq('id', 1)
    return error ? `configuracion: ${describirError(error)}` : null
  }

  // Los votos referencian candidatos y mesas con ON DELETE RESTRICT.
  // Hay que borrarlos primero para que el DELETE principal no falle.
  if (tabla === 'candidatos' || tabla === 'mesas') {
    const columna = tabla === 'candidatos' ? 'candidato_id' : 'mesa_id'
    const { error: errorVotos } = await supabase
      .from('votos')
      .delete()
      .not(columna, 'is', null)
    if (errorVotos) return `votos: ${describirError(errorVotos)}`
  }

  const pk = tabla === 'votantes' ? 'dni' : 'id'
  const { error } = await supabase
    .from(tabla)
    .delete()
    .not(pk, 'is', null)
  return error ? `${tabla}: ${describirError(error)}` : null
}

async function borrarTodoDirecto(): Promise<string | null> {
  const orden: TablaBorrable[] = [
    'votos',
    'votantes',
    'candidatos',
    'mesas',
    'configuracion',
  ]

  for (const tabla of orden) {
    const error = await borrarDirecto(tabla)
    if (error) return error
  }
  return null
}

async function borrarFilaDirecto(
  tipo: 'mesa' | 'candidato',
  id: string
): Promise<string | null> {
  const columna = tipo === 'mesa' ? 'mesa_id' : 'candidato_id'
  const tabla = tipo === 'mesa' ? 'mesas' : 'candidatos'

  const { error: errorVotos } = await supabase
    .from('votos')
    .delete()
    .eq(columna, id)
  if (errorVotos) return `votos: ${describirError(errorVotos)}`

  const { error } = await supabase.from(tabla).delete().eq('id', id)
  return error ? `${tabla}: ${describirError(error)}` : null
}

export async function borrarTabla(tabla: TablaBorrable): Promise<ResultadoBorrado> {
  const errores: string[] = []

  const errorRpc = await intentarRpc('borrar_tabla', { p_tabla: tabla })
  if (!errorRpc) return { ok: true, metodo: 'rpc', errores }
  errores.push(`RPC borrar_tabla: ${errorRpc}`)

  const errorEdge = await intentarEdge(tabla)
  if (!errorEdge) return { ok: true, metodo: 'edge', errores }
  errores.push(`Edge Function: ${errorEdge}`)

  const errorDirecto = await borrarDirecto(tabla)
  if (!errorDirecto) return { ok: true, metodo: 'directo', errores }
  errores.push(`Borrado directo: ${errorDirecto}`)

  return { ok: false, metodo: 'ninguno', errores }
}

export async function borrarTodo(): Promise<ResultadoBorrado> {
  const errores: string[] = []

  const errorRpc = await intentarRpc('borrar_todo')
  if (!errorRpc) return { ok: true, metodo: 'rpc', errores }
  errores.push(`RPC borrar_todo: ${errorRpc}`)

  const errorEdge = await intentarEdge('todo')
  if (!errorEdge) return { ok: true, metodo: 'edge', errores }
  errores.push(`Edge Function: ${errorEdge}`)

  const errorDirecto = await borrarTodoDirecto()
  if (!errorDirecto) return { ok: true, metodo: 'directo', errores }
  errores.push(`Borrado directo: ${errorDirecto}`)

  return { ok: false, metodo: 'ninguno', errores }
}

export async function borrarMesa(id: string): Promise<ResultadoBorrado> {
  const errores: string[] = []

  const errorRpc = await intentarRpc('borrar_mesa', { p_id: id })
  if (!errorRpc) return { ok: true, metodo: 'rpc', errores }
  errores.push(`RPC borrar_mesa: ${errorRpc}`)

  const errorEdge = await intentarEdge('mesa', id)
  if (!errorEdge) return { ok: true, metodo: 'edge', errores }
  errores.push(`Edge Function: ${errorEdge}`)

  const errorDirecto = await borrarFilaDirecto('mesa', id)
  if (!errorDirecto) return { ok: true, metodo: 'directo', errores }
  errores.push(`Borrado directo: ${errorDirecto}`)

  return { ok: false, metodo: 'ninguno', errores }
}

export async function borrarCandidato(id: string): Promise<ResultadoBorrado> {
  const errores: string[] = []

  const errorRpc = await intentarRpc('borrar_candidato', { p_id: id })
  if (!errorRpc) return { ok: true, metodo: 'rpc', errores }
  errores.push(`RPC borrar_candidato: ${errorRpc}`)

  const errorEdge = await intentarEdge('candidato', id)
  if (!errorEdge) return { ok: true, metodo: 'edge', errores }
  errores.push(`Edge Function: ${errorEdge}`)

  const errorDirecto = await borrarFilaDirecto('candidato', id)
  if (!errorDirecto) return { ok: true, metodo: 'directo', errores }
  errores.push(`Borrado directo: ${errorDirecto}`)

  return { ok: false, metodo: 'ninguno', errores }
}

// Traduce los errores técnicos a un mensaje útil para el panel.
export function mensajeBorrado(resultado: ResultadoBorrado): string {
  const detalle = resultado.errores.filter(Boolean).join(' · ')

  const tieneSafeupdate = resultado.errores.some((error) => {
    const texto = error.toLowerCase()
    return texto.includes('21000') || texto.includes('requires a where clause') || texto.includes('safeupdate')
  })
  if (tieneSafeupdate) return `${MENSAJE_SAFEUPDATE} Detalle: ${detalle}`

  const tienePermisos = resultado.errores.some((error) => {
    const texto = error.toLowerCase()
    return (
      texto.includes('42501') ||
      texto.includes('p0008') ||
      texto.includes('permission denied') ||
      texto.includes('acceso denegado') ||
      texto.includes('row-level security')
    )
  })
  if (tienePermisos) return `${MENSAJE_PERMISOS} Detalle: ${detalle}`

  return `No se pudo completar el borrado. Detalle: ${detalle || 'sin detalle'}`
}

// Reexportado para que las pantallas puedan detectar el caso sin
// importar dos módulos.
export { esErrorDePermisos, esErrorSafeupdate }
