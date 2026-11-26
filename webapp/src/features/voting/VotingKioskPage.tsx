import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import LaserFlow from '../../components/ui/LaserFlow'
import {
  castVote,
  isValidDni,
  loadActiveCandidates,
  loadElectionStatus,
  verifyVoter,
  VotingError,
} from './votingService'
import type { ElectionStatus } from './votingService'
import { useOnlineStatus } from '../../lib/useOnlineStatus'

type Candidate = Awaited<ReturnType<typeof loadActiveCandidates>>[number]
type Step = 'dni' | 'candidates' | 'confirm' | 'success' | 'notice' | 'ambiguous'

type DniResult = {
  tone: 'error' | 'warning' | 'success'
  title: string
  detail: string
}

const toneStyles: Record<DniResult['tone'], { panel: string; title: string; detail: string; icon: string }> = {
  error: {
    panel: 'border-rose-400/30 bg-rose-500/10',
    title: 'text-rose-200',
    detail: 'text-rose-100/80',
    icon: '✕',
  },
  warning: {
    panel: 'border-amber-400/30 bg-amber-500/10',
    title: 'text-amber-200',
    detail: 'text-amber-100/80',
    icon: '!',
  },
  success: {
    panel: 'border-emerald-400/30 bg-emerald-500/10',
    title: 'text-emerald-200',
    detail: 'text-emerald-100/80',
    icon: '✓',
  },
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
}

