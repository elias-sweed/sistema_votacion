import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { DashboardSkeleton } from '../panel/PanelSkeletons'
import { StatCard } from '../../components/ui/StatCard'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { Badge } from '../../components/ui/Badge'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'

type Vista = 'candidatos' | 'mesas' | 'padron' | 'configuracion'

type Resumen = {
  votantes: number
  votaron: number
  pendientes: number
  participacion: number
  candidatosActivos: number
  candidatosTotal: number
  mesasActivas: number
  mesasTotal: number
  eleccionAbierta: boolean
  titulo: string
  centro: string
}

type EstadisticasRpc = {
  total_votantes?: number
  total_votaron?: number
  total_pendientes?: number
  participacion_pct?: number
}

type DashboardPageProps = {
  onNavigate: (vista: Vista) => void
}

const VACIO: Resumen = {
  votantes: 0,
  votaron: 0,
  pendientes: 0,
  participacion: 0,
  candidatosActivos: 0,
  candidatosTotal: 0,
  mesasActivas: 0,
  mesasTotal: 0,
  eleccionAbierta: false,
  titulo: '',
  centro: ''
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [resumenInicial] = useState(() => leerCache<Partial<Resumen>>(CLAVES_CACHE.dashboard))
  const [resumen, setResumen] = useState<Resumen>(() => ({ ...VACIO, ...(resumenInicial ?? {}) }))
  const [cargando, setCargando] = useState(resumenInicial === null)
  const [tieneDatos, setTieneDatos] = useState(resumenInicial !== null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)

    const [estadisticas, candidatos, mesas, configuracion] = await Promise.all([
      supabase.rpc('obtener_estadisticas_padron'),
      supabase.from('candidatos').select('activo'),
      supabase.from('mesas').select('activo'),
      supabase.from('configuracion').select('eleccion_abierta, titulo, centro').eq('id', 1).maybeSingle()
    ])

    if (estadisticas.error || candidatos.error || mesas.error || configuracion.error) {
      setError(
        mensajeDeError(
          estadisticas.error ?? candidatos.error ?? mesas.error ?? configuracion.error,
          'No se pudo cargar el resumen general.'
        )
      )
      setCargando(false)
      return
    }

    const est = (estadisticas.data?.[0] ?? {}) as EstadisticasRpc
    const listaCandidatos = (candidatos.data ?? []) as { activo: boolean }[]
    const listaMesas = (mesas.data ?? []) as { activo: boolean }[]
    const conf = (configuracion.data ?? {}) as { eleccion_abierta?: boolean; titulo?: string; centro?: string }

    const nuevoResumen: Resumen = {
      votantes: Number(est.total_votantes ?? 0),
      votaron: Number(est.total_votaron ?? 0),
      pendientes: Number(est.total_pendientes ?? 0),
      participacion: Number(est.participacion_pct ?? 0),
      candidatosActivos: listaCandidatos.filter(c => c.activo).length,
      candidatosTotal: listaCandidatos.length,
      mesasActivas: listaMesas.filter(m => m.activo).length,
      mesasTotal: listaMesas.length,
      eleccionAbierta: conf.eleccion_abierta === true,
      titulo: typeof conf.titulo === 'string' ? conf.titulo : '',
      centro: typeof conf.centro === 'string' ? conf.centro : ''
    }
    setResumen(nuevoResumen)
    guardarCache(CLAVES_CACHE.dashboard, nuevoResumen)
    setTieneDatos(true)
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const participacion = Number.isFinite(resumen.participacion) ? resumen.participacion.toFixed(1) : '0.0'
  const fecha = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  const estadoEleccion = resumen.eleccionAbierta ? 'abierta' : 'cerrada'
  const estadoClase = resumen.eleccionAbierta
    ? 'border-emerald-400/30 bg-emerald-500/[0.07]'
    : 'border-amber-400/30 bg-amber-500/[0.07]'
  const estadoColor = resumen.eleccionAbierta ? 'bg-emerald-400' : 'bg-amber-400'

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Resumen general"
          description={fecha}
          actions={
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={() => void cargar()}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </AdminButton>
          }
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-xl">
          {error}
        </p>
      )}

      <div className={`rounded-2xl border p-4 px-5 backdrop-blur-md flex items-center justify-between gap-3 ${estadoClase}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${estadoColor}`} aria-hidden="true" />
          <p className="text-sm font-semibold text-white">Elección {estadoEleccion}</p>
          <p className="text-xs text-slate-400">{resumen.titulo}</p>
        </div>
        <p className="text-xs text-slate-500">{resumen.centro}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Votantes en padrón" value={resumen.votantes} subtitle={`Pendientes: ${resumen.pendientes}`} />
        <StatCard label="Ya votaron" value={resumen.votaron} subtitle={`${participacion}% de participación`} />
        <StatCard label="Candidatos activos" value={resumen.candidatosActivos} subtitle={`de ${resumen.candidatosTotal}`} />
        <StatCard label="Mesas activas" value={resumen.mesasActivas} subtitle={`de ${resumen.mesasTotal}`} />
      </div>

      {cargando && !tieneDatos ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <AdminCard className="hover:border-blue-400/40 transition border-transparent" onClick={() => onNavigate('candidatos')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Candidatos</p>
                <p className="text-2xl font-bold text-white">{resumen.candidatosActivos}</p>
                <p className="text-xs text-slate-400">activos de {resumen.candidatosTotal} registrados</p>
              </div>
              <Badge variant="info">Gestionar</Badge>
            </div>
          </AdminCard>

          <AdminCard className="hover:border-blue-400/40 transition border-transparent" onClick={() => onNavigate('mesas')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mesas</p>
                <p className="text-2xl font-bold text-white">{resumen.mesasActivas}</p>
                <p className="text-xs text-slate-400">activas de {resumen.mesasTotal} registradas</p>
              </div>
              <Badge variant="info">Gestionar</Badge>
            </div>
          </AdminCard>

          <AdminCard className="hover:border-blue-400/40 transition border-transparent" onClick={() => onNavigate('padron')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Padrón</p>
                <p className="text-2xl font-bold text-white">{resumen.votantes}</p>
                <p className="text-xs text-slate-400">votantes registrados</p>
              </div>
              <Badge variant="info">Gestionar</Badge>
            </div>
          </AdminCard>

          <AdminCard className="hover:border-blue-400/40 transition border-transparent" onClick={() => onNavigate('configuracion')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Configuración</p>
                <p className="text-2xl font-bold text-white">{estadoEleccion}</p>
                <p className="text-xs text-slate-400">Estado de la elección</p>
              </div>
              <Badge variant="info">Gestionar</Badge>
            </div>
          </AdminCard>
        </div>
      )}
    </section>
  )
}
