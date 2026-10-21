import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import BoltIcon from '@hugeicons/core-free-icons/BoltIcon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserCheck01Icon from '@hugeicons/core-free-icons/UserCheck01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import { supabase } from '../../lib/supabase'
import MagicBento, { type MagicBentoItem } from '../../components/ui/MagicBento'

type Vista = 'candidatos' | 'mesas' | 'padron'

type Resumen = {
  votantes: number
  votaron: number
  pendientes: number
  participacion: number
  candidatosActivos: number
  candidatosTotal: number
  mesasActivas: number
  mesasTotal: number
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
  mesasTotal: 0
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [resumen, setResumen] = useState<Resumen>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)

    const [estadisticas, candidatos, mesas] = await Promise.all([
      supabase.rpc('obtener_estadisticas_padron'),
      supabase.from('candidatos').select('activo'),
      supabase.from('mesas').select('activo')
    ])

    if (estadisticas.error || candidatos.error || mesas.error) {
      setError('No se pudo cargar el resumen general.')
      setCargando(false)
      return
    }

    const est = (estadisticas.data?.[0] ?? {}) as EstadisticasRpc
    const listaCandidatos = (candidatos.data ?? []) as { activo: boolean }[]
    const listaMesas = (mesas.data ?? []) as { activo: boolean }[]

    setResumen({
      votantes: Number(est.total_votantes ?? 0),
      votaron: Number(est.total_votaron ?? 0),
      pendientes: Number(est.total_pendientes ?? 0),
      participacion: Number(est.participacion_pct ?? 0),
      candidatosActivos: listaCandidatos.filter(c => c.activo).length,
      candidatosTotal: listaCandidatos.length,
      mesasActivas: listaMesas.filter(m => m.activo).length,
      mesasTotal: listaMesas.length
    })
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

  const accesos: Array<{ label: string; vista: Vista; glyph: typeof UserGroupIcon }> = [
    { label: 'Candidatos', vista: 'candidatos', glyph: UserGroupIcon },
    { label: 'Mesas', vista: 'mesas', glyph: Table01Icon },
    { label: 'Padrón', vista: 'padron', glyph: IdCardIcon }
  ]

  const items: MagicBentoItem[] = [
    {
      id: 'participacion',
      label: 'Padrón electoral',
      title: 'Participación general',
      description: `${participacion}% del padrón · ${resumen.votaron} de ${resumen.votantes} votantes`,
      visual: 'analytics',
      colSpan: 2,
      rowSpan: 2
    },
    {
      id: 'votaron',
      label: 'Avance',
      title: `${resumen.votaron}`,
      description: 'Votantes que ya emitieron su voto',
      visual: 'dashboard'
    },
    {
      id: 'pendientes',
      content: (
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mb-muted)]">
            <HugeiconsIcon icon={UserCheck01Icon} size={15} strokeWidth={1.8} />
            Por sufragar
          </div>
          <div className="mt-auto">
            <p className="text-4xl font-semibold tracking-tight text-[color:var(--mb-ink)] tabular-nums">
              {resumen.pendientes}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-sky-500"
                style={{ width: `${Math.min(100, Math.max(0, 100 - resumen.participacion))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[color:var(--mb-muted)]">{participacion}% del padrón ya votó</p>
          </div>
        </div>
      )
    },
    {
      id: 'candidatos',
      content: (
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mb-muted)]">
            <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.8} />
            Candidatos
          </div>
          <div className="mt-auto">
            <p className="text-3xl font-semibold tracking-tight text-[color:var(--mb-ink)] tabular-nums">
              {resumen.candidatosActivos}
            </p>
            <p className="text-xs text-[color:var(--mb-muted)]">
              activos de {resumen.candidatosTotal} registrados
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-sky-500"
                style={{
                  width: `${
                    resumen.candidatosTotal > 0
                      ? (resumen.candidatosActivos / resumen.candidatosTotal) * 100
                      : 0
                  }%`
                }}
              />
            </div>
          </div>
        </div>
      ),
      colSpan: 2,
      onClick: () => onNavigate('candidatos')
    },
    {
      id: 'mesas',
      label: 'Mesas',
      title: `${resumen.mesasActivas} activas`,
      description: `de ${resumen.mesasTotal} mesas registradas`,
      visual: 'integration',
      onClick: () => onNavigate('mesas')
    },
    {
      id: 'padron',
      content: (
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mb-muted)]">
            <HugeiconsIcon icon={IdCardIcon} size={15} strokeWidth={1.8} />
            Padrón
          </div>
          <div className="mt-auto">
            <p className="text-3xl font-semibold tracking-tight text-[color:var(--mb-ink)] tabular-nums">
              {resumen.votantes}
            </p>
            <p className="text-xs text-[color:var(--mb-muted)]">votantes registrados</p>
          </div>
        </div>
      ),
      onClick: () => onNavigate('padron')
    },
    {
      id: 'accesos',
      content: (
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mb-muted)]">
            <HugeiconsIcon icon={BoltIcon} size={15} strokeWidth={1.8} />
            Accesos rápidos
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2">
            {accesos.map(acceso => (
              <button
                key={acceso.vista}
                type="button"
                onClick={() => onNavigate(acceso.vista)}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-4 text-[11px] font-medium text-[color:var(--mb-ink)] transition hover:border-blue-300/30 hover:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400/60"
              >
                <HugeiconsIcon icon={acceso.glyph} size={18} strokeWidth={1.8} />
                {acceso.label}
              </button>
            ))}
          </div>
        </div>
      ),
      colSpan: 2
    }
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
          <h2 className="text-xl font-bold text-white">Resumen general</h2>
          {cargando && <span className="text-xs uppercase tracking-widest text-blue-200/50">Actualizando…</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs capitalize text-slate-500">{fecha}</span>
          <button
            type="button"
            onClick={() => void cargar()}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-white/[0.1]"
          >
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-xl">
          {error}
        </p>
      )}

      <MagicBento
        items={items}
        columns={4}
        rowHeight={170}
        gap={14}
        radius={22}
        glowColor="#3b82f6"
        spotlightRadius={320}
        enableBorderGlow
        enableSpotlight
        clickEffect
        enableStars={false}
        enableTilt={false}
        enableMagnetism={false}
        textAutoHide
        intro
        style={
          {
            '--mb-surface':
              'linear-gradient(180deg, rgba(13, 22, 43, 0.72) 0%, rgba(7, 12, 26, 0.66) 100%)',
            '--mb-shadow':
              '0 30px 70px -40px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
          } as CSSProperties
        }
      />
    </section>
  )
}
