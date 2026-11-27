export type FiltroDatosPadron =
  | 'todos'
  | 'incompletos'
  | 'completos'
  | 'duplicados'
  | 'dni'
  | 'nombre'
  | 'apellidos'
  | 'grado'
  | 'seccion'

type DatosPadron = {
  dni: string
  nombre: string
  grado?: string | null
  seccion?: string | null
}

export type RevisionPadron = {
  dniIncompleto: boolean
  nombreIncompleto: boolean
  faltaApellido: boolean
  faltaGrado: boolean
  faltaSeccion: boolean
  incompleto: boolean
  completo: boolean
  motivos: string[]
}

/**
 * El padrón guarda el nombre completo en un solo campo. Se considera completo
 * cuando tiene al menos tres palabras: nombre(s) + apellido paterno + materno,
 * además de DNI de 8 dígitos, grado y sección.
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
  const faltaGrado = !String(votante.grado ?? '').trim()
  const faltaSeccion = !String(votante.seccion ?? '').trim()
  const motivos: string[] = []

  if (dniIncompleto) motivos.push(digitos.length > 8 ? 'DNI con más de 8 dígitos' : 'DNI incompleto')
  if (nombreIncompleto) motivos.push('Nombre incompleto')
  else if (faltaApellido) motivos.push('Falta un apellido')
  if (faltaGrado) motivos.push('Falta grado')
  if (faltaSeccion) motivos.push('Falta sección')

  const incompleto = motivos.length > 0

  return {
    dniIncompleto,
    nombreIncompleto,
    faltaApellido,
    faltaGrado,
    faltaSeccion,
    incompleto,
    completo: !incompleto,
    motivos
  }
}

/** Compara nombres sin importar mayúsculas ni tildes. */
export function normalizarNombrePadron(nombre: string): string {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Marca como duplicados los registros con el mismo DNI o el mismo nombre
 * completo (normalizado). En la revisión del Excel se permiten DNIs repetidos,
 * por eso se comprueban ambas cosas.
 */
export function dnisDuplicadosPadron(votantes: DatosPadron[]): Set<string> {
  const porNombre = new Map<string, string[]>()
  const porDni = new Map<string, string[]>()

  for (const votante of votantes) {
    const nombre = normalizarNombrePadron(votante.nombre)
    if (nombre) {
      const grupo = porNombre.get(nombre) ?? []
      grupo.push(votante.dni)
      porNombre.set(nombre, grupo)
    }

    const dni = String(votante.dni ?? '').trim()
    if (dni) {
      const grupo = porDni.get(dni) ?? []
      grupo.push(votante.dni)
      porDni.set(dni, grupo)
    }
  }

  const duplicados = new Set<string>()
  for (const grupos of [porNombre, porDni]) {
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue
      grupo.forEach((dni) => duplicados.add(dni))
    }
  }
  return duplicados
}

export function cumpleFiltroDatos(
  votante: DatosPadron,
  filtro: FiltroDatosPadron,
  dnisDuplicados?: Set<string>
): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'duplicados') return dnisDuplicados?.has(votante.dni) ?? false

  const revision = evaluarDatosPadron(votante)
  if (filtro === 'incompletos') return revision.incompleto
  if (filtro === 'completos') return revision.completo
  if (filtro === 'dni') return revision.dniIncompleto
  if (filtro === 'nombre') return revision.nombreIncompleto
  if (filtro === 'apellidos') return revision.faltaApellido
  if (filtro === 'grado') return revision.faltaGrado
  return revision.faltaSeccion
}