/** Imagen de respaldo para candidatos sin foto: nunca se ve un <img> roto. */
function fotoOColor(candidate: Candidate): string {
  if (candidate.foto_url) return candidate.foto_url
  const siglas = initials(candidate.nombre)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c4a6e"/><stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient></defs>
    <rect width="640" height="800" fill="url(#g)"/>
    <circle cx="320" cy="330" r="150" fill="#7dd3fc" opacity="0.18"/>
    <text x="320" y="390" fill="#e0f2fe" font-family="monospace" font-size="150" font-weight="bold" text-anchor="middle">${siglas}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function dniResultFromError(error: unknown): DniResult {
  const votingError = error instanceof VotingError ? error : null
  switch (votingError?.kind) {
    case 'already-voted':
      return {
        tone: 'warning',
        title: 'Ya votó',
        detail: 'Este DNI ya tiene un voto registrado. Gracias por participar.',
      }
    case 'not-found':
      return {
        tone: 'error',
        title: 'No existe',
        detail: 'Ese DNI no está en el padrón. Revisa los 8 números o pide ayuda al personal.',
      }
    case 'rate-limited':
      return {
        tone: 'warning',
        title: 'Espera un momento',
        detail: 'Se hicieron muchos intentos. Espera unos segundos o pide ayuda al personal.',
      }
    case 'invalid-mesa':
      return {
        tone: 'error',
        title: 'Enlace no válido',
        detail: 'Este enlace de mesa no sirve. Avisa al personal electoral.',
      }
    case 'unavailable':
    case 'network':
      return {
        tone: 'error',
        title: 'Sin conexión',
        detail: 'No se pudo conectar con el sistema. Inténtalo otra vez.',
      }
    default:
      return {
        tone: 'error',
        title: 'No se pudo verificar',
        detail: votingError?.message ?? 'Inténtalo otra vez o pide ayuda al personal.',
      }
  }
}

export default function VotingKioskPage() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const token = tokenParam?.trim() ?? ''
  const dniRef = useRef('')
  const submittingRef = useRef(false)
  const checkingRef = useRef(false)
  const lastCheckedDni = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const marcaWashRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const marcandoTimerRef = useRef<number | null>(null)
  const [status, setStatus] = useState<ElectionStatus | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [step, setStep] = useState<Step>('dni')
  const [dniInput, setDniInput] = useState('')
  const [dniResult, setDniResult] = useState<DniResult | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [marcando, setMarcando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const enLinea = useOnlineStatus()

  const eleccionLista = !loading && !loadError && status?.open && candidates.length > 0
  const canStart = enLinea && eleccionLista

  async function loadOptions() {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [electionStatus, activeCandidates] = await Promise.all([
        loadElectionStatus(token),
        loadActiveCandidates(token),
      ])
      setStatus(electionStatus)
      setCandidates(activeCandidates)
    } catch (error) {
      const kind = error instanceof VotingError ? error.kind : 'unknown'
      setLoadError(
        kind === 'invalid-mesa'
          ? 'Este enlace no es válido o la mesa está inactiva. Pide al administrador que genere uno nuevo.'
          : kind === 'unavailable'
            ? 'El servicio de votación no está disponible: la función voting-proxy aún no está desplegada en Supabase. Avisa al administrador.'
            : 'No se pudo cargar la información electoral. Revisa la conexión y vuelve a intentarlo.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    void loadOptions()
  }, [token])

  useEffect(() => {
    if (step === 'dni' && !loading) inputRef.current?.focus()
  }, [step, loading])

  function clearVoterState() {
    if (marcandoTimerRef.current !== null) {
      window.clearTimeout(marcandoTimerRef.current)
      marcandoTimerRef.current = null
    }
    dniRef.current = ''
    lastCheckedDni.current = null
    requestIdRef.current += 1
    checkingRef.current = false
    setDniInput('')
    setDniResult(null)
    setSelectedCandidateId(null)
    setMarcando(false)
    setChecking(false)
  }

  function handleDniChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    setDniInput(digits)
    setDniResult(null)
    if (digits !== lastCheckedDni.current) lastCheckedDni.current = null
    requestIdRef.current += 1
    if (checkingRef.current) {
      checkingRef.current = false
      setChecking(false)
    }
  }

  async function verifyDni(dni: string) {
    if (checkingRef.current || !isValidDni(dni) || !canStart) return
    const requestId = ++requestIdRef.current
    checkingRef.current = true
    lastCheckedDni.current = dni
    setChecking(true)
    setDniResult(null)
    try {
      await verifyVoter(token, dni)
      if (requestId !== requestIdRef.current) return
      dniRef.current = dni
      setSelectedCandidateId(null)
      setStep('candidates')
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setDniResult(dniResultFromError(error))
      requestAnimationFrame(() => inputRef.current?.select())
    } finally {
      if (requestId === requestIdRef.current) {
        checkingRef.current = false
        setChecking(false)
      }
    }
  }

  useEffect(() => {
    if (step !== 'dni' || !canStart || checking) return
    if (dniInput.length !== 8 || lastCheckedDni.current === dniInput) return
    void verifyDni(dniInput)
  }, [dniInput, step, canStart, checking])

  function chooseCandidate(candidateId: string) {
    if (marcando || submitting) return
    setSelectedCandidateId(candidateId)
    setMarcando(true)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (marcandoTimerRef.current !== null) window.clearTimeout(marcandoTimerRef.current)
    marcandoTimerRef.current = window.setTimeout(() => {
      marcandoTimerRef.current = null
      setMarcando(false)
      setStep('confirm')
    }, reduce ? 0 : 2400)
  }

  // Resalta la tarjeta elegida con GSAP (sólo transform/opacity) mientras cae el láser.
  useEffect(() => {
    if (!marcando || !selectedCandidateId) return
    const wash = marcaWashRef.current
    const card = cardRefs.current[selectedCandidateId]
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduce || !wash || !card) return

    const tl = gsap.timeline()
    tl.fromTo(wash, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' })
      .fromTo(card, { scale: 1 }, { scale: 1.035, duration: 0.3, ease: 'power2.out' }, 0)
      .to(card, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.65)' }, 0.3)
      .to(wash, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0.95)

    return () => {
      tl.kill()
      gsap.set([wash, card], { clearProps: 'opacity,transform' })
    }
  }, [marcando, selectedCandidateId])

  useEffect(() => () => {
    if (marcandoTimerRef.current !== null) window.clearTimeout(marcandoTimerRef.current)
  }, [])

  async function submitVote() {
    if (submittingRef.current || submitting || step !== 'confirm') return
    const candidateId = selectedCandidateId
    const dni = dniRef.current
    if (!candidateId || !dni) return
    if (!enLinea) {
      setMessage('Sin conexión. Tu selección sigue en pantalla: espera a que vuelva internet y confirma de nuevo.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setMessage(null)
    try {
      await castVote(token, dni, candidateId)
      clearVoterState()
      setStep('success')
    } catch (error) {
      const votingError = error instanceof VotingError
        ? error
        : new VotingError('No se pudo confirmar el resultado. Solicita asistencia al personal electoral.', 'unknown')
      clearVoterState()
      setMessage(votingError.message)
      setStep(votingError.kind === 'unknown' || votingError.kind === 'network' ? 'ambiguous' : 'notice')
      if (votingError.kind === 'closed') setStatus(current => current ? { ...current, open: false } : current)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function resetFlow() {
    clearVoterState()
    setMessage(null)
    setStep('dni')
    void loadOptions()
  }

  const selectedCandidate = candidates.find(candidate => candidate.id === selectedCandidateId) ?? null
  // El láser se ancla a la tarjeta elegida (como el ejemplo Hero de React Bits).
  const superficieSeleccionada = {
    current: selectedCandidateId ? cardRefs.current[selectedCandidateId] ?? null : null
  }
  // El haz cae sobre el centro de esa tarjeta, esté en la columna que esté.
  const beamDeLaTarjeta = (() => {
    const card = superficieSeleccionada.current
    const grid = gridRef.current
    if (!card || !grid) return 0.6
    const cardBox = card.getBoundingClientRect()
    const gridBox = grid.getBoundingClientRect()
    return gridBox.width > 0 ? (cardBox.left + cardBox.width / 2 - gridBox.left) / gridBox.width : 0.6
  })()

  if (!token) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,99,235,0.18),transparent_55%)]" />
        <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-center shadow-2xl backdrop-blur-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-2xl text-amber-200" aria-hidden="true">!</span>
          <h1 className="mt-5 font-display text-2xl font-bold">Abre el enlace de tu mesa</h1>
          <p className="mt-3 text-sm text-slate-300">
            Este equipo necesita el enlace de acceso asignado a su salón. Pídelo al administrador
            y ábrelo en este navegador.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Cada enlace identifica la mesa donde se registran los votos. No compartas el enlace de otra mesa.
          </p>
        </section>
      </main>
    )
  }

  // Pantalla de candidatos a pantalla completa: sin títulos ni panel central.
  if (eleccionLista && step === 'candidates') {
    return (
      <main className="relative h-dvh w-full overflow-hidden text-white">
        <button
          type="button"
          onClick={resetFlow}
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-30 focus:rounded-xl focus:bg-slate-950/90 focus:px-4 focus:py-2 focus:text-sm"
        >
          Volver
        </button>
        <p className="sr-only" aria-live="polite">
          {marcando ? 'Opción marcada. Preparando la confirmación…' : 'Toca la tarjeta de tu candidato.'}
        </p>
        <div ref={gridRef} className="relative grid h-full w-full auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <div
            ref={marcaWashRef}
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2 z-10 bg-sky-400/15 opacity-0"
          />
          {candidates.map(candidate => {
            const selected = candidate.id === selectedCandidateId
            return (
              <li
                key={candidate.id}
                ref={(el) => {
                  cardRefs.current[candidate.id] = el
                }}
                className="min-h-0"
              >
                <button
                  type="button"
                  onClick={() => chooseCandidate(candidate.id)}
                  aria-pressed={selected}
                  className={`group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border text-left ${
                    selected
                      ? 'border-sky-300/80 bg-sky-400/10'
                      : 'border-white/10 bg-white/5 hover:border-sky-300/60'
                  }`}
                >
                  <img
                    src={fotoOColor(candidate)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/45 to-transparent"
                  />
                  <span className="relative mt-auto block p-6 sm:p-10">
                    <span className="block text-3xl font-bold text-white drop-shadow-lg sm:text-5xl">
                      {candidate.nombre}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {marcando && selectedCandidateId && (
            <LaserFlow
              surfaceRef={superficieSeleccionada}
              className="absolute! inset-0 z-20"
              beamPosition={beamDeLaTarjeta}
              color="#3847ff"
              intensity={1.8}
              beamWidth={1.5}
              flare={1.5}
              spread={1.5}
              spill={1}
              fog={0.2}
              dust={1.6}
              streaks={1.5}
              dots={1}
              pulse={1.5}
              speed={1.5}
              seed={3}
              mouseInteraction
              intro
            />
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="relative mx-auto w-full max-w-3xl">
        <header className="mb-8 text-center">
          {status?.logoUrl && (
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/95 p-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] sm:h-28 sm:w-28">
              <img
                src={status.logoUrl}
                alt={`Logo de ${status.centro || 'la institución educativa'}`}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Kiosco electoral</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {status?.title || 'Votación escolar'}
          </h1>
          {status?.centro && <p className="mt-2 text-sm text-slate-400">{status.centro}</p>}
          {status?.mesa && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sm font-semibold text-sky-100">
              Mesa {status.mesa.nombre}
            </p>
          )}
          <p className="mt-3 text-sm text-white/90">Sigue las indicaciones en pantalla. Tu voto es secreto.</p>
        </header>

        {!enLinea && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-left text-sm text-amber-100"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/25 font-bold"
            >
              !
            </span>
            <div>
              <p className="font-semibold">Sin conexión a internet</p>
              <p className="mt-0.5 text-amber-100/85">
                No se puede verificar el DNI ni registrar votos. Avisa al personal electoral y espera a
                que vuelva la conexión.
              </p>
            </div>
          </div>
        )}

        <section
          className="rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl backdrop-blur-xl sm:p-8"
          aria-live="polite"
          aria-busy={loading || checking || submitting}
        >
          {loading && (
            <div className="py-12 text-center" role="status">
              <p className="text-slate-300">Consultando el estado de la elección…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="space-y-5 py-8 text-center">
              <p className="text-lg font-semibold text-amber-200">{loadError}</p>
              <button type="button" onClick={() => void loadOptions()} className="kiosk-button-secondary">
                Volver a consultar
              </button>
            </div>
          )}

          {!loading && !loadError && status && !status.open && (
            <div className="py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-2xl" aria-hidden="true">—</span>
              <h2 className="mt-5 text-2xl font-semibold">La votación está cerrada</h2>
              <p className="mt-2 text-slate-300">No se aceptan votos en este momento. Consulta al personal electoral.</p>
            </div>
          )}

          {!loading && !loadError && status?.open && candidates.length === 0 && (
            <div className="py-12 text-center">
              <h2 className="text-2xl font-semibold">No hay opciones habilitadas</h2>
              <p className="mt-2 text-slate-300">La votación no puede continuar. Consulta al personal electoral.</p>
            </div>
          )}

          {eleccionLista && step === 'dni' && (
            <div className="mx-auto max-w-md space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold">Escribe tu DNI</h2>
                <p className="mt-2 text-sm text-white/90">
                  Solo los 8 números. Apenas termines, revisamos tu DNI automáticamente.
                </p>
              </div>

              <div>
                <label htmlFor="voter-dni" className="mb-2 block text-center text-sm font-medium text-slate-200">
                  DNI
                </label>
                <input
                  ref={inputRef}
                  id="voter-dni"
                  name="dni"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={dniInput}
                  onChange={event => handleDniChange(event.target.value)}
                  aria-describedby="dni-progress"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-5 text-center font-mono text-3xl tracking-[0.35em] text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
                  placeholder="••••••••"
                  autoFocus
                />

                <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 w-7 rounded-full transition-colors ${
                        index < dniInput.length ? 'bg-sky-400' : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>

                <p id="dni-progress" className="mt-3 text-center text-sm text-slate-200" aria-live="polite">
                  {checking
                    ? 'Revisando tu DNI…'
                    : dniInput.length === 8
                      ? 'DNI completo'
                      : `Faltan ${8 - dniInput.length} ${8 - dniInput.length === 1 ? 'número' : 'números'}`}
                </p>
              </div>

              {dniResult && (
                <div
                  role="alert"
                  className={`rounded-2xl border p-5 ${toneStyles[dniResult.tone].panel}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30 text-lg font-bold ${toneStyles[dniResult.tone].title}`}
                    >
                      {toneStyles[dniResult.tone].icon}
                    </span>
                    <div>
                      <p className={`text-lg font-bold ${toneStyles[dniResult.tone].title}`}>{dniResult.title}</p>
                      <p className={`mt-1 text-sm ${toneStyles[dniResult.tone].detail}`}>{dniResult.detail}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'confirm' && selectedCandidate && (
            <div className="mx-auto max-w-md space-y-6 py-2 text-center">
              <h2 className="text-2xl font-semibold">¿Estás seguro?</h2>
              <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 p-6">
                {selectedCandidate.foto_url && (
                  <img
                    src={selectedCandidate.foto_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="mx-auto mb-4 h-20 w-20 rounded-xl object-cover"
                  />
                )}
                <p className="text-sm text-slate-300">Vas a votar por</p>
                <p className="mt-1 text-xl font-bold">{selectedCandidate.nombre}</p>
              </div>
              <p className="text-sm text-slate-300">Tu voto se guarda una sola vez y no se puede cambiar.</p>
              {message && <p className="text-sm text-rose-200">{message}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" disabled={submitting} onClick={() => { setMessage(null); setSelectedCandidateId(null); setStep('candidates') }} className="kiosk-button-secondary">
                  No, elegir otro
                </button>
                <button type="button" disabled={submitting || !enLinea} onClick={() => void submitVote()} className="kiosk-button-primary">
                  {submitting ? 'Guardando voto…' : 'Sí, confirmar mi voto'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300" aria-hidden="true">✓</span>
              <h2 className="mt-5 text-2xl font-bold text-emerald-200">Tu voto fue registrado</h2>
              <p className="mt-2 text-slate-300">Gracias por participar. Tu selección se ha retirado de esta pantalla.</p>
              <button type="button" onClick={resetFlow} className="kiosk-button-primary mt-6">
                Comenzar siguiente votante
              </button>
            </div>
          )}

          {step === 'notice' && (
            <div className="mx-auto max-w-md space-y-5 py-10 text-center">
              <h2 className="text-2xl font-semibold">No se pudo completar la votación</h2>
              <p className="text-slate-200">{message}</p>
              <button type="button" onClick={resetFlow} className="kiosk-button-secondary">Volver al inicio</button>
            </div>
          )}

          {step === 'ambiguous' && (
            <div className="mx-auto max-w-md space-y-5 py-10 text-center">
              <h2 className="text-2xl font-semibold text-amber-100">No hay confirmación del servidor</h2>
              <p className="text-slate-200">{message}</p>
              <p className="text-sm text-slate-400">Por seguridad, esta pantalla no volverá a enviar el voto. Pide al personal electoral que verifique el estado antes de continuar.</p>
              <button type="button" onClick={resetFlow} className="kiosk-button-secondary">
                Volver al inicio (personal electoral)
              </button>
            </div>
          )}
        </section>

        <footer className="mt-5 text-center text-xs text-slate-300">
          Si necesitas ayuda, no compartas tu DNI en voz alta y consulta al personal electoral.
        </footer>
      </div>
    </main>
  )
}
