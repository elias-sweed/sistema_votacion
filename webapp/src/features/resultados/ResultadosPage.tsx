import { useCallback, useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import ChartBarBigIcon from '@hugeicons/core-free-icons/ChartBarBigIcon'
import PrinterIcon from '@hugeicons/core-free-icons/PrinterIcon'
import Refresh01Icon from '@hugeicons/core-free-icons/Refresh01Icon'
import TrophyIcon from '@hugeicons/core-free-icons/TrophyIcon'
import UserIcon from '@hugeicons/core-free-icons/UserIcon'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { ResultadosSkeleton } from '../panel/PanelSkeletons'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import { RevealSection } from '../../components/ui/RevealSection'
import ActaImprimible from './ActaImprimible'

type VistaDestino = 'candidatos' | 'mesas' | 'configuracion'

type Resultado = {
  id: string
  nombre: string
  foto_url: string | null
  votos: number
}

type PorMesa = {
  mesa_id: string
  mesa_nombre: string
  total: number
  votaron: number
  pendientes: number
  participacion_pct: number
}

type Datos = {
  resultados: Resultado[]
  activos: Record<string, boolean>
  totalVotos: number
  totalVotantes: number
  totalVotaron: number
  totalPendientes: number
  participacion: number
  porMesa: PorMesa[]
  titulo: string
  centro: string
  eleccionAbierta: boolean
  actualizadoEn: number
}

type EstadisticasRpc = {
  total_votantes?: number
  total_votaron?: number
  total_pendientes?: number
  participacion_pct?: number
  por_mesa?: PorMesa[] | null
}

type ResultadosPageProps = {
  onNavigate: (vista: VistaDestino) => void
}

const INTERVALO_SONDEO_MS = 20000
const ESPERA_REALTIME_MS = 1200
const MEDALLAS = [
  'from-amber-300 via-amber-400 to-amber-600',
  'from-slate-200 via-slate-300 to-slate-500',
  'from-orange-300 via-orange-400 to-orange-600'
]

function iniciales(texto: string) {
  return texto
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function porcentaje(valor: number, total: number): number {
  if (total <= 0) return 0
  return (valor / total) * 100
}

function formatearPorcentaje(valor: number): string {
  return valor.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function Avatar({
  nombre,
  fotoUrl,
  className = 'h-10 w-10'
}: {
  nombre: string
  fotoUrl: string | null
  className?: string
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 ${className}`}>
      {fotoUrl ? (
        <img src={fotoUrl} alt={nombre} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-800 to-[#050a1a]">
          <span className="text-sm font-bold text-white/90">{iniciales(nombre) || '?'}</span>
        </div>
      )}
    </div>
  )
}

export default function ResultadosPage({ onNavigate }: ResultadosPageProps) {
  const [datosIniciales] = useState(() => leerCache<Datos>(CLAVES_CACHE.resultados))
  const [datos, setDatos] = useState<Datos | null>(datosIniciales)
  const [cargando, setCargando] = useState(datosIniciales === null)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enVivo, setEnVivo] = useState(false)

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCargando(true)
      setActualizando(true)
    }
    setError(null)

    const [resultados, candidatos, estadisticas, configuracion] = await Promise.all([
      supabase.from('resultados').select('id, nombre, foto_url, votos'),
      supabase.from('candidatos').select('id, activo'),
      supabase.rpc('obtener_estadisticas_padron'),
      supabase.from('configuracion').select('titulo, centro, eleccion_abierta').eq('id', 1).maybeSingle()
    ])

    const primerError = resultados.error ?? candidatos.error ?? estadisticas.error ?? configuracion.error
    if (primerError) {
      setError(mensajeDeError(primerError, 'No se pudieron cargar los resultados.'))
      setCargando(false)
      setActualizando(false)
      return
    }

    const filas = ((resultados.data ?? []) as Resultado[]).map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      foto_url: fila.foto_url ?? null,
      votos: numero(fila.votos)
    }))

    const activos: Record<string, boolean> = {}
    for (const fila of (candidatos.data ?? []) as { id: string; activo: boolean }[]) {
      activos[fila.id] = fila.activo
    }

    const est = (estadisticas.data?.[0] ?? {}) as EstadisticasRpc
    const conf = (configuracion.data ?? {}) as {
      titulo?: string
      centro?: string
      eleccion_abierta?: boolean
    }

    const nuevo: Datos = {
      resultados: filas.sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre)),
      activos,
      totalVotos: filas.reduce((suma, fila) => suma + fila.votos, 0),
      totalVotantes: numero(est.total_votantes),
      totalVotaron: numero(est.total_votaron),
      totalPendientes: numero(est.total_pendientes),
      participacion: numero(est.participacion_pct),
      porMesa: Array.isArray(est.por_mesa) ? est.por_mesa : [],
      titulo: typeof conf.titulo === 'string' ? conf.titulo : '',
      centro: typeof conf.centro === 'string' ? conf.centro : '',
      eleccionAbierta: conf.eleccion_abierta === true,
      actualizadoEn: Date.now()
    }

    setDatos(nuevo)
    guardarCache(CLAVES_CACHE.resultados, nuevo)
    setCargando(false)
    setActualizando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Realtime: cada nuevo voto insertado refresca el panel. Si la publicación
  // de Realtime no está activa, el sondeo periódico mantiene los datos vivos.
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null

    const canal = supabase
      .channel('resultados-vivos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votos' }, () => {
        if (espera) clearTimeout(espera)
        espera = setTimeout(() => {
          void cargar(true)
        }, ESPERA_REALTIME_MS)
      })
      .subscribe((estado) => {
        setEnVivo(estado === 'SUBSCRIBED')
      })

    return () => {
      if (espera) clearTimeout(espera)
      void supabase.removeChannel(canal)
    }
  }, [cargar])

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void cargar(true)
    }, INTERVALO_SONDEO_MS)

    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar(true)
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar])

  const resultados = datos?.resultados ?? []
  const totalVotos = datos?.totalVotos ?? 0
  const hayCandidatos = resultados.length > 0
  const hayVotos = totalVotos > 0
  const ordenados = resultados
  const lider = hayVotos && ordenados[0] ? ordenados[0] : null
  const empate = hayVotos && ordenados.length > 1 && ordenados[0].votos === ordenados[1].votos
  const podio = ordenados.slice(0, 3)
  const ordenPodio = podio.length === 3 ? [1, 0, 2] : podio.map((_, indice) => indice)
  const ultimaActualizacion = datos
    ? new Date(datos.actualizadoEn).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : null

  const mesas = (datos?.porMesa ?? [])
    .slice()
    .sort((a, b) => numero(b.total) - numero(a.total) || a.mesa_nombre.localeCompare(b.mesa_nombre))

  return (
    <RevealSection className="space-y-6">
      <SectionHeader
        title="Resultados en vivo"
        description="Conteo actualizado de votos por candidato y participación por mesa."
        actions={
          <>
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={() => void cargar()}
              disabled={actualizando}
            >
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={1.8} />
                {actualizando ? 'Actualizando…' : 'Actualizar'}
              </span>
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              disabled={!hayCandidatos || cargando}
            >
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={PrinterIcon} size={14} strokeWidth={1.8} />
                Acta PDF
              </span>
            </AdminButton>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {enVivo && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${enVivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </span>
            {enVivo ? 'En vivo' : 'Actualización automática'}
          </span>
          <span className="text-xs text-slate-500">
            {enVivo ? 'Conectado a Supabase Realtime' : `Sondeo cada ${INTERVALO_SONDEO_MS / 1000} s`}
          </span>
          {ultimaActualizacion && (
            <span className="text-xs text-slate-500">Última actualización: {ultimaActualizacion}</span>
          )}
        </div>

        {datos && (
          <Badge variant={datos.eleccionAbierta ? 'success' : 'default'}>
            Elección {datos.eleccionAbierta ? 'abierta' : 'cerrada'}
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void cargar()}
            className="self-start rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15 sm:self-auto"
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando && !datos ? (
        <ResultadosSkeleton />
      ) : !hayCandidatos ? (
        <AdminCard>
          <EmptyState
            icon={<HugeiconsIcon icon={UserIcon} size={22} strokeWidth={1.7} />}
            title="Aún no hay candidatos registrados"
            description="Agrega candidatos para que los votos empiecen a contarse aquí en tiempo real."
            action={
              <AdminButton size="sm" onClick={() => onNavigate('candidatos')}>
                Ir a Candidatos
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Votos emitidos"
              value={totalVotos}
              subtitle={hayVotos ? 'Conteo en tiempo real' : 'Aún no se registran votos'}
              valueClassName="text-sky-200"
            />
            <StatCard
              label="Participación"
              value={`${formatearPorcentaje(datos?.participacion ?? 0)}%`}
              subtitle={`${datos?.totalVotaron ?? 0} de ${datos?.totalVotantes ?? 0} votantes`}
            />
            <StatCard
              label="Votaron"
              value={datos?.totalVotaron ?? 0}
              subtitle="Electores que ya emitieron su voto"
              valueClassName="text-emerald-300"
            />
            <StatCard
              label="Pendientes"
              value={datos?.totalPendientes ?? 0}
              subtitle="Electores que aún no votan"
              valueClassName="text-amber-200"
            />
          </div>

          {!hayVotos && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100/85">
              <HugeiconsIcon icon={ChartBarBigIcon} size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <p>
                Todavía no hay votos registrados. Cuando los kioscos empiecen a votar verás el conteo
                actualizarse automáticamente.
                {datos && !datos.eleccionAbierta && ' La elección está cerrada: ábrela desde Configuración.'}
              </p>
            </div>
          )}

          {hayVotos && (
            <div className="grid gap-4 sm:grid-cols-3">
              {ordenPodio.map((indice) => {
                const candidato = podio[indice]
                if (!candidato) return null
                const esPrimero = indice === 0 && !empate
                return (
                  <div
                    key={candidato.id}
                    className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl ${
                      esPrimero
                        ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/[0.12] via-white/[0.04] to-transparent'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-slate-900 ${MEDALLAS[indice] ?? MEDALLAS[2]}`}
                      >
                        {indice + 1}
                      </span>
                      {indice === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                          <HugeiconsIcon icon={TrophyIcon} size={12} strokeWidth={2} />
                          {empate ? 'Empate' : 'Primer lugar'}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Avatar
                        nombre={candidato.nombre}
                        fotoUrl={candidato.foto_url}
                        className="h-12 w-12"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{candidato.nombre}</p>
                        <p className="text-xs text-slate-400">
                          {formatearPorcentaje(porcentaje(candidato.votos, totalVotos))}% del total
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-3xl font-bold tabular-nums text-white">
                      {candidato.votos}
                      <span className="ml-1 text-xs font-medium text-slate-500">
                        {candidato.votos === 1 ? 'voto' : 'votos'}
                      </span>
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <AdminCard>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">Conteo por candidato</h3>
              <span className="text-xs text-slate-500">
                {resultados.length} {resultados.length === 1 ? 'candidato' : 'candidatos'} ·{' '}
                {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5">
              {ordenados.map((candidato, indice) => {
                const pct = porcentaje(candidato.votos, totalVotos)
                const esLider = !empate && lider?.id === candidato.id
                const activo = datos?.activos[candidato.id] !== false
                return (
                  <li
                    key={candidato.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      esLider
                        ? 'border-blue-400/40 bg-blue-500/[0.08]'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-xs tabular-nums text-slate-500">
                        {indice + 1}
                      </span>
                      <Avatar nombre={candidato.nombre} fotoUrl={candidato.foto_url} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{candidato.nombre}</p>
                          {esLider && <Badge variant="info">Líder</Badge>}
                          {!activo && <Badge>Inactivo</Badge>}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full transition-[width] duration-500 ${
                              esLider
                                ? 'bg-gradient-to-r from-blue-400 to-sky-300'
                                : 'bg-gradient-to-r from-slate-500 to-slate-400'
                            }`}
                            style={{ width: `${Math.max(pct, hayVotos ? 0.6 : 0)}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 shrink-0 text-right">
                        <p className="text-lg font-bold tabular-nums text-white">{candidato.votos}</p>
                        <p className="text-[10px] text-slate-500">{formatearPorcentaje(pct)}%</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {empate && (
              <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5 text-xs text-amber-100/85">
                Hay un empate en el primer lugar. El acta debe reflejar el conteo sin declarar un
                ganador único hasta resolverse el desempate.
              </p>
            )}
          </AdminCard>

          <AdminCard>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">Participación por mesa</h3>
              <span className="text-xs text-slate-500">{mesas.length} mesas</span>
            </div>

            {mesas.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={<HugeiconsIcon icon={ChartBarBigIcon} size={20} strokeWidth={1.7} />}
                title="Sin mesas registradas"
                description="Crea mesas y asigna sus enlaces de kiosco para ver la participación por salón."
                action={
                  <AdminButton size="sm" variant="secondary" onClick={() => onNavigate('mesas')}>
                    Ir a Mesas
                  </AdminButton>
                }
              />
            ) : (
              <>
                <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_90px_110px] gap-3 px-3 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:grid">
                  <span>Mesa</span>
                  <span className="text-right">Votos</span>
                  <span className="text-right">% del total</span>
                </div>
                <ul className="mt-2 divide-y divide-white/10">
                  {mesas.map((mesa) => {
                    const votos = numero(mesa.total)
                    const compartido = porcentaje(votos, totalVotos)
                    return (
                      <li
                        key={mesa.mesa_id}
                        className="grid grid-cols-1 gap-1.5 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_90px_110px] sm:items-center sm:gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{mesa.mesa_nombre}</p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06] sm:hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-sky-300"
                              style={{ width: `${Math.max(compartido, votos > 0 ? 0.6 : 0)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:block sm:text-right">
                          <span className="text-xs text-slate-500 sm:hidden">Votos</span>
                          <span className="text-sm font-semibold tabular-nums text-white">{votos}</span>
                        </div>
                        <div className="flex items-center justify-between sm:block sm:text-right">
                          <span className="text-xs text-slate-500 sm:hidden">% del total</span>
                          <span className="text-sm tabular-nums text-slate-300">
                            {formatearPorcentaje(compartido)}%
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </AdminCard>
        </>
      )}

      {/* Documento imprimible: el CSS @media print oculta el resto de la app. */}
      {datos && hayCandidatos && (
        <ActaImprimible
          titulo={datos.titulo}
          centro={datos.centro}
          actualizadoEn={datos.actualizadoEn}
          eleccionAbierta={datos.eleccionAbierta}
          resultados={ordenados}
          totalVotos={totalVotos}
          totalVotantes={datos.totalVotantes}
          totalVotaron={datos.totalVotaron}
          totalPendientes={datos.totalPendientes}
          participacion={datos.participacion}
          mesas={mesas}
          hayEmpate={empate}
        />
      )}
    </RevealSection>
  )
}
