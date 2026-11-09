import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { MesasSkeleton } from '../panel/PanelSkeletons'
import {
  estaActivoEnsayo,
  ensayoListarMesas,
  ensayoAgregarMesa,
  ensayoActualizarMesa,
  ensayoEliminarMesa,
  ensayoContarMesas,
  ensayoContarMesasActivas,
  ensayoContarVotos,
  ensayoContarVotantes,
  ensayoContarVotaron,
} from '../../lib/ensayoStore'

type Mesa = {
  id: string
  nombre: string
  activo: boolean
  creado_en: string
  token_acceso: string | null
  token_actualizado_en?: string | null
}

type ResumenMesa = {
  mesa_id: string
  nombre: string
  activo: boolean
  total_padron: number
  votaron: number
  pendientes: number
  participacion_pct: number
  votos_emitidos: number
}

function enlaceDeMesa(mesa: Mesa): string {
  if (!mesa.token_acceso) return ''
  return `${window.location.origin}/votar/${mesa.token_acceso}`
}

export default function MesasPage() {
  const toast = useToast()
  const [mesasInicial] = useState(() => leerCache<Mesa[]>(CLAVES_CACHE.mesas))
  const [mesas, setMesas] = useState<Mesa[]>(mesasInicial ?? [])
  const [resumenes, setResumenes] = useState<Record<string, ResumenMesa>>({})
  const [cargando, setCargando] = useState(mesasInicial === null)
  const [tieneDatos, setTieneDatos] = useState(mesasInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Grado y sección: empiezan vacíos, se pueden escribir libremente
  const [grado, setGrado] = useState('')
  const [seccion, setSeccion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmandoAgregar, setConfirmandoAgregar] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [rotandoId, setRotandoId] = useState<string | null>(null)
  const [confirmandoRotar, setConfirmandoRotar] = useState<Mesa | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Mesa | null>(null)
  const [passwordEliminar, setPasswordEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)

    if (estaActivoEnsayo()) {
      const mesasEnsayo = ensayoListarMesas()
      const lista: Mesa[] = mesasEnsayo.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        activo: m.activo,
        creado_en: m.creado_en,
        token_acceso: m.token_acceso,
      }))
      setMesas(lista)
      guardarCache(CLAVES_CACHE.mesas, lista)
      setTieneDatos(true)
      setResumenes({})
      setCargando(false)
      return
    }

    const [mesasRes, resumenRes] = await Promise.all([
      supabase.from('mesas').select('*').order('creado_en', { ascending: true }),
      supabase.rpc('obtener_resumen_mesas')
    ])

    setCargando(false)

    if (mesasRes.error) {
      setError(mensajeDeError(mesasRes.error, 'No se pudieron cargar las mesas.'))
      return
    }

    const lista = (mesasRes.data ?? []) as Mesa[]
    setMesas(lista)
    guardarCache(CLAVES_CACHE.mesas, lista)
    setTieneDatos(true)

    if (resumenRes.error) {
      setError(mensajeDeError(resumenRes.error, 'No se pudo cargar la participación por mesa.'))
      return
    }

    const mapa: Record<string, ResumenMesa> = {}
    for (const fila of (resumenRes.data ?? []) as ResumenMesa[]) {
      mapa[fila.mesa_id] = fila
    }
    setResumenes(mapa)
  }

  useEffect(() => { void cargar() }, [])

  function handleAgregar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(null)
    if (!grado.trim() || !seccion.trim()) {
      setError('Escribe el grado y la sección.')
      return
    }
    setConfirmandoAgregar(true)
  }

  async function confirmarAgregar() {
    const nombreMesa = `${grado.trim()} ${seccion.trim()}`
    setConfirmandoAgregar(false)
    setGuardando(true)

    if (estaActivoEnsayo()) {
      ensayoAgregarMesa({ nombre: nombreMesa, activo: true, token_acceso: null })
      setGuardando(false)
      setGrado('')
      setSeccion('')
      const mensajeCambio = `se agregó la mesa ${nombreMesa}`
      setExito(mensajeCambio)
      await cargar()
      return
    }

    const { error: err } = await supabase.from('mesas')
      .insert({ nombre: nombreMesa, activo: true })
    setGuardando(false)

    if (err) {
      if (err.code === '23505') setError(`La mesa ${nombreMesa} ya existe.`)
      else setError(mensajeDeError(err, 'No se pudo agregar la mesa.'))
      return
    }

    setGrado('')
    setSeccion('')
    const mensajeCambio = `se agregó la mesa ${nombreMesa}`
    setExito(mensajeCambio)
    toast({ title: 'mesa agregada', description: mensajeCambio, variant: 'success', duration: 3000 })
    await cargar()
  }

  function iniciarEdicion(m: Mesa) {
    setEditandoId(m.id)
    setEditNombre(m.nombre)
    setError(null)
    setExito(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
  }

  async function guardarEdicion(m: Mesa) {
    setError(null)
    setExito(null)
    const nombreTrim = editNombre.trim()
    if (nombreTrim.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (nombreTrim === m.nombre) { setEditandoId(null); return }

    if (estaActivoEnsayo()) {
      ensayoActualizarMesa(m.id, nombreTrim, m.activo)
      setEditandoId(null)
      setEditNombre('')
      setExito('Mesa actualizada.')
      await cargar()
      return
    }

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
    setError(null)
    setExito(null)

    if (estaActivoEnsayo()) {
      ensayoActualizarMesa(m.id, m.nombre, !m.activo)
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
      return
    }

    const { error: err } = await supabase.from('mesas')
      .update({ activo: !m.activo }).eq('id', m.id)
    if (err) {
      toast({ title: 'No se pudo actualizar', description: mensajeDeError(err, err.message), variant: 'error', duration: 6000 })
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

  async function copiarEnlace(m: Mesa) {
    const enlace = enlaceDeMesa(m)
    if (!enlace) {
      setError('Esta mesa no tiene enlace.')
      return
    }
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiadoId(m.id)
      setExito(`Enlace de ${m.nombre} copiado.`)
      toast({ title: 'Enlace copiado', description: m.nombre, variant: 'success', duration: 2500 })
      window.setTimeout(() => setCopiadoId((actual) => actual === m.id ? null : actual), 2500)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  function abrirEnlace(m: Mesa) {
    const enlace = enlaceDeMesa(m)
    if (!enlace) {
      setError('Esta mesa no tiene enlace.')
      return
    }
    window.open(enlace, '_blank', 'noopener,noreferrer')
  }

  async function rotarEnlace(m: Mesa) {
    setRotandoId(m.id)
    setError(null)
    setExito(null)
    const { data, error: err } = await supabase.rpc('rotar_token_mesa', { p_mesa_id: m.id })
    setRotandoId(null)
    setConfirmandoRotar(null)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo regenerar el enlace.'))
      return
    }
    if (typeof data !== 'string' || data.length < 16) {
      setError('El servidor no devolvió un enlace válido.')
      return
    }

    setMesas((prev) => {
      const siguiente = prev.map((x) => x.id === m.id ? { ...x, token_acceso: data } : x)
      guardarCache(CLAVES_CACHE.mesas, siguiente)
      return siguiente
    })
    setExito(`Enlace de ${m.nombre} regenerado.`)
    toast({ title: 'Enlace regenerado', description: m.nombre, variant: 'success', duration: 3000 })
  }

  function cerrarEliminar() {
    if (eliminando) return
    setConfirmandoEliminar(null)
    setPasswordEliminar('')
    setErrorEliminar(null)
  }

  async function eliminarMesa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirmandoEliminar || eliminando) return

    setErrorEliminar(null)

    if (!passwordEliminar) {
      setErrorEliminar('Escribe tu contraseña para confirmar.')
      return
    }

    setEliminando(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      const email = userData.user?.email

      if (userError || !email) {
        setErrorEliminar('No se pudo comprobar tu cuenta.')
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordEliminar
      })

      if (authError) {
        setErrorEliminar('Contraseña incorrecta.')
        return
      }

      if (estaActivoEnsayo()) {
        ensayoEliminarMesa(confirmandoEliminar.id)
        const mensajeCambio = `se eliminó la mesa ${confirmandoEliminar.nombre}`
        setExito(mensajeCambio)
        toast({ title: 'mesa eliminada', description: mensajeCambio, variant: 'success', duration: 3000 })
        setConfirmandoEliminar(null)
        setPasswordEliminar('')
        await cargar()
        return
      }

      const { error: err } = await supabase
        .from('mesas')
        .delete()
        .eq('id', confirmandoEliminar.id)

      if (err) {
        if (err.code === '23503') {
          setErrorEliminar('Esta mesa tiene votos registrados. Desactívala primero.')
        } else {
          setErrorEliminar(mensajeDeError(err, 'No se pudo eliminar la mesa.'))
        }
        return
      }

      const mensajeCambio = `se eliminó la mesa ${confirmandoEliminar.nombre}`
      setExito(mensajeCambio)
      toast({ title: 'mesa eliminada', description: mensajeCambio, variant: 'success', duration: 3000 })
      setConfirmandoEliminar(null)
      setPasswordEliminar('')
      await cargar()
    } finally {
      setEliminando(false)
    }
  }

  const resumenGlobal = (mesas.length > 0 ? resumenes[mesas[0].id] : null) ?? null
  const totalVotos = mesas.reduce(
    (acc, m) => acc + Number(resumenes[m.id]?.votos_emitidos ?? 0),
    0
  )
  const totales = {
    mesas: estaActivoEnsayo() ? ensayoContarMesas() : mesas.length,
    activas: estaActivoEnsayo() ? ensayoContarMesasActivas() : mesas.filter((m) => m.activo).length,
    padron: estaActivoEnsayo() ? ensayoContarVotantes() : Number(resumenGlobal?.total_padron ?? 0),
    votaron: estaActivoEnsayo() ? ensayoContarVotaron() : Number(resumenGlobal?.votaron ?? 0),
    votos: estaActivoEnsayo() ? ensayoContarVotos() : totalVotos
  }

  const nombreMesa = `${grado.trim()} ${seccion.trim()}`.trim()

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
        <h2 className="text-xl font-bold text-white">Mesas / Salones</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumenTarjeta label="Mesas activas" value={`${totales.activas}/${totales.mesas}`} />
        <ResumenTarjeta label="En padrón" value={totales.padron} />
        <ResumenTarjeta label="Ya votaron" value={totales.votaron} />
        <ResumenTarjeta label="Votos registrados" value={totales.votos} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl space-y-4">
        <p className="text-sm text-slate-400">
          Escribe el grado y la sección de la mesa. Puedes usar cualquier valor, no solo los de la lista.
        </p>
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100/80">
          Privacidad: el sistema cuenta cuántos votos hay por mesa, pero no guarda qué votante eligió a qué candidato. El voto sigue siendo secreto.
        </p>

        <form onSubmit={handleAgregar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-40">
            <label htmlFor="mesa-grado" className="mb-1 block text-xs text-slate-400">Grado</label>
            <input
              id="mesa-grado"
              type="text"
              list="grados-lista"
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              placeholder="Seleccionar el grado"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
            <datalist id="grados-lista">
              <option value="1°" />
              <option value="2°" />
              <option value="3°" />
              <option value="4°" />
              <option value="5°" />
              <option value="6°" />
            </datalist>
          </div>

          <div className="sm:w-40">
            <label htmlFor="mesa-seccion" className="mb-1 block text-xs text-slate-400">Sección</label>
            <input
              id="mesa-seccion"
              type="text"
              list="secciones-lista"
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              placeholder="Seleccionar la sección"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
            <datalist id="secciones-lista">
              <option value="A" />
              <option value="B" />
              <option value="C" />
              <option value="D" />
              <option value="E" />
              <option value="F" />
            </datalist>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {guardando ? 'Agregando…' : 'Agregar mesa'}
          </button>
        </form>

        <p className="text-xs text-slate-500">
          Cada mesa recibe un enlace único. Ábrelo en la máquina de ese salón y el voto quedará registrado en esa mesa.
        </p>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {exito && <p className="text-sm text-emerald-400">{exito}</p>}
      </div>

      {cargando && !tieneDatos && <MesasSkeleton />}
      {tieneDatos && mesas.length === 0 && (
        <p className="text-slate-500">Aún no hay mesas. Agrega la primera.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {mesas.map((m) => {
          const r = resumenes[m.id]
          const votosMesa = Number(r?.votos_emitidos ?? 0)
          const porcentajeVotos = totalVotos > 0 ? (votosMesa / totalVotos) * 100 : 0
          const enlace = enlaceDeMesa(m)
          return (
            <li key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl space-y-3">
              {editandoId === m.id ? (
                <form onSubmit={(e) => { e.preventDefault(); void guardarEdicion(m); }} className="flex flex-col gap-2">
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
                  <div className="flex gap-2">
                    <button type="submit"
                      className="flex-1 rounded-lg bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelarEdicion}
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-lg font-semibold ${m.activo ? 'text-white' : 'text-slate-500 line-through'}`}>
                        {m.nombre}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.activo ? 'Enlace operativo' : 'Enlace desactivado'}
                        {m.token_acceso ? ` · …${m.token_acceso.slice(-6)}` : ' · sin enlace'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      m.activo ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-500/15 text-slate-400'
                    }`}>
                      {m.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Votos registrados aquí</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{votosMesa}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Del total de votos</span>
                      <span className="tabular-nums">{porcentajeVotos.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-sky-500"
                        style={{ width: `${Math.min(100, Math.max(0, porcentajeVotos))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copiarEnlace(m)}
                      disabled={!enlace}
                      className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copiadoId === m.id ? 'Copiado' : 'Copiar enlace'}
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEnlace(m)}
                      disabled={!enlace || !m.activo}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Abrir kiosco
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoRotar(m)}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/[0.1]"
                    >
                      Regenerar enlace
                    </button>
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(m)}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/[0.1]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void alternarActivo(m)}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/[0.1]"
                    >
                      {m.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmandoEliminar(m)
                        setPasswordEliminar('')
                        setErrorEliminar(null)
                      }}
                      className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {confirmandoAgregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar agregar mesa"
            onClick={() => setConfirmandoAgregar(false)}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmar-agregar"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <h2 id="titulo-confirmar-agregar" className="text-base font-semibold text-white">
              ¿Estás seguro?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Vas a agregar la mesa <strong className="text-white">{nombreMesa}</strong>.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmandoAgregar(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12]"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void confirmarAgregar()}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Sí, agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoRotar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar regeneración de enlace"
            onClick={() => !rotandoId && setConfirmandoRotar(null)}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-rotar-enlace"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <h2 id="titulo-rotar-enlace" className="text-base font-semibold text-white">
              Regenerar enlace de {confirmandoRotar.nombre}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              El enlace actual dejará de funcionar. La máquina de esa mesa tendrá que abrir el nuevo.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmandoRotar(null)}
                disabled={rotandoId !== null}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void rotarEnlace(confirmandoRotar)}
                disabled={rotandoId !== null}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rotandoId ? 'Regenerando…' : 'Regenerar enlace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar eliminación de mesa"
            onClick={cerrarEliminar}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <form
            onSubmit={(e) => void eliminarMesa(e)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-eliminar-mesa"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <h2 id="titulo-eliminar-mesa" className="text-base font-semibold text-white">
              Eliminar mesa {confirmandoEliminar.nombre}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Se borrará la mesa y su enlace. Esta acción no se puede deshacer.
            </p>
            <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/80">
              Escribe tu contraseña para confirmar.
            </p>

            <label htmlFor="password-eliminar" className="mt-4 mb-1 block text-xs text-slate-400">
              Contraseña
            </label>
            <input
              id="password-eliminar"
              type="password"
              autoComplete="current-password"
              value={passwordEliminar}
              onChange={(e) => setPasswordEliminar(e.target.value)}
              autoFocus
              disabled={eliminando}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
            />

            {errorEliminar && <p className="mt-3 text-sm text-red-400">{errorEliminar}</p>}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cerrarEliminar}
                disabled={eliminando}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eliminando || passwordEliminar.length === 0}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {eliminando ? 'Eliminando…' : 'Eliminar mesa'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function ResumenTarjeta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}
