/**
 * Plantilla oficial del padrón. Se genera en el navegador, sin dependencias:
 * un XLSX es un ZIP con XML y se puede abrir directamente en Excel.
 * Las columnas coinciden con las que acepta `importarPadron.ts`.
 */

export const ENCABEZADOS_PLANTILLA = [
  'grado',
  'sección',
  'DNI',
  'Apellido Paterno',
  'Apellido Materno',
  'Nombres'
] as const

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// CRC32 del ZIP (Excel valida que cada entrada tenga el suyo correcto).
let tablaCrc: Uint32Array | null = null

function crc32(bytes: Uint8Array): number {
  if (!tablaCrc) {
    tablaCrc = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let valor = i
      for (let bit = 0; bit < 8; bit++) {
        valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1
      }
      tablaCrc[i] = valor >>> 0
    }
  }

  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ tablaCrc[(crc ^ byte) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

/** ZIP sin comprimir: suficiente para una plantilla de seis encabezados. */
function crearZip(entradas: Array<[string, string]>): Uint8Array {
  const codificador = new TextEncoder()
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let offset = 0

  for (const [nombre, contenido] of entradas) {
    const nombreBytes = codificador.encode(nombre)
    const datos = codificador.encode(contenido)
    const crc = crc32(datos)

    const local = new Uint8Array(30 + nombreBytes.length)
    const vistaLocal = new DataView(local.buffer)
    vistaLocal.setUint32(0, 0x04034b50, true) // firma del archivo local
    vistaLocal.setUint16(4, 20, true) // versión necesaria
    vistaLocal.setUint16(6, 0x0800, true) // nombre en UTF-8
    vistaLocal.setUint16(8, 0, true) // sin compresión
    vistaLocal.setUint32(14, crc, true)
    vistaLocal.setUint32(18, datos.length, true)
    vistaLocal.setUint32(22, datos.length, true)
    vistaLocal.setUint16(26, nombreBytes.length, true)
    local.set(nombreBytes, 30)

    const central = new Uint8Array(46 + nombreBytes.length)
    const vistaCentral = new DataView(central.buffer)
    vistaCentral.setUint32(0, 0x02014b50, true) // firma del directorio central
    vistaCentral.setUint16(4, 20, true)
    vistaCentral.setUint16(6, 20, true)
    vistaCentral.setUint16(8, 0x0800, true)
    vistaCentral.setUint16(10, 0, true)
    vistaCentral.setUint32(16, crc, true)
    vistaCentral.setUint32(20, datos.length, true)
    vistaCentral.setUint32(24, datos.length, true)
    vistaCentral.setUint16(28, nombreBytes.length, true)
    vistaCentral.setUint32(42, offset, true)
    central.set(nombreBytes, 46)

    locales.push(local, datos)
    centrales.push(central)
    offset += local.length + datos.length
  }

  const tamanoCentral = centrales.reduce((total, entrada) => total + entrada.length, 0)
  const fin = new Uint8Array(22)
  const vistaFin = new DataView(fin.buffer)
  vistaFin.setUint32(0, 0x06054b50, true)
  vistaFin.setUint16(8, centrales.length, true)
  vistaFin.setUint16(10, centrales.length, true)
  vistaFin.setUint32(12, tamanoCentral, true)
  vistaFin.setUint32(16, offset, true)

  const archivo = new Uint8Array(offset + tamanoCentral + fin.length)
  let cursor = 0
  for (const parte of [...locales, ...centrales, fin]) {
    archivo.set(parte, cursor)
    cursor += parte.length
  }
  return archivo
}

const EspacioNombres = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const EspacioRelaciones = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Devuelve un .xlsx con una hoja "Padrón" y los encabezados ya listos. */
export function generarPlantillaXlsx(): Blob {
  const celdas = ENCABEZADOS_PLANTILLA.map((encabezado, indice) => {
    const columna = String.fromCharCode(65 + indice)
    return `<c r="${columna}1" t="inlineStr"><is><t>${escaparXml(encabezado)}</t></is></c>`
  }).join('')

  const hoja =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${EspacioNombres}">` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    '</sheetView></sheetViews>' +
    '<cols>' +
    '<col min="1" max="1" width="10" customWidth="1"/>' +
    '<col min="2" max="2" width="10" customWidth="1"/>' +
    '<col min="3" max="3" width="14" customWidth="1"/>' +
    '<col min="4" max="5" width="22" customWidth="1"/>' +
    '<col min="6" max="6" width="22" customWidth="1"/>' +
    '</cols>' +
    `<sheetData><row r="1">${celdas}</row></sheetData>` +
    '</worksheet>'

  const tipos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>'

  const relaciones =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${EspacioRelaciones}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>'

  const libro =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<workbook xmlns="${EspacioNombres}" xmlns:r="${EspacioRelaciones}">` +
    '<sheets><sheet name="Padrón" sheetId="1" r:id="rId1"/></sheets>' +
    '</workbook>'

  const relacionesLibro =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${EspacioRelaciones}/worksheet" Target="worksheets/sheet1.xml"/>` +
    '</Relationships>'

  const bytes = crearZip([
    ['[Content_Types].xml', tipos],
    ['_rels/.rels', relaciones],
    ['xl/workbook.xml', libro],
    ['xl/_rels/workbook.xml.rels', relacionesLibro],
    ['xl/worksheets/sheet1.xml', hoja]
  ])

  // Copia explícita para que el tipo de Blob sea compatible con todos los TS lib.
  return new Blob([new Uint8Array(bytes)], { type: TIPO_XLSX })
}

/** Variante CSV de la misma plantilla, con BOM para que Excel respete los acentos. */
export function generarPlantillaCSV(): Blob {
  return new Blob(['\uFEFF', ENCABEZADOS_PLANTILLA.join(','), '\r\n'], {
    type: 'text/csv;charset=utf-8;'
  })
}
