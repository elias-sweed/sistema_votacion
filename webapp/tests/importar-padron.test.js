import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dividirEnLotes,
  filasARegistros,
  leerFilasPadron,
  normalizarDni,
  parsearCSV,
  parsearXlsx
} from '../src/lib/importarPadron.ts';

const CABECERAS = [
  'grado',
  'sección',
  'DNI',
  'Apellido Paterno',
  'Apellido Materno',
  'Nombres'
];

const escaparXml = (valor) =>
  String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function comprimir(bytes, metodo) {
  if (metodo === 0) return bytes;
  const flujo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Construye un XLSX mínimo pero válido, con cadenas compartidas o inline. */
async function crearXlsx(filas, { metodo = 8, compartidas = true } = {}) {
  const encoder = new TextEncoder();
  const shared = [];
  const celdas = filas.map((fila, indiceFila) =>
    fila
      .map((valor, indiceColumna) => {
        if (valor === '' || valor === null || valor === undefined) return '';
        const columna = String.fromCharCode(65 + indiceColumna);
        const referencia = `${columna}${indiceFila + 1}`;
        if (compartidas && typeof valor === 'string' && !/^\d+$/.test(valor)) {
          const indice = shared.push(valor) - 1;
          return `<c r="${referencia}" t="s"><v>${indice}</v></c>`;
        }
        const texto = escaparXml(valor);
        return typeof valor === 'number' || /^\d+$/.test(valor)
          ? `<c r="${referencia}"><v>${texto}</v></c>`
          : `<c r="${referencia}" t="inlineStr"><is><t>${texto}</t></is></c>`;
      })
      .join('')
  );

  const entradas = {
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      celdas.map((fila, i) => `<row r="${i + 1}">${fila}</row>`).join('') +
      '</sheetData></worksheet>'
  };
  if (compartidas) {
    const items = shared.map((valor) => `<si><t>${escaparXml(valor)}</t></si>`).join('');
    entradas['xl/sharedStrings.xml'] =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${items}</sst>`;
  }

  const partes = [];
  const central = [];
  let offset = 0;

  for (const [nombre, contenido] of Object.entries(entradas)) {
    const nombreBytes = encoder.encode(nombre);
    const crudo = encoder.encode(contenido);
    const datos = await comprimir(crudo, metodo);

    const local = new Uint8Array(30 + nombreBytes.length);
    const vistaLocal = new DataView(local.buffer);
    vistaLocal.setUint32(0, 0x04034b50, true);
    vistaLocal.setUint16(4, 20, true);
    vistaLocal.setUint16(8, metodo, true);
    vistaLocal.setUint32(18, datos.length, true);
    vistaLocal.setUint32(22, crudo.length, true);
    vistaLocal.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);

    const centro = new Uint8Array(46 + nombreBytes.length);
    const vistaCentral = new DataView(centro.buffer);
    vistaCentral.setUint32(0, 0x02014b50, true);
    vistaCentral.setUint16(4, 20, true);
    vistaCentral.setUint16(6, 20, true);
    vistaCentral.setUint16(10, metodo, true);
    vistaCentral.setUint32(20, datos.length, true);
    vistaCentral.setUint32(24, crudo.length, true);
    vistaCentral.setUint16(28, nombreBytes.length, true);
    vistaCentral.setUint32(42, offset, true);
    centro.set(nombreBytes, 46);

    partes.push(local, datos);
    central.push(centro);
    offset += local.length + datos.length;
  }

  const tamanoCentral = central.reduce((total, entrada) => total + entrada.length, 0);
  const eocd = new Uint8Array(22);
  const vistaEocd = new DataView(eocd.buffer);
  vistaEocd.setUint32(0, 0x06054b50, true);
  vistaEocd.setUint16(8, central.length, true);
  vistaEocd.setUint16(10, central.length, true);
  vistaEocd.setUint32(12, tamanoCentral, true);
  vistaEocd.setUint32(16, offset, true);

  return new File([...partes, ...central, eocd], 'padron.xlsx');
}

test('el CSV acepta las seis columnas del padrón sin depender del orden', () => {
  const csv = '\uFEFF' + [CABECERAS.join(','), '1°,A,12345678,Pérez,García,Ana María'].join('\r\n');

  assert.deepEqual(filasARegistros(parsearCSV(csv)), [
    {
      dni: '12345678',
      nombre: 'Ana María Pérez García',
      grado: '1°',
      seccion: 'A'
    }
  ]);
});

test('el CSV admite comillas, punto y coma y DNI con ceros a la izquierda', () => {
  const csv = [
    'Nombres;Apellido Paterno;Apellido Materno;DNI;Sección',
    '"López, Sofía";"De la Cruz";"  ";00123456;B'
  ].join('\n');
  const matriz = parsearCSV(csv);

  assert.deepEqual(matriz[1], ['López, Sofía', 'De la Cruz', '  ', '00123456', 'B']);
  assert.equal(normalizarDni('1.234.567'), '01234567');
  assert.equal(normalizarDni('12345678.0'), '12345678');
});

test('XLSX comprimido y sin comprimir producen el mismo padrón', async () => {
  const filas = [
    CABECERAS,
    ['2°', 'B', '87654321', 'Ramírez', 'Soto', 'Luis'],
    ['3°', 'C', '11223344', 'Ñuñez', 'Álvarez', 'María José']
  ];

  for (const metodo of [0, 8]) {
    const archivo = await crearXlsx(filas, { metodo });
    assert.deepEqual(await parsearXlsx(archivo), filas);
    assert.deepEqual(await leerFilasPadron(archivo), [
      { dni: '87654321', nombre: 'Luis Ramírez Soto', grado: '2°', seccion: 'B' },
      { dni: '11223344', nombre: 'María José Ñuñez Álvarez', grado: '3°', seccion: 'C' }
    ]);
  }
});

test('XLSX con celdas inline y DNI numérico también se importa', async () => {
  const archivo = await crearXlsx([CABECERAS, ['1°', 'A', 12345678, 'Pérez', 'García', 'Ana']], {
    compartidas: false
  });

  assert.deepEqual(await leerFilasPadron(archivo), [
    { dni: '12345678', nombre: 'Ana Pérez García', grado: '1°', seccion: 'A' }
  ]);
});

test('los CSV antiguos con dni,nombre siguen funcionando', async () => {
  const archivo = new File(['dni,nombre,grado,seccion\n12345678,Ana Pérez,1°,A'], 'padron.csv');

  assert.deepEqual(await leerFilasPadron(archivo), [
    { dni: '12345678', nombre: 'Ana Pérez', grado: '1°', seccion: 'A' }
  ]);
});

test('un archivo sin DNI avisa con las columnas detectadas', async () => {
  const archivo = new File(['Nombres,Apellido Paterno\nAna,Pérez'], 'padron.csv');
  await assert.rejects(leerFilasPadron(archivo), /No se encontraron las columnas necesarias/);
});

test('un .xls antiguo pide convertir el archivo a .xlsx', async () => {
  const archivo = new File(['dni,nombre\n12345678,Ana Pérez'], 'padron.xls');
  await assert.rejects(leerFilasPadron(archivo), /Guárdalo como \.xlsx o \.csv/);
});

test('los lotes respetan el máximo de 1000 filas del RPC', () => {
  const lotes = dividirEnLotes(Array.from({ length: 2501 }, (_, i) => i));
  assert.deepEqual(lotes.map((lote) => lote.length), [1000, 1000, 501]);
});
