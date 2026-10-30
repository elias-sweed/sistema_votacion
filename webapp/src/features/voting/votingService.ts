import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type ElectionStatus = {
  open: boolean
  title: string
}

export type VoterVerification = {
  exists: boolean
  canVote: boolean
  rateLimited: boolean
  name: string | null
}

export type VotingCandidate = {
  id: string
  nombre: string
  foto_url: string | null
}

export type VotingErrorKind =
  | 'input'
  | 'network'
  | 'not-found'
  | 'already-voted'
  | 'rate-limited'
  | 'closed'
  | 'invalid-candidate'
  | 'unknown'

export class VotingError extends Error {
  readonly kind: VotingErrorKind

  constructor(
    message: string,
    kind: VotingErrorKind,
  ) {
    super(message)
    this.name = 'VotingError'
    this.kind = kind
  }
}

type StatusResponse = {
  eleccion_abierta?: unknown
  titulo?: unknown
}

type VerificationResponse = {
  existe?: unknown
  nombre?: unknown
  puede_votar?: unknown
  rate_limited?: unknown
}

type VoteResponse = {
  success?: unknown
}

type CandidatesResponse = {
  candidatos?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return null
  try {
    const body: unknown = await error.context.clone().json()
    if (isRecord(body) && typeof body.code === 'string') return body.code
  } catch {
    return null
  }
  return null
}

export function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni)
}

export async function loadElectionStatus(): Promise<ElectionStatus> {
  const { data, error } = await supabase.functions.invoke<StatusResponse>('voting-proxy', {
    body: { action: 'estado' },
  })

  if (error) throw new VotingError('No se pudo consultar el estado electoral.', 'network')
  if (!data || typeof data.eleccion_abierta !== 'boolean' || typeof data.titulo !== 'string') {
    throw new VotingError('El servidor devolvió un estado electoral inválido.', 'unknown')
  }

  return { open: data.eleccion_abierta, title: data.titulo }
}

function isVotingCandidate(value: unknown): value is VotingCandidate {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.nombre === 'string'
    && (value.foto_url === null || typeof value.foto_url === 'string')
}

export async function loadActiveCandidates(): Promise<VotingCandidate[]> {
  const { data, error } = await supabase.functions.invoke<CandidatesResponse>('voting-proxy', {
    body: { action: 'candidatos' },
  })

  if (error) throw new VotingError('No se pudieron cargar las opciones electorales.', 'network')
  if (!data || !Array.isArray(data.candidatos) || !data.candidatos.every(isVotingCandidate)) {
    throw new VotingError('El servidor devolvió opciones electorales inválidas.', 'unknown')
  }
  return data.candidatos
}

export async function verifyVoter(dni: string): Promise<VoterVerification> {
  if (!isValidDni(dni)) throw new VotingError('Ingresa un DNI de ocho dígitos.', 'input')

  const { data, error } = await supabase.functions.invoke<VerificationResponse>('voting-proxy', {
    body: { action: 'verificar', dni },
  })

  if (error) {
    const code = await functionErrorCode(error)
    if (code === 'P0007') throw new VotingError('Se alcanzó el límite de intentos. Espera antes de volver a intentarlo.', 'rate-limited')
    throw new VotingError('No se pudo confirmar la identidad por un problema de conexión. Inténtalo de nuevo.', 'network')
  }

  if (
    !data
    || typeof data.existe !== 'boolean'
    || typeof data.puede_votar !== 'boolean'
    || typeof data.rate_limited !== 'boolean'
    || (data.nombre != null && typeof data.nombre !== 'string')
  ) {
    throw new VotingError('El servidor devolvió una respuesta de verificación inválida.', 'unknown')
  }

  if (data.rate_limited) throw new VotingError('Se alcanzó el límite de intentos. Espera antes de volver a intentarlo.', 'rate-limited')
  if (!data.existe || !data.nombre) throw new VotingError('No encontramos una habilitación de voto para esos datos.', 'not-found')
  if (!data.puede_votar) throw new VotingError('El sistema indica que este votante ya emitió su voto.', 'already-voted')

  return {
    exists: data.existe,
    canVote: data.puede_votar,
    rateLimited: data.rate_limited,
    name: data.nombre,
  }
}

export async function castVote(dni: string, candidateId: string): Promise<void> {
  if (!isValidDni(dni)) throw new VotingError('La identificación de la sesión no es válida.', 'input')

  const { data, error } = await supabase.functions.invoke<VoteResponse>('voting-proxy', {
    body: { action: 'votar', dni, candidato_id: candidateId },
  })

  if (error) {
    const code = await functionErrorCode(error)
    if (code === 'P0001') throw new VotingError('La identificación de la sesión no es válida.', 'input')
    if (code === 'P0003') throw new VotingError('La elección se cerró antes de registrar el voto.', 'closed')
    if (code === 'P0004') throw new VotingError('El servidor indica que este votante ya emitió su voto.', 'already-voted')
    if (code === 'P0005') throw new VotingError('La opción seleccionada ya no está habilitada.', 'invalid-candidate')
    if (code === 'P0007') throw new VotingError('Se alcanzó el límite de intentos. Solicita ayuda al personal electoral.', 'rate-limited')
    throw new VotingError('No se recibió confirmación del servidor. No vuelvas a enviar el voto; solicita asistencia para verificar su estado.', 'unknown')
  }

  if (!data || data.success !== true) {
    throw new VotingError('No se recibió confirmación del servidor. No vuelvas a enviar el voto; solicita asistencia para verificar su estado.', 'unknown')
  }
}
