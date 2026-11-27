export type FiltroDatosPadron = 'todos' | 'incompletos' | 'dni' | 'nombre' | 'apellidos'

type DatosPadron = {
  dni: string
  nombre: string
}

export type RevisionPadron = {
  dniIncompleto: boolean
  nombreIncompleto: boolean
  faltaApellido: boolean
  incompleto: boolean
  motivos: string[]
}

/**
 * El padrón guarda el nombre completo en un solo campo. Se considera completo
 * cuando tiene al menos tres palabras: nombre(s) + apellido paterno + materno.
 * Es una revisión orientativa para detectar altas incompletas, no un juicio
 * definitivo sobre nombres compuestos.
 */
export function evaluarDatosPadron(votante: DatosPadron): RevisionPadron {
  const digitos = String(votante.dni ?? '').replace(/\D/g, '')
  const palabras = String(votante.nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const dniIncompleto = digitos.length !== 8
  const nombreIncompleto = palabras.length < 2
  const faltaApellido = palabras.length < 3
  const motivos: string[] = []

  if (dniIncompleto) motivos.push('DNI incompleto')
  if (nombreIncompleto) motivos.push('Nombre incompleto')
  else if (faltaApellido) motivos.push('Falta un apellido')

  return {
    dniIncompleto,
    nombreIncompleto,
    faltaApellido,
    incompleto: motivos.length > 0,
    motivos
  }
}

export function cumpleFiltroDatos(votante: DatosPadron, filtro: FiltroDatosPadron): boolean {
  if (filtro === 'todos') return true

  const revision = evaluarDatosPadron(votante)
  if (filtro === 'incompletos') return revision.incompleto
  if (filtro === 'dni') return revision.dniIncompleto
  if (filtro === 'nombre') return revision.nombreIncompleto
  return revision.faltaApellido
}
