/**
 * Utilidades para importar el padrón desde Excel (.xlsx/.xlsm) o CSV.
 *
 * No se usa ninguna dependencia externa: un XLSX es un ZIP con XML y los
 * navegadores modernos traen DecompressionStream. La tabla `votantes` guarda
 * un único campo `nombre`, así que los tres campos del Excel (Nombres,
 * Apellido Paterno y Apellido Materno) se combinan en ese campo.
 */

export type FilaPadron = {
  dni: string
  nombre: string
  grado: string | null
  seccion: string | null
}

type Columnas = {
  dni?: number
  nombres?: number
  apellidoPaterno?: number
  apellidoMaterno?: number
  grado?: number
  seccion?: number
}

const ALIAS: Record<keyof Columnas, string[]> = {
  dni: ['dni', 'documento', 'numerodedocumento', 'numdoc', 'cedula'],
  nombres: ['nombres', 'nombrecompleto', 'nombre', 'nom', 'name', 'firstname'],
  apellidoPaterno: ['apellidopaterno', 'paterno', 'apellido1', 'primerapellido', 'lastname'],
  apellidoMaterno: ['apellidomaterno', 'materno', 'apellido2', 'segundoapellido'],
  grado: ['grado', 'gradoacademico', 'anio', 'ano'],
  seccion: ['seccion', 'seccionacademica', 'clase', 'curso'],
}

export function textoLimpio(valor: unknown): string {
  return String(valor ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizarEncabezado(valor: unknown): string {
  return textoLimpio(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Normaliza el DNI para que coincida con el constraint de 8 dígitos de la BD. */
export function normalizarDni(valor: unknown): string {
  let texto = textoLimpio(valor)

  // Excel puede guardar el DNI como número y mostrarlo en notación científica.
  if (/^\d+(?:\.\d+)?[eE][+-]?\d+$/.test(texto)) {
    const numero = Number(texto)
    if (Number.isSafeInteger(numero)) texto = String(numero)
  }
  texto = texto.replace(/\.0+$/, '')

  const digitos = texto.replace(/\D/g, '')
  // Si el DNI empezaba con ceros, Excel los perdió al convertirlo en número.
  return digitos.length > 0 && digitos.length < 8 ? digitos.padStart(8, '0') : digitos
}

function componerNombre(...partes: unknown[]): string {
  return partes.map(textoLimpio).filter(Boolean).join(' ')
}

export function dividirEnLotes<T>(elementos: T[], tamano = 1000): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < elementos.length; i += tamano) {
    lotes.push(elementos.slice(i, i + tamano))
  }
  return lotes
}

export function parsearCSV(texto: string): string[][] {
  const contenido = texto.replace(/^\uFEFF/, '')
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] ?? ''
  const delimitador =
    (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ','

  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false

  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i]

    if (entreComillas) {
      if (caracter === '"') {
        if (contenido[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreComillas = false
        }
      } else {
        campo += caracter
      }
      continue
    }

    if (caracter === '"' && campo.trim() === '') {
      entreComillas = true
    } else if (caracter === delimitador) {
      fila.push(campo)
      campo = ''
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && contenido[i + 1] === '\n') i++
      fila.push(campo)
      campo = ''
      if (fila.some((valor) => valor.trim() !== '')) filas.push(fila)
      fila = []
    } else {
      campo += caracter
    }
  }

  fila.push(campo)
  if (fila.some((valor) => valor.trim() !== '')) filas.push(fila)
  return filas
}

function encontrarColumnas(encabezados: string[]): Columnas {
  const normalizados = encabezados.map(normalizarEncabezado)
  const columnas: Columnas = {}

  for (const [clave, alias] of Object.entries(ALIAS) as Array<[keyof Columnas, string[]]>) {
    const indice = normalizados.findIndex((encabezado) => alias.includes(encabezado))
    if (indice >= 0) columnas[clave] = indice
  }

  const tieneNombre =
    columnas.nombres !== undefined ||
    columnas.apellidoPaterno !== undefined ||
    columnas.apellidoMaterno !== undefined

  if (columnas.dni === undefined || !tieneNombre) {
    throw new Error(
      'No se encontraron las columnas necesarias. El archivo debe tener: DNI, Nombres, ' +
        'Apellido Paterno, Apellido Materno (y opcionalmente Grado y Sección). ' +
        `Columnas detectadas: ${encabezados.filter(Boolean).join(' | ') || 'ninguna'}.`
    )
  }

  return columnas
}

export function filasARegistros(matriz: string[][]): FilaPadron[] {
  const indiceEncabezado = matriz.findIndex((fila) => fila.some((valor) => valor.trim() !== ''))
  if (indiceEncabezado < 0) return []

  const columnas = encontrarColumnas(matriz[indiceEncabezado])
  const registros: FilaPadron[] = []

  for (const fila of matriz.slice(indiceEncabezado + 1)) {
    if (!fila.some((valor) => valor.trim() !== '')) continue

    const valor = (columna?: number) => (columna === undefined ? '' : textoLimpio(fila[columna]))
    const nombre = componerNombre(
      valor(columnas.nombres),
      valor(columnas.apellidoPaterno),
      valor(columnas.apellidoMaterno)
    )
    if (!nombre && !valor(columnas.dni)) continue

    registros.push({
      dni: normalizarDni(valor(columnas.dni)),
      nombre,
      grado: valor(columnas.grado) || null,
      seccion: valor(columnas.seccion) || null
    })
  }

  return registros
}

// --- XLSX sin dependencias: ZIP + XML -------------------------------------

