import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { borrarMesa, mensajeBorrado } from '../../lib/borrado'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { nombresMesasGrupo } from '../../lib/mesas'
import { useToast } from '../../components/ui/ToastProvider'
import { MesasSkeleton } from '../panel/PanelSkeletons'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'
import { Badge } from '../../components/ui/Badge'
import { AdminModal } from '../../components/ui/AdminModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { RevealSection } from '../../components/ui/RevealSection'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { HugeiconsIcon } from '@hugeicons/react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon'
import Rotate01Icon from '@hugeicons/core-free-icons/Rotate01Icon'
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon'
import CommandLineIcon from '@hugeicons/core-free-icons/CommandLineIcon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'

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

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°'] as const
const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

const CLASE_SELECT =
  'w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

function enlaceDeMesa(mesa: Mesa): string {
  if (!mesa.token_acceso) return ''
  return `${window.location.origin}/votar/${mesa.token_acceso}`
}

/**
 * Comando para abrir la mesa a pantalla completa en la máquina del salón.
 * Usa la ruta estándar de Chrome en Windows; la guía MODO_KIOSCO.md incluye
 * alternativas para Edge, macOS y Linux.
 */
function comandoKiosco(mesa: Mesa): string {
  const enlace = enlaceDeMesa(mesa)
  if (!enlace) return ''
  return `& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk "${enlace}"`
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

  // Alta individual (selects nativos) o alta en grupo (varios grados/secciones)
  const [modoAlta, setModoAlta] = useState<'individual' | 'grupo'>('individual')
  const [grado, setGrado] = useState('')
  const [seccion, setSeccion] = useState('')
  const [gradosGrupo, setGradosGrupo] = useState<string[]>([])
  const [seccionesGrupo, setSeccionesGrupo] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [rotandoId, setRotandoId] = useState<string | null>(null)
  const [confirmandoRotar, setConfirmandoRotar] = useState<Mesa | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [copiadoComandoId, setCopiadoComandoId] = useState<string | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Mesa | null>(null)
  const [passwordEliminar, setPasswordEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)

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

  async function agregarMesa(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(null)
    if (!grado.trim() || !seccion.trim()) {
      setError('Selecciona el grado y la sección.')
      return
    }
    const nombreMesa = `${grado.trim()} ${seccion.trim()}`
    setGuardando(true)

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
    toast({ title: 'Mesa agregada', description: mensajeCambio, variant: 'success', duration: 3000 })
    await cargar()
  }

  const nombresGrupo = nombresMesasGrupo(gradosGrupo, seccionesGrupo)

  function alternar(valor: string, seleccionados: string[], cambiar: (lista: string[]) => void) {
    cambiar(
      seleccionados.includes(valor)
        ? seleccionados.filter((item) => item !== valor)
        : [...seleccionados, valor]
    )
  }

  async function agregarGrupo() {
    setError(null)
    setExito(null)
    if (nombresGrupo.length === 0) {
      setError('Selecciona al menos un grado y una sección.')
      return
    }

    const existentes = new Set(mesas.map((m) => m.nombre.trim().toLowerCase()))
    const nuevos = nombresGrupo.filter((nombre) => !existentes.has(nombre.toLowerCase()))
    if (nuevos.length === 0) {
      setError('Todas esas mesas ya existen. Cambia la selección o edita una mesa.')
      return
    }

    setGuardando(true)
    const { error: err } = await supabase.from('mesas')
      .insert(nuevos.map((nombre) => ({ nombre, activo: true })))
    setGuardando(false)

    if (err) {
      setError(mensajeDeError(err, 'No se pudieron agregar las mesas.'))
      return
    }

    const omitidas = nombresGrupo.length - nuevos.length
    const mensaje = `Se agregaron ${nuevos.length} ${nuevos.length === 1 ? 'mesa' : 'mesas'}` +
      (omitidas > 0 ? ` (${omitidas} ya existían).` : '.')
    setExito(mensaje)
    toast({ title: 'Mesas agregadas', description: nuevos.join(', '), variant: 'success', duration: 5000 })
    setGradosGrupo([])
    setSeccionesGrupo([])
    await cargar()
  }

  function iniciarEdicion(m: Mesa) {
    setEditandoId(m.id)
    setEditNombre(m.nombre)
    setError(null)
    setExito(null)
    setMenuAbierto(null)
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
    setMenuAbierto(null)

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

  async function copiarComandoKiosco(m: Mesa) {
    const comando = comandoKiosco(m)
    if (!comando) {
      setError('Esta mesa no tiene enlace.')
      return
    }
    try {
      await navigator.clipboard.writeText(comando)
      setCopiadoComandoId(m.id)
      toast({
        title: 'Comando kiosco copiado',
        description: m.nombre,
        variant: 'success',
        duration: 2500
      })
      window.setTimeout(
        () => setCopiadoComandoId((actual) => actual === m.id ? null : actual),
        2500
      )
    } catch {
      setError('No se pudo copiar el comando.')
    }
  }

  async function rotarEnlace(m: Mesa) {
    setRotandoId(m.id)
    setError(null)
    setExito(null)
    setMenuAbierto(null)
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

  async function eliminarMesa() {
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

      const resultado = await borrarMesa(confirmandoEliminar.id)

      if (!resultado.ok) {
        setErrorEliminar(mensajeBorrado(resultado))
        return
      }

      const mensajeCambio = `se eliminó la mesa ${confirmandoEliminar.nombre}`
      setExito(mensajeCambio)
      toast({ title: 'Mesa eliminada', description: mensajeCambio, variant: 'success', duration: 3000 })
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
    mesas: mesas.length,
    activas: mesas.filter((m) => m.activo).length,
    padron: Number(resumenGlobal?.total_padron ?? 0),
    votaron: Number(resumenGlobal?.votaron ?? 0),
    votos: totalVotos
  }

  return (    <RevealSection className="space-y-6">
      <SectionHeader
        title="Mesas / Salones"
        description="Administra las mesas, sus enlaces y la participación."
        actions={
          <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </AdminButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mesas activas</p>
              <p className="text-2xl font-bold text-white">{totales.activas}</p>
              <p className="text-xs text-slate-400">de {totales.mesas} registradas</p>
            </div>
            <Badge variant="info">Gestionar</Badge>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">En padrón</p>
              <p className="text-2xl font-bold text-white">{totales.padron}</p>
            </div>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ya votaron</p>
              <p className="text-2xl font-bold text-white">{totales.votaron}</p>
            </div>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Votos registrados</p>
              <p className="text-2xl font-bold text-white">{totales.votos}</p>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Agrega una mesa suelta o crea varias de una vez combinando grados y secciones.
          </p>

          <div className="inline-flex rounded-xl border border-white/10 bg-black/25 p-1" role="group" aria-label="Modo de alta de mesas">
            <button
              type="button"
              onClick={() => setModoAlta('individual')}
              aria-pressed={modoAlta === 'individual'}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                modoAlta === 'individual' ? 'bg-blue-500/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setModoAlta('grupo')}
              aria-pressed={modoAlta === 'grupo'}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                modoAlta === 'grupo' ? 'bg-blue-500/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Varios grados / secciones
            </button>
          </div>

          {modoAlta === 'individual' ? (
            <form onSubmit={agregarMesa} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-44">
                <label htmlFor="mesa-grado" className="mb-1 block text-xs text-slate-400">Grado</label>
                <select
                  id="mesa-grado"
                  value={grado}
                  onChange={(e) => setGrado(e.target.value)}
                  className={CLASE_SELECT}
                >
                  <option value="">Seleccionar el grado</option>
                  {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="sm:w-44">
                <label htmlFor="mesa-seccion" className="mb-1 block text-xs text-slate-400">Sección</label>
                <select
                  id="mesa-seccion"
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  className={CLASE_SELECT}
                >
                  <option value="">Seleccionar la sección</option>
                  {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={guardando || !grado || !seccion}
                className="rounded-xl bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {guardando ? 'Agregando…' : 'Agregar mesa'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grados</p>
                <div className="flex flex-wrap gap-2">
                  {GRADOS.map((g) => {
                    const activo = gradosGrupo.includes(g)
                    return (
                      <label
                        key={g}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                          activo
                            ? 'border-blue-400/50 bg-blue-500/15 text-white'
                            : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/8'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => alternar(g, gradosGrupo, setGradosGrupo)}
                          className="sr-only"
                        />
                        {g}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Secciones</p>
                <div className="flex flex-wrap gap-2">
                  {SECCIONES.map((s) => {
                    const activo = seccionesGrupo.includes(s)
                    return (
                      <label
                        key={s}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                          activo
                            ? 'border-blue-400/50 bg-blue-500/15 text-white'
                            : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/8'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => alternar(s, seccionesGrupo, setSeccionesGrupo)}
                          className="sr-only"
                        />
                        {s}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-400">
                  {nombresGrupo.length} {nombresGrupo.length === 1 ? 'mesa a crear' : 'mesas a crear'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nombresGrupo.length === 0 ? (
                    <span className="text-xs text-slate-500">Selecciona grados y secciones…</span>
                  ) : (
                    nombresGrupo.map((nombre) => (
                      <span key={nombre} className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-xs text-blue-100">
                        {nombre}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void agregarGrupo()}
                disabled={guardando || nombresGrupo.length === 0}
                className="rounded-xl bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {guardando ? 'Agregando…' : `Agregar ${nombresGrupo.length} ${nombresGrupo.length === 1 ? 'mesa' : 'mesas'}`}
              </button>
              <p className="text-xs text-slate-500">
                Ejemplo: 1° con A, B y C crea 1° A, 1° B y 1° C. Las mesas que ya existan se omiten.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {exito && <p className="text-sm text-emerald-400">{exito}</p>}

          <details className="group text-xs text-slate-500">
            <summary className="cursor-pointer select-none font-medium text-slate-400 transition hover:text-white">
              ℹ️ Cómo funciona el enlace de cada mesa
            </summary>
            <div className="mt-1.5 space-y-2 leading-relaxed">
              <p>
                Cada mesa recibe un enlace único. Ábrelo en la máquina de ese salón y el voto quedará
                registrado en esa mesa. Si regeneras el enlace, el anterior deja de funcionar.
              </p>
              <p>
                Para dejarla a pantalla completa, abre Chrome así en la máquina del salón:
              </p>
              <code className="block overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-slate-300">
                chrome --kiosk "https://tu-dominio/votar/TOKEN"
              </code>
              <p>
                En el menú <span className="text-slate-300">Más</span> de cada mesa tienes{' '}
                <span className="text-slate-300">Copiar comando kiosco</span>. La guía completa
                (Edge, macOS, Linux e inicio automático) está en{' '}
                <span className="text-slate-300">MODO_KIOSCO.md</span>.
              </p>
            </div>
          </details>
        </div>
      </AdminCard>

      {cargando && !tieneDatos && <MesasSkeleton />}
      {tieneDatos && mesas.length === 0 && (
        <AdminCard>
          <EmptyState
            icon={<HugeiconsIcon icon={Table01Icon} size={22} strokeWidth={1.7} />}
            title="No hay mesas configuradas"
            description="Crea la primera mesa para generar un enlace único de votación para ese salón."
            action={
              <AdminButton
                size="sm"
                onClick={() => {
                  setModoAlta('individual')
                  requestAnimationFrame(() => document.getElementById('mesa-grado')?.focus())
                }}
              >
                Agregar mesa
              </AdminButton>
            }
          />
        </AdminCard>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {mesas.map((m) => {
          const r = resumenes[m.id]
          const votosMesa = Number(r?.votos_emitidos ?? 0)
          const porcentajeVotos = totalVotos > 0 ? (votosMesa / totalVotos) * 100 : 0
          const enlace = enlaceDeMesa(m)
          const estaEditando = editandoId === m.id
          const menuEstaAbierto = menuAbierto === m.id

          return (
            <li key={m.id} className="rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl space-y-3">
              {estaEditando ? (
                <form onSubmit={(e) => { e.preventDefault(); void guardarEdicion(m); }} className="flex flex-col gap-2">
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
                  <div className="flex gap-2">
                    <button type="submit"
                      className="flex-1 rounded-lg bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelarEdicion}
                      className="flex-1 rounded-lg border border-white/10 bg-white/6 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/10">
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
                        className="h-full rounded-full bg-linear-to-r from-blue-400 to-sky-500"
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
                      <HugeiconsIcon icon={Link01Icon} size={13} strokeWidth={1.8} />
                      {copiadoId === m.id ? 'Copiado' : 'Copiar enlace'}
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEnlace(m)}
                      disabled={!enlace || !m.activo}
                      className="rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <HugeiconsIcon icon={Link01Icon} size={13} strokeWidth={1.8} />
                      Abrir kiosco
                    </button>

                    {/* Menú de acciones secundarias */}
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setMenuAbierto(menuEstaAbierto ? null : m.id)}
                        className="rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/10"
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={13} strokeWidth={1.8} />
                        Más
                      </button>
                      {menuEstaAbierto && (
                        <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl z-50">
                          <button
                            type="button"
                            onClick={() => { setMenuAbierto(null); void rotarEnlace(m) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 hover:text-white transition"
                          >
                            <HugeiconsIcon icon={Rotate01Icon} size={13} strokeWidth={1.8} />
                            Regenerar enlace
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMenuAbierto(null); void copiarComandoKiosco(m) }}
                            disabled={!enlace}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <HugeiconsIcon icon={CommandLineIcon} size={13} strokeWidth={1.8} />
                            {copiadoComandoId === m.id ? 'Comando copiado' : 'Copiar comando kiosco'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMenuAbierto(null); iniciarEdicion(m) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 hover:text-white transition"
                          >
                            <HugeiconsIcon icon={Edit02Icon} size={13} strokeWidth={1.8} />
                            Editar nombre
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMenuAbierto(null); void alternarActivo(m) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 hover:text-white transition"
                          >
                            {m.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <hr className="my-1 border-white/5" />
                          <button
                            type="button"
                            onClick={() => {
                              setMenuAbierto(null)
                              setConfirmandoEliminar(m)
                              setPasswordEliminar('')
                              setErrorEliminar(null)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10 transition"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={1.8} />
                            Eliminar mesa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {confirmandoRotar && (
        <AdminModal
          open={confirmandoRotar !== null}
          onClose={() => { if (!rotandoId) setConfirmandoRotar(null) }}
          title={`Regenerar enlace de ${confirmandoRotar.nombre}`}
          description="El enlace actual dejará de funcionar. La máquina de esa mesa tendrá que abrir el nuevo."
          confirmLabel="Regenerar enlace"
          confirmVariant="danger"
          tone="warning"
          loading={rotandoId !== null}
          onConfirm={() => void rotarEnlace(confirmandoRotar)}
        />
      )}

      {confirmandoEliminar && (
        <AdminModal
          open={confirmandoEliminar !== null}
          onClose={cerrarEliminar}
          title={`Eliminar mesa ${confirmandoEliminar.nombre}`}
          description="Se borrará la mesa, su enlace y los votos registrados en ella. Esta acción no se puede deshacer."
          confirmLabel="Eliminar mesa"
          confirmVariant="danger"
          loading={eliminando}
          onConfirm={() => void eliminarMesa()}
        >
          <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/6 px-3 py-2 text-xs text-amber-100/80">
            Escribe tu contraseña para confirmar.
          </p>

          <label htmlFor="password-eliminar" className="mt-4 mb-1 block text-xs text-slate-400">
            Contraseña
          </label>
          <PasswordInput
            id="password-eliminar"
            autoComplete="current-password"
            value={passwordEliminar}
            onChange={(e) => setPasswordEliminar(e.target.value)}
            autoFocus
            disabled={eliminando}
            className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
          />

          {errorEliminar && <p className="mt-3 text-sm text-red-400">{errorEliminar}</p>}
        </AdminModal>
      )}
    </RevealSection>
  )
}
