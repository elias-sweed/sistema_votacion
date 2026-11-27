import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { borrarMesa, mensajeBorrado } from '../../lib/borrado'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
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
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import CommandLineIcon from '@hugeicons/core-free-icons/CommandLineIcon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon'
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon'
import PauseIcon from '@hugeicons/core-free-icons/PauseIcon'
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon'
import Rotate01Icon from '@hugeicons/core-free-icons/Rotate01Icon'
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

const NOMBRE_PRINCIPAL = 'Mesa principal'

function esPrincipal(mesa: Mesa): boolean {
  return mesa.nombre.trim().toLowerCase() === NOMBRE_PRINCIPAL.toLowerCase()
}

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
  const menuRef = useRef<HTMLDivElement>(null)
  const [mesasInicial] = useState(() => leerCache<Mesa[]>(CLAVES_CACHE.mesas))
  const [mesas, setMesas] = useState<Mesa[]>(mesasInicial ?? [])
  const [resumenes, setResumenes] = useState<Record<string, ResumenMesa>>({})
  const [cargando, setCargando] = useState(mesasInicial === null)
  const [tieneDatos, setTieneDatos] = useState(mesasInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [rotando, setRotando] = useState(false)
  const [confirmandoRotar, setConfirmandoRotar] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [copiadoComandoId, setCopiadoComandoId] = useState<string | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [passwordEliminar, setPasswordEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  // Una sola mesa: se respeta la ya creada con este nombre y, si no existe,
  // se adopta la primera para no perder los votos registrados.
  const mesa = mesas.find(esPrincipal) ?? mesas[0] ?? null
  const resumen = mesa ? resumenes[mesa.id] ?? null : null
  const enlace = mesa ? enlaceDeMesa(mesa) : ''

  useEffect(() => { void cargar() }, [])

  useEffect(() => {
    if (!menuAbierto) return
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('keydown', alPresionar)
    menuRef.current?.querySelector<HTMLButtonElement>('[data-accion]')?.focus()
    return () => document.removeEventListener('keydown', alPresionar)
  }, [menuAbierto])

  async function cargar() {
    setCargando(true)
    setError(null)

    const [mesasRes, resumenRes] = await Promise.all([
      supabase.from('mesas').select('*').order('creado_en', { ascending: true }),
      supabase.rpc('obtener_resumen_mesas')
    ])

    setCargando(false)

    if (mesasRes.error) {
      setError(mensajeDeError(mesasRes.error, 'No se pudo cargar la mesa principal.'))
      return
    }

    const lista = (mesasRes.data ?? []) as Mesa[]
    setMesas(lista)
    guardarCache(CLAVES_CACHE.mesas, lista)
    setTieneDatos(true)

    if (resumenRes.error) {
      setError(mensajeDeError(resumenRes.error, 'No se pudo cargar la participación.'))
      return
    }

    const mapa: Record<string, ResumenMesa> = {}
    for (const fila of (resumenRes.data ?? []) as ResumenMesa[]) {
      mapa[fila.mesa_id] = fila
    }
    setResumenes(mapa)
  }

  async function crearMesaPrincipal() {
    setError(null)
    setExito(null)
    setGuardando(true)

    const { error: err } = await supabase.from('mesas')
      .insert({ nombre: NOMBRE_PRINCIPAL, activo: true })
    setGuardando(false)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo crear la mesa principal.'))
      return
    }

    setExito('Se creó la mesa principal con su enlace único.')
    toast({ title: 'Mesa principal creada', variant: 'success', duration: 3000 })
    await cargar()
  }

  function iniciarEdicion() {
    if (!mesa) return
    setEditNombre(mesa.nombre)
    setError(null)
    setExito(null)
    setMenuAbierto(false)
    setEditando(true)
  }

  async function guardarNombre() {
    if (!mesa) return
    const nombre = editNombre.trim()
    if (!nombre) {
      setError('Escribe un nombre para la mesa.')
      return
    }
    if (nombre === mesa.nombre) {
      setEditando(false)
      return
    }

    const { error: err } = await supabase.from('mesas')
      .update({ nombre }).eq('id', mesa.id)
    if (err) return

    setEditando(false)
    setExito('Nombre actualizado.')
    toast({ title: 'Nombre actualizado', description: nombre, variant: 'success', duration: 2500 })
    await cargar()
  }

  async function alternarActivo() {
    if (!mesa) return
    setError(null)
    setExito(null)
    setMenuAbierto(false)

    const { error: err } = await supabase.from('mesas')
      .update({ activo: !mesa.activo }).eq('id', mesa.id)
    if (err) {
      toast({ title: 'No se pudo actualizar', description: mensajeDeError(err, err.message), variant: 'error', duration: 6000 })
      return
    }

    setMesas((prev) => {
      const siguiente = prev.map((x) => x.id === mesa.id ? { ...x, activo: !x.activo } : x)
      guardarCache(CLAVES_CACHE.mesas, siguiente)
      return siguiente
    })
    toast({
      title: mesa.activo ? 'Mesa desactivada' : 'Mesa activada',
      description: mesa.nombre,
      variant: 'success',
      duration: 3000
    })
  }

  async function copiarEnlace() {
    if (!enlace) {
      setError('La mesa no tiene enlace.')
      return
    }
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiadoId(mesa?.id ?? null)
      setExito('Enlace copiado al portapapeles.')
      toast({ title: 'Enlace copiado', variant: 'success', duration: 2500 })
      window.setTimeout(() => setCopiadoId(null), 2500)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  function abrirEnlace() {
    if (!enlace || !mesa?.activo) {
      setError('El enlace no está disponible.')
      return
    }
    window.open(enlace, '_blank', 'noopener,noreferrer')
  }

  async function copiarComandoKiosco() {
    const comando = mesa ? comandoKiosco(mesa) : ''
    if (!comando) {
      setError('La mesa no tiene enlace.')
      return
    }
    try {
      await navigator.clipboard.writeText(comando)
      setCopiadoComandoId(mesa?.id ?? null)
      toast({ title: 'Comando kiosco copiado', variant: 'success', duration: 2500 })
      window.setTimeout(() => setCopiadoComandoId(null), 2500)
    } catch {
      setError('No se pudo copiar el comando.')
    }
  }

  async function rotarEnlace() {
    if (!mesa || rotando) return
    setRotando(true)
    setError(null)
    setExito(null)

    const { data, error: err } = await supabase.rpc('rotar_token_mesa', { p_mesa_id: mesa.id })
    setRotando(false)
    setConfirmandoRotar(false)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo regenerar el enlace.'))
      return
    }
    if (typeof data !== 'string' || data.length < 16) {
      setError('El servidor no devolvió un enlace válido.')
      return
    }

    setMesas((prev) => {
      const siguiente = prev.map((x) => x.id === mesa.id ? { ...x, token_acceso: data } : x)
      guardarCache(CLAVES_CACHE.mesas, siguiente)
      return siguiente
    })
    setExito('Enlace regenerado. El anterior ya no funciona.')
    toast({ title: 'Enlace regenerado', variant: 'success', duration: 3000 })
  }

  function cerrarEliminar() {
    if (eliminando) return
    setConfirmandoEliminar(false)
    setPasswordEliminar('')
    setErrorEliminar(null)
  }

  async function eliminarMesa() {
    if (!mesa || eliminando) return

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

      const resultado = await borrarMesa(mesa.id)
      if (!resultado.ok) {
        setErrorEliminar(mensajeBorrado(resultado))
        return
      }

      setExito('Se eliminó la mesa principal y su enlace.')
      toast({ title: 'Mesa eliminada', variant: 'success', duration: 3000 })
      cerrarEliminar()
      await cargar()
    } finally {
      setEliminando(false)
    }
  }

  function filaMenu(
    icono: typeof Edit02Icon,
    etiqueta: string,
    alHacerClic: () => void,
    opciones: { peligro?: boolean; deshabilitado?: boolean } = {}
  ) {
    return (
      <button
        type="button"
        data-accion
        disabled={opciones.deshabilitado}
        onClick={alHacerClic}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
          opciones.peligro
            ? 'text-red-200 hover:bg-red-500/12'
            : 'text-slate-100 hover:bg-white/[0.09]'
        }`}
      >
        <HugeiconsIcon icon={icono} size={17} strokeWidth={1.8} />
        <span className="flex-1">{etiqueta}</span>
      </button>
    )
  }

  return (
    <RevealSection className="space-y-6">
      <SectionHeader
        title="Mesa principal"
        description="Un solo enlace para toda la votación."
        actions={
          <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </AdminButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">En padrón</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(resumen?.total_padron ?? 0)}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ya votaron</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(resumen?.votaron ?? 0)}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Votos por este enlace</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(resumen?.votos_emitidos ?? 0)}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Participación</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(resumen?.participacion_pct ?? 0).toFixed(0)}%</p>
        </AdminCard>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {exito && <p className="text-sm text-emerald-400">{exito}</p>}

      {cargando && !tieneDatos && <MesasSkeleton />}

      {tieneDatos && !cargando && !mesa && (
        <AdminCard>
          <EmptyState
            icon={<HugeiconsIcon icon={Table01Icon} size={22} strokeWidth={1.7} />}
            title="No hay mesa principal"
            description="Crea la mesa principal para generar el enlace único de votación."
            action={
              <AdminButton onClick={() => void crearMesaPrincipal()} disabled={guardando}>
                {guardando ? 'Creando…' : 'Crear mesa principal'}
              </AdminButton>
            }
          />
        </AdminCard>
      )}

      {mesa && (
        <AdminCard className="relative overflow-hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/12 text-blue-100">
                <HugeiconsIcon icon={Table01Icon} size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Enlace único
                </p>
                <p className="truncate text-xl font-semibold text-white">{mesa.nombre}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {mesa.activo ? 'Lista para recibir votos' : 'Enlace desactivado'}
                  {mesa.token_acceso ? ` · …${mesa.token_acceso.slice(-6)}` : ' · sin enlace'}
                </p>
              </div>
            </div>
            <Badge variant={mesa.activo ? 'success' : 'default'}>
              {mesa.activo ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Enlace de votación</p>
            <p className="mt-1 break-all font-mono text-xs text-blue-100">
              {enlace || 'Sin enlace disponible'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton onClick={() => void copiarEnlace()} disabled={!enlace}>
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={Link01Icon} size={15} strokeWidth={1.8} />
                {copiadoId === mesa.id ? 'Copiado' : 'Copiar enlace'}
              </span>
            </AdminButton>
            <AdminButton variant="secondary" onClick={abrirEnlace} disabled={!enlace || !mesa.activo}>
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={Link01Icon} size={15} strokeWidth={1.8} />
                Abrir kiosco
              </span>
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => setMenuAbierto(true)}>
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={Edit02Icon} size={15} strokeWidth={1.8} />
                Más
              </span>
            </AdminButton>
          </div>

          <details className="group mt-5 text-xs text-slate-500">
            <summary className="cursor-pointer select-none font-medium text-slate-400 transition hover:text-white">
              Cómo funciona el enlace
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Todas las personas del padrón votan desde este único enlace. Si lo regeneras, el
                anterior deja de funcionar.
              </p>
              <p>Para abrirlo a pantalla completa en la máquina del salón:</p>
              <code className="block overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-slate-300">
                chrome --kiosk "https://tu-dominio/votar/TOKEN"
              </code>
              <p>
                En <span className="text-slate-300">Más</span> puedes{' '}
                <span className="text-slate-300">copiar el comando kiosco</span>. La guía completa
                está en <span className="text-slate-300">MODO_KIOSCO.md</span>.
              </p>
            </div>
          </details>
        </AdminCard>
      )}

      {/* Acciones de la mesa: panel delantero que tapa el contenido de fondo. */}
      {menuAbierto && mesa && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cerrar acciones de la mesa"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-md"
          />
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Acciones de la mesa"
            className="relative w-full max-w-sm rounded-3xl border border-white/12 bg-slate-950/95 p-2 shadow-[0_40px_120px_-30px_rgba(0,0,0,1)] animate-modal-in"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Acciones de la mesa
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">{mesa.nombre}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setMenuAbierto(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="space-y-1">
              {filaMenu(Edit02Icon, 'Editar nombre', iniciarEdicion)}
              {filaMenu(
                mesa.activo ? PauseIcon : PlayIcon,
                mesa.activo ? 'Desactivar' : 'Activar',
                () => { setMenuAbierto(false); void alternarActivo() }
              )}
              {filaMenu(Rotate01Icon, 'Regenerar enlace', () => {
                setMenuAbierto(false)
                setConfirmandoRotar(true)
              })}
              {filaMenu(
                CommandLineIcon,
                copiadoComandoId === mesa.id ? 'Comando copiado' : 'Copiar comando kiosco',
                () => { setMenuAbierto(false); void copiarComandoKiosco() },
                { deshabilitado: !enlace }
              )}
            </div>

            <div className="my-2 h-px bg-white/8" />

            {filaMenu(Delete02Icon, 'Eliminar mesa', () => {
              setMenuAbierto(false)
              setPasswordEliminar('')
              setErrorEliminar(null)
              setConfirmandoEliminar(true)
            }, { peligro: true })}

            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs text-slate-400 transition hover:bg-white/8 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmandoRotar && mesa && (
        <AdminModal
          open={confirmandoRotar}
          onClose={() => { if (!rotando) setConfirmandoRotar(false) }}
          title={`Regenerar enlace de ${mesa.nombre}`}
          description="El enlace actual dejará de funcionar. La máquina del salón tendrá que abrir el nuevo."
          confirmLabel="Regenerar enlace"
          confirmVariant="danger"
          tone="warning"
          loading={rotando}
          onConfirm={() => void rotarEnlace()}
        />
      )}

      {editando && mesa && (
        <AdminModal
          open={editando}
          onClose={() => setEditando(false)}
          title="Editar nombre de la mesa"
          description="Este nombre aparece en el panel y en la verificación del votante."
          confirmLabel="Guardar"
          modalId="modal-nombre-mesa"
          onConfirm={() => void guardarNombre()}
        >
          <label htmlFor="nombre-mesa" className="mb-1 block text-xs text-slate-400">
            Nombre
          </label>
          <input
            id="nombre-mesa"
            autoFocus
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void guardarNombre() }}
            className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
          />
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </AdminModal>
      )}

      {confirmandoEliminar && mesa && (
        <AdminModal
          open={confirmandoEliminar}
          onClose={cerrarEliminar}
          title={`Eliminar ${mesa.nombre}`}
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
