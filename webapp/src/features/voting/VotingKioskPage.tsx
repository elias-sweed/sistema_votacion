import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  castVote,
  isValidDni,
  loadActiveCandidates,
  loadElectionStatus,
  verifyVoter,
  VotingError,
} from './votingService'
import type { ElectionStatus } from './votingService'

type Candidate = Awaited<ReturnType<typeof loadActiveCandidates>>[number]
type Step = 'dni' | 'identity' | 'candidates' | 'confirm' | 'success' | 'notice' | 'ambiguous'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
}

export default function VotingKioskPage() {
  const dniRef = useRef('')
  const submittingRef = useRef(false)
  const [status, setStatus] = useState<ElectionStatus | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [step, setStep] = useState<Step>('dni')
  const [dniInput, setDniInput] = useState('')
  const [voterName, setVoterName] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [identityConfirmed, setIdentityConfirmed] = useState(false)

  async function loadOptions() {
    setLoading(true)
    setLoadError(null)
    try {
      const [electionStatus, activeCandidates] = await Promise.all([
        loadElectionStatus(),
        loadActiveCandidates(),
      ])
      setStatus(electionStatus)
      setCandidates(activeCandidates)
    } catch {
      setLoadError('No se pudo cargar la información electoral. Revisa la conexión y vuelve a intentarlo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOptions()
  }, [])

  function clearVoterState() {
    dniRef.current = ''
    setDniInput('')
    setVoterName(null)
    setIdentityConfirmed(false)
    setSelectedCandidateId(null)
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)
    setMessage(null)

    const dni = dniInput.trim()
    if (!dni) {
      setValidationError('Ingresa tu DNI para continuar.')
      return
    }
    if (!isValidDni(dni)) {
      setValidationError('El DNI debe tener exactamente ocho dígitos.')
      return
    }
    if (loading || !status?.open || candidates.length === 0 || checking) return

    setChecking(true)
    try {
      const voter = await verifyVoter(dni)
      dniRef.current = dni
      setVoterName(voter.name)
      setStep('identity')
    } catch (error) {
      const votingError = error instanceof VotingError ? error : null
      setMessage(votingError?.message ?? 'No se pudo completar la verificación.')
    } finally {
      setChecking(false)
    }
  }

  function continueToCandidates() {
    if (!voterName || !dniRef.current) return
    setIdentityConfirmed(true)
    setVoterName(null)
    setStep('candidates')
  }

  function confirmCandidate() {
    if (!selectedCandidateId || !identityConfirmed || !dniRef.current) return
    setStep('confirm')
  }

  async function submitVote() {
    if (submittingRef.current || submitting || step !== 'confirm') return
    const candidateId = selectedCandidateId
    const dni = dniRef.current
    if (!candidateId || !dni) return

    submittingRef.current = true
    setSubmitting(true)
    setMessage(null)
    try {
      await castVote(dni, candidateId)
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
      if (votingError.kind === 'invalid-candidate') {
        setStep('notice')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function resetFlow() {
    clearVoterState()
    setMessage(null)
    setValidationError(null)
    setIdentityConfirmed(false)
    setStep('dni')
    void loadOptions()
  }

  const selectedCandidate = candidates.find(candidate => candidate.id === selectedCandidateId) ?? null
  const canStart = !loading && !loadError && status?.open && candidates.length > 0

  return (
    <main className="relative min-h-screen px-4 py-8 text-white sm:px-8 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(37,99,235,0.2),transparent_50%)]" />
      <div className="relative mx-auto w-full max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Kiosco electoral</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {status?.title || 'Votación escolar'}
          </h1>
          <p className="mt-3 text-sm text-slate-300">Sigue las indicaciones en pantalla. Tu voto es secreto.</p>
        </header>

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

          {canStart && step === 'dni' && (
            <form onSubmit={handleVerify} className="mx-auto max-w-md space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Verifica tu habilitación</h2>
                <p className="mt-2 text-sm text-slate-300">Ingresa tu DNI. Solo se utilizará para comprobar tu habilitación y registrar que ya votaste.</p>
              </div>
              <div>
                <label htmlFor="voter-dni" className="mb-2 block text-sm font-medium text-slate-200">DNI</label>
                <input
                  id="voter-dni"
                  name="dni"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={dniInput}
                  onChange={event => setDniInput(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  aria-describedby={validationError ? 'dni-error' : undefined}
                  aria-invalid={Boolean(validationError)}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-4 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
                  placeholder="••••••••"
                  autoFocus
                />
                {validationError && <p id="dni-error" className="mt-2 text-sm text-rose-300">{validationError}</p>}
              </div>
              {message && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{message}</p>}
              <button type="submit" disabled={checking} className="kiosk-button-primary w-full">
                {checking ? 'Verificando…' : 'Verificar identidad'}
              </button>
              <p className="text-center text-xs text-slate-400">No se muestra tu mesa ni el estado individual de tu voto en las opciones electorales.</p>
            </form>
          )}

          {step === 'identity' && voterName && (
            <div className="mx-auto max-w-md space-y-6 py-4 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300" aria-hidden="true">✓</span>
              <div>
                <h2 className="text-2xl font-semibold">Confirma tu identidad</h2>
                <p className="mt-3 text-lg text-slate-200">{voterName}</p>
                <p className="mt-2 text-sm text-slate-400">Si estos datos son tuyos, continúa. No mostraremos tus datos junto con tu selección.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={resetFlow} className="kiosk-button-secondary">No soy yo</button>
                <button type="button" onClick={continueToCandidates} className="kiosk-button-primary">Continuar</button>
              </div>
            </div>
          )}

          {step === 'candidates' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Elige una opción</h2>
                <p className="mt-2 text-sm text-slate-300">Selecciona una sola opción. Aún no se ha registrado ningún voto.</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {candidates.map(candidate => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      aria-pressed={selectedCandidateId === candidate.id}
                      className={`flex min-h-28 w-full items-center gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                        selectedCandidateId === candidate.id
                          ? 'border-sky-300 bg-sky-400/15 ring-2 ring-sky-400/30'
                          : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]'
                      }`}
                    >
                      {candidate.foto_url ? (
                        <img
                          src={candidate.foto_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-xl font-bold text-sky-100">
                          {initials(candidate.nombre)}
                        </span>
                      )}
                      <span className="text-lg font-semibold">{candidate.nombre}</span>
                      {selectedCandidateId === candidate.id && <span className="ml-auto text-sm text-sky-200">Seleccionado</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {message && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100">{message}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={resetFlow} className="kiosk-button-secondary">Cancelar</button>
                <button type="button" onClick={confirmCandidate} disabled={!selectedCandidateId} className="kiosk-button-primary">
                  Revisar selección
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && selectedCandidate && (
            <div className="mx-auto max-w-md space-y-6 py-4 text-center">
              <h2 className="text-2xl font-semibold">Confirma tu opción</h2>
              <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 p-6">
                {selectedCandidate.foto_url && (
                  <img
                    src={selectedCandidate.foto_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="mx-auto mb-4 h-20 w-20 rounded-xl object-cover"
                  />
                )}
                <p className="text-xl font-bold">{selectedCandidate.nombre}</p>
              </div>
              <p className="text-sm text-slate-300">Al confirmar, el servidor registrará un único voto. No se mostrará tu identidad junto con esta opción.</p>
              {message && <p className="text-sm text-rose-200">{message}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" disabled={submitting} onClick={() => setStep('candidates')} className="kiosk-button-secondary">
                  Cambiar opción
                </button>
                <button type="button" disabled={submitting} onClick={() => void submitVote()} className="kiosk-button-primary">
                  {submitting ? 'Enviando voto…' : 'Confirmar y emitir voto'}
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

        <footer className="mt-5 text-center text-xs text-slate-500">
          Si necesitas ayuda, no compartas tu DNI en voz alta y consulta al personal electoral.
        </footer>
      </div>
    </main>
  )
}