function desdecodificarXml(valor: string): string {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo: string) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&amp;/g, '&')
}

function columnaDesdeReferencia(referencia: string): number {
  let numero = 0
  for (const caracter of referencia.toUpperCase()) {
    numero = numero * 26 + (caracter.charCodeAt(0) - 64)
  }
  return Math.max(0, numero - 1)
}

async function descomprimir(bytes: Uint8Array, metodo: number): Promise<Uint8Array> {
  if (metodo === 0) return bytes
  if (metodo !== 8) throw new Error('El archivo Excel usa una compresión no soportada.')

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede leer archivos XLSX. Usa un archivo CSV.')
  }

  const flujo = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}

type EntradaZip = { metodo: number; tamano: number; offset: number }

function indiceZip(datos: Uint8Array): { vista: DataView; entradas: Map<string, EntradaZip> } {
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  let eocd = -1
  for (let i = datos.length - 22; i >= 0; i--) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('El archivo no es un XLSX válido.')

  const total = vista.getUint16(eocd + 10, true)
  let cursor = vista.getUint32(eocd + 16, true)
  const entradas = new Map<string, EntradaZip>()
  const decoder = new TextDecoder()

  for (let i = 0; i < total && cursor + 46 <= datos.length; i++) {
    if (vista.getUint32(cursor, true) !== 0x02014b50) break
    const metodo = vista.getUint16(cursor + 10, true)
    const tamano = vista.getUint32(cursor + 20, true)
    const longitudNombre = vista.getUint16(cursor + 28, true)
    const longitudExtra = vista.getUint16(cursor + 30, true)
    const longitudComentario = vista.getUint16(cursor + 32, true)
    const offset = vista.getUint32(cursor + 42, true)
    const nombre = decoder.decode(datos.subarray(cursor + 46, cursor + 46 + longitudNombre))
    entradas.set(nombre, { metodo, tamano, offset })
    cursor += 46 + longitudNombre + longitudExtra + longitudComentario
  }

  return { vista, entradas }
}

async function leerEntrada(
  datos: Uint8Array,
  vista: DataView,
  entradas: Map<string, EntradaZip>,
  nombre: string
): Promise<string | null> {
  const entrada = entradas.get(nombre)
  if (!entrada) return null
  if (vista.getUint32(entrada.offset, true) !== 0x04034b50) {
    throw new Error('El archivo XLSX está dañado.')
  }

  const longitudNombre = vista.getUint16(entrada.offset + 26, true)
  const longitudExtra = vista.getUint16(entrada.offset + 28, true)
  const inicio = entrada.offset + 30 + longitudNombre + longitudExtra
  const contenido = await descomprimir(datos.subarray(inicio, inicio + entrada.tamano), entrada.metodo)
  return new TextDecoder().decode(contenido)
}

function textoCelda(contenido: string, tipo: string | undefined, compartidos: string[]): string {
  if (tipo === 'inlineStr') {
    return [...contenido.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((coincidencia) => desdecodificarXml(coincidencia[1]))
      .join('')
  }

  const valor = contenido.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]
  if (valor === undefined) return ''
  const texto = desdecodificarXml(valor)
  return tipo === 's' ? (compartidos[Number(texto)] ?? '') : texto
}

export async function parsearXlsx(archivo: File): Promise<string[][]> {
  const datos = new Uint8Array(await archivo.arrayBuffer())
  const { vista, entradas } = indiceZip(datos)

  const xmlCompartidos = await leerEntrada(datos, vista, entradas, 'xl/sharedStrings.xml')
  const compartidos: string[] = []
  if (xmlCompartidos) {
    for (const celda of xmlCompartidos.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      compartidos.push(
        [...celda[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((texto) => desdecodificarXml(texto[1]))
          .join('')
      )
    }
  }

  const nombreHoja =
    [...entradas.keys()]
      .filter((nombre) => /^xl\/worksheets\/[^/]+\.xml$/.test(nombre))
      .sort((a, b) => a.localeCompare(b))[0] ?? 'xl/worksheets/sheet1.xml'
  const xml = await leerEntrada(datos, vista, entradas, nombreHoja)
  if (!xml) throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.')

  const matriz: string[][] = []
  for (const filaXml of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila: string[] = []
    for (const celda of filaXml[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = celda[1] ?? ''
      const contenido = celda[2] ?? ''
      const referencia = atributos.match(/\br="([A-Z]+)\d+"/)?.[1]
      const columna = referencia ? columnaDesdeReferencia(referencia) : fila.length
      const tipo = atributos.match(/\bt="([^"]+)"/)?.[1]
      while (fila.length < columna) fila.push('')
      fila[columna] = textoCelda(contenido, tipo, compartidos)
    }
    if (fila.some((valor) => valor.trim() !== '')) matriz.push(fila)
  }

  return matriz
}

export async function leerFilasPadron(archivo: File): Promise<FilaPadron[]> {
  const nombre = archivo.name.toLowerCase()

  if (/\.(xlsx|xlsm)$/.test(nombre)) {
    return filasARegistros(await parsearXlsx(archivo))
  }
  if (/\.csv$/.test(nombre)) {
    return filasARegistros(parsearCSV(await archivo.text()))
  }
  if (/\.xls$/.test(nombre)) {
    throw new Error('El formato .xls antiguo no es compatible. Guárdalo como .xlsx o .csv e inténtalo de nuevo.')
  }
  throw new Error('Formato no soportado. Usa un archivo .xlsx o .csv.')
}
