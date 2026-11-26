import assert from 'node:assert/strict';
import test from 'node:test';
import { nombresMesasGrupo } from '../src/lib/mesas.ts';

test('una sola combinación crea una mesa individual', () => {
  assert.deepEqual(nombresMesasGrupo(['1°'], ['A']), ['1° A']);
});

test('un grado con varias secciones crea un grupo', () => {
  assert.deepEqual(nombresMesasGrupo(['1°'], ['A', 'B', 'C']), ['1° A', '1° B', '1° C']);
});

test('varios grados con una sección crea un grupo', () => {
  assert.deepEqual(nombresMesasGrupo(['1°', '2°', '3°'], ['A']), ['1° A', '2° A', '3° A']);
});

test('varios grados y secciones crea la combinación completa en orden', () => {
  assert.deepEqual(nombresMesasGrupo(['1°', '2°'], ['A', 'B']), [
    '1° A',
    '1° B',
    '2° A',
    '2° B'
  ]);
});

test('ignora valores vacíos y repeticiones', () => {
  assert.deepEqual(nombresMesasGrupo(['1°', ' 1° ', ''], ['A', 'A', '  ']), ['1° A']);
});

test('sin grados o sin secciones no crea mesas', () => {
  assert.deepEqual(nombresMesasGrupo([], ['A', 'B']), []);
  assert.deepEqual(nombresMesasGrupo(['1°', '2°'], []), []);
});
