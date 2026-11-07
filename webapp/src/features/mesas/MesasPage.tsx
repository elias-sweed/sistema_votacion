import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { MesasSkeleton } from '../panel/PanelSkeletons'

type Mesa = { id: string; nombre: string; activo: boolean; creado_en: string }

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°'] as const
const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const TODAS_LAS_MESAS = GRADOS.flatMap((grado) =>
  SECCIONES.map((seccion) => `${grado} ${seccion}`)
)

export default function MesasPage() {
  const toast = useToast()
  const [mesasInicial] = useState(() => leerCache<Mesa[]>(CLAVES_CACHE.mesas))
  const [mesas, setMesas] = useState<Mesa[]>(mesasInicial ?? [])
  const [cargando, setCargando] = useState(mesasInicial === null)
  const [tieneDatos, setTieneDatos] = useState(mesasInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [grado, setGrado] = useState<string>(GRADOS[0])
  const [seccion, setSeccion] = useState<string>(SECCIONES[0])
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('mesas').select('*').order('creado_en', { ascending: true })
    setCargando(false)
    if (err) { setError(mensajeDeError(err, 'No se pudieron cargar las mesas.')); return }
    const lista = (data ?? []) as Mesa[]
    setMesas(lista)
    guardarCache(CLAVES_CACHE.mesas, lista)
    setTieneDatos(true)
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    setError(null); setExito(null)
    const nombreMesa = `${grado} ${seccion}`

    setGuardando(true)
    const { error: err } = await supabase.from('mesas')
      .insert({ nombre: nombreMesa, activo: true })
    setGuardando(false)
    if (err) {
      if (err.code === '23505') setError(`La mesa ${nombreMesa} ya existe.`)
      else setError(mensajeDeError(err, 'No se pudo agregar la mesa.'))
      return
    }

    setExito(`Mesa ${nombreMesa} agregada.`)
    toast({ title: 'Mesa agregada', description: nombreMesa, variant: 'success', duration: 3000 })
    await cargar()
  }

  async function generarTodas() {
    setError(null); setExito(null)
    setGenerando(true)

    const { data: existentes, error: errLectura } = await supabase
      .from('mesas').select('nombre')
    if (errLectura) {
      setGenerando(false)
      setError('No se pudieron consultar las mesas existentes.')
      return
    }

    const yaExisten = new Set((existentes ?? []).map((m: { nombre: string }) => m.nombre))
    const faltantes = TODAS_LAS_MESAS
      .filter((nombreMesa) => !yaExisten.has(nombreMesa))
      .map((nombreMesa) => ({ nombre: nombreMesa, activo: true }))

    if (faltantes.length === 0) {
      setGenerando(false)
      setExito('Ya existen las 36 mesas (1° a 6° grado, secciones A–F).')
      return
    }

    const { error: err } = await supabase.from('mesas').insert(faltantes)
    setGenerando(false)
    if (err) {
      setError(mensajeDeError(err, 'No se pudieron generar las mesas.'))
      return
    }

    setExito(`Se crearon ${faltantes.length} mesas. Total: ${yaExisten.size + faltantes.length} de 36.`)
    toast({
      title: 'Mesas generadas',
      description: `${faltantes.length} nuevas · ${yaExisten.size + faltantes.length}/36 en total`,
      variant: 'success',
      duration: 4000
    })
    await cargar()
  }

  async function iniciarEdicion(m: Mesa) {
    setEditandoId(m.id)
    setEditNombre(m.nombre)
    setError(null); setExito(null)
  }

  async function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
  }

  async function guardarEdicion(m: Mesa) {
    setError(null); setExito(null)
    const nombreTrim = editNombre.trim()
    if (nombreTrim.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (nombreTrim === m.nombre) { setEditandoId(null); return }

    const { error: err } = await supabase.from('mesas')
      .update({ nombre: nombreTrim }).eq('id', m.id)
    if (err) {
      if (err.code === '23505') setError('Ya existe una mesa con ese nombre.')
      else setError(mensajeDeError(err, 'No se pudo actualizar la mesa.'))
      return
    }

    setEditandoId(null)
    setEditNombre('')
    setExito('Mesa actualizada.')
    await cargar()
  }

  async function alternarActivo(m: Mesa) {
    setError(null); setExito(null)
    const { error: err } = await supabase.from('mesas')
      .update({ activo: !m.activo }).eq('id', m.id)
    if (err) {
      toast({
        title: 'No se pudo actualizar',
        description: mensajeDeError(err, err.message),
        variant: 'error',
        duration: 6000
      })
      return
    }
    setMesas((prev) => {
      const siguiente = prev.map((x) => (x.id === m.id ? { ...x, activo: !x.activo } : x))
      guardarCache(CLAVES_CACHE.mesas, siguiente)
      return siguiente
    })
    toast({
      title: m.activo ? 'Mesa desactivada' : 'Mesa activada',
      description: m.nombre,
      variant: 'success',
      duration: 3000
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
        <h2 className="text-xl font-bold text-white">Mesas / Salones</h2>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl space-y-4">
        <form onSubmit={agregar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-36">
            <label htmlFor="mesa-grado" className="mb-1 block text-xs text-slate-400">Grado</label>
            <select
              id="mesa-grado"
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            >
              {GRADOS.map((g) => <option key={g} value={g}>{g} grado</option>)}
            </select>
          </div>

          <div className="sm:w-36">
            <label htmlFor="mesa-seccion" className="mb-1 block text-xs text-slate-400">Sección</label>
            <select
              id="mesa-seccion"
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            >
              {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button disabled={guardando}
            className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>

          <button type="button" onClick={() => void generarTodas()} disabled={generando}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40">
            {generando ? 'Generando…' : 'Generar todas (36)'}
          </button>
        </form>

        <p className="text-xs text-slate-500">
          Se crea como <span className="text-slate-300">{grado} {seccion}</span>. «Generar todas» crea
          1° a 6° grado en las secciones A–F sin duplicar las existentes.
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {exito && <p className="text-emerald-400 text-sm">{exito}</p>}
      </div>

      {cargando && !tieneDatos && <MesasSkeleton />}
      {tieneDatos && mesas.length === 0 && (
        <p className="text-slate-500">Aún no hay mesas. Agrega la primera o usa «Generar todas».</p>
      )}

      <ul className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        {mesas.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-5 py-3">
            {editandoId === m.id ? (
              <form onSubmit={(e) => { e.preventDefault(); guardarEdicion(m); }} className="flex flex-col sm:flex-row gap-2 flex-1">
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
                <button type="submit"
                  className="rounded-lg bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
                  Guardar
                </button>
                <button type="button" onClick={cancelarEdicion}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className={m.activo ? 'text-white' : 'text-slate-500 line-through'} flex-1>{m.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => iniciarEdicion(m)}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                    Editar
                  </button>
                  <button onClick={() => alternarActivo(m)}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
