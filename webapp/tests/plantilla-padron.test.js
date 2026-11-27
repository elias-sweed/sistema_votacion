import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENCABEZADOS_PLANTILLA,
  generarPlantillaCSV,
  generarPlantillaXlsx
} from '../src/lib/exportarPlantilla.ts';
import { leerFilasPadron, parsearCSV, parsearXlsx } from '../src/lib/importarPadron.ts';

const ENCABEZADOS = [
  'grado',
  'sección',
  'DNI',
  'Apellido Paterno',
  'Apellido Materno',
  'Nombres'
];

test('la plantilla define los seis encabezados en el orden pedido', () => {
  assert.deepEqual([...ENCABEZADOS_PLANTILLA], ENCABEZADOS);
});

test('la plantilla CSV conserva los acentos y los encabezados', async () => {
  const blob = generarPlantillaCSV();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'lleva BOM para Excel');
  assert.deepEqual(parsearCSV(texto), [ENCABEZADOS]);
});

test('la plantilla XLSX es un ZIP válido con una sola fila de encabezados', async () => {
  const blob = generarPlantillaXlsx();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const archivo = new File([blob], 'plantilla-padron.xlsx', { type: blob.type });

  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  assert.deepEqual(await parsearXlsx(archivo), [ENCABEZADOS]);
  assert.deepEqual(await leerFilasPadron(archivo), [], 'una plantilla vacía no crea votantes');
});

test('la plantilla llena se puede volver a cargar en el software', async () => {
  const texto = await generarPlantillaCSV().text();
  const lleno =
    texto +
    '1°,A,12345678,Pérez,García,Ana María\r\n' +
    '2°,B,87654321,Ramírez,Soto,Luis\r\n';
  const archivo = new File([lleno], 'padron.csv', { type: 'text/csv' });

  assert.deepEqual(await leerFilasPadron(archivo), [
    { dni: '12345678', nombre: 'Ana María Pérez García', grado: '1°', seccion: 'A' },
    { dni: '87654321', nombre: 'Luis Ramírez Soto', grado: '2°', seccion: 'B' }
  ]);
});
