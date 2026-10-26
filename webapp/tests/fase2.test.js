#!/usr/bin/env node
// Pruebas de la Fase 2 contra Supabase local; usa y limpia solo fixtures propios.

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import crypto from 'crypto';

if (existsSync('.env.test')) loadEnvFile('.env.test');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.test');
  process.exit(1);
}

if (!['localhost', '127.0.0.1', '::1'].includes(new URL(SUPABASE_URL).hostname)) {
  console.error('Seguridad: las pruebas solo se ejecutan contra Supabase local.');
  process.exit(1);
}

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(SUPABASE_URL, ANON_KEY, authOptions);
const backend = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, authOptions);
const runId = crypto.randomUUID();
const mesaPrefix = `test-${runId}`;
const voterNames = ['Ana', 'Carlos', 'Maria', 'Pedro'].map((name, index) => `${name} ${runId}-${index}`);
let adminUser;
let member;
let fixture;
const createdUserIds = [];
const allocatedDnis = new Set();
let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`PASS ${name}`);
    passed++;
  } else {
    console.error(`FAIL ${name}${details ? `: ${details}` : ''}`);
    failed++;
  }
}

async function createPrincipal(role) {
  const email = `${role}-${runId}@example.test`;
  const password = `Test-${crypto.randomUUID()}-aA1!`;
  const { data, error } = await backend.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: role === 'admin' ? { role: 'admin' } : {},
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = createClient(SUPABASE_URL, ANON_KEY, authOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function uniqueDni() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const dni = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
    const { data, error } = await backend.from('votantes').select('dni').eq('dni', dni).maybeSingle();
    if (error) throw error;
    if (!data && !allocatedDnis.has(dni)) {
      allocatedDnis.add(dni);
      return dni;
    }
  }
  throw new Error('No se pudo generar un DNI de prueba disponible.');
}

async function createFixtures() {
  const baseTotal = await backend.from('votantes').select('dni', { count: 'exact', head: true });
  const baseVoted = await backend.from('votantes').select('dni', { count: 'exact', head: true }).eq('ha_votado', true);
  const basePending = await backend.from('votantes').select('dni', { count: 'exact', head: true }).eq('ha_votado', false);
  for (const result of [baseTotal, baseVoted, basePending]) {
    if (result.error) throw result.error;
  }

  const dnis = {};
  for (const key of [
    'voted', 'pendingOne', 'pendingTwo', 'pendingThree',
    'validOne', 'validTwo', 'previewNew', 'invalidMesa', 'emptyName',
    'importOne', 'importTwo', 'importNew',
  ]) {
    dnis[key] = await uniqueDni();
  }

  const { data: mesas, error: mesaError } = await backend.from('mesas').insert([
    { nombre: `${mesaPrefix}-A`, activo: true },
    { nombre: `${mesaPrefix}-B`, activo: true },
    { nombre: `${mesaPrefix}-Inactiva`, activo: false },
  ]).select();
  if (mesaError) throw mesaError;

  const mesaA = mesas.find(mesa => mesa.nombre.endsWith('-A'));
  const mesaB = mesas.find(mesa => mesa.nombre.endsWith('-B'));
  fixture = {
    dnis,
    mesas,
    mesaA,
    mesaB,
    baseTotal: baseTotal.count ?? 0,
    baseVoted: baseVoted.count ?? 0,
    basePending: basePending.count ?? 0,
  };
  const { error: voterError } = await backend.from('votantes').insert([
    { dni: dnis.voted, nombre: voterNames[0], mesa_id: mesaA.id, ha_votado: true },
    { dni: dnis.pendingOne, nombre: voterNames[1], mesa_id: mesaA.id, ha_votado: false },
    { dni: dnis.pendingTwo, nombre: voterNames[2], mesa_id: mesaB.id, ha_votado: false },
    { dni: dnis.pendingThree, nombre: voterNames[3], mesa_id: mesaB.id, ha_votado: false },
  ]);
  if (voterError) throw voterError;
}

async function testMesasCRUD() {
  const { data: list, error: listError } = await adminUser.from('mesas').select('id, nombre');
  assert(!listError && list?.filter(mesa => mesa.nombre.startsWith(mesaPrefix)).length === 3,
    'mesas: solo crea tres fixtures propios', listError?.message);

  const { data: created, error: createError } = await adminUser.from('mesas')
    .insert({ nombre: `${mesaPrefix}-Extra-A`, activo: true }).select().single();
  assert(!createError && created?.activo === true, 'mesas: crea mesa activa', createError?.message);
  if (created) fixture.extraMesaId = created.id;

  const { error: updateError } = await adminUser.from('mesas')
    .update({ nombre: `${mesaPrefix}-Extra-B` }).eq('id', fixture.extraMesaId);
  assert(!updateError, 'mesas: edita fixture propio', updateError?.message);

  const { error: deactivateError } = await adminUser.from('mesas')
    .update({ activo: false }).eq('id', fixture.extraMesaId);
  const { data: deactivated } = await adminUser.from('mesas')
    .select('id').eq('id', fixture.extraMesaId).eq('activo', true);
  assert(!deactivateError && deactivated?.length === 0, 'mesas: desactiva fixture propio', deactivateError?.message);

  const { error: reactivateError } = await adminUser.from('mesas')
    .update({ activo: true }).eq('id', fixture.extraMesaId);
  assert(!reactivateError, 'mesas: reactiva fixture propio', reactivateError?.message);
}

async function testMesasValidation() {
  const { error } = await adminUser.from('mesas').insert({
    nombre: `${mesaPrefix}-A`,
    activo: true,
  });
  assert(error?.code === '23505', 'mesas: rechaza nombre duplicado');
}

async function testPadronStats() {
  const { data, error } = await adminUser.rpc('obtener_estadisticas_padron');
  const stats = data?.[0];
  assert(!error, 'estadísticas: RPC autorizada para admin', error?.message);
  assert(stats?.total_votantes === fixture.baseTotal + 4, 'estadísticas: total respeta baseline y fixtures');
  assert(stats?.total_votaron === fixture.baseVoted + 1, 'estadísticas: total votaron respeta baseline');
  assert(stats?.total_pendientes === fixture.basePending + 3, 'estadísticas: pendientes respeta baseline');

  const expectedPercent = stats?.total_votantes
    ? Math.round((stats.total_votaron / stats.total_votantes) * 10000) / 100
    : 0;
  assert(Number(stats?.participacion_pct) === expectedPercent, 'estadísticas: porcentaje calculado');
  const ownMese = stats?.por_mesa?.filter(mesa => [fixture.mesaA.id, fixture.mesaB.id].includes(mesa.mesa_id));
  assert(ownMese?.length === 2, 'estadísticas: incluye las dos mesas activas propias');
}

async function testListVoters() {
  const { data: all, error: allError } = await adminUser.rpc('listar_votantes', { p_limit: 50, p_offset: 0 });
  assert(!allError && all?.[0]?.total_count === fixture.baseTotal + 4, 'listado: total global incluye baseline', allError?.message);

  const { data: byTable, error: tableError } = await adminUser.rpc('listar_votantes', {
    p_mesa_id: fixture.mesaA.id,
    p_limit: 50,
    p_offset: 0,
  });
  assert(!tableError && byTable?.length === 2, 'listado: filtra por mesa', tableError?.message);

  const { data: pending, error: pendingError } = await adminUser.rpc('listar_votantes', {
    p_solo_pendientes: true,
    p_limit: 50,
    p_offset: 0,
  });
  assert(!pendingError && pending?.[0]?.total_count === fixture.basePending + 3, 'listado: cuenta solo pendientes', pendingError?.message);

  const { data: byDni, error: dniError } = await adminUser.rpc('listar_votantes', {
    p_busqueda: fixture.dnis.pendingOne,
    p_limit: 50,
    p_offset: 0,
  });
  assert(!dniError && byDni?.length === 1 && byDni[0].nombre === voterNames[1],
    'listado: busca por DNI sin ambigüedad', dniError?.message);

  const { data: byName, error: nameError } = await adminUser.rpc('listar_votantes', {
    p_busqueda: runId,
    p_limit: 50,
    p_offset: 0,
  });
  assert(!nameError && byName?.length === 4, 'listado: busca nombres de fixtures', nameError?.message);
}

async function testImportValidation() {
  const { dnis, mesaA } = fixture;
  const { data: valid, error: validError } = await adminUser.rpc('validar_importacion_votantes', {
    p_votantes: [
      { dni: dnis.validOne, nombre: 'Preview uno', mesa_id: mesaA.id },
      { dni: dnis.validTwo, nombre: 'Preview dos', mesa_id: mesaA.id },
    ],
  });
  assert(!validError && valid?.[0]?.validos === 2 && valid[0].invalidos === 0,
    'validación: acepta filas válidas', validError?.message);

  const { data: duplicate } = await adminUser.rpc('validar_importacion_votantes', {
    p_votantes: [
      { dni: dnis.voted, nombre: voterNames[0], mesa_id: mesaA.id },
      { dni: dnis.previewNew, nombre: 'Nuevo preview', mesa_id: mesaA.id },
    ],
  });
  assert(duplicate?.[0]?.validos === 1 && duplicate[0].invalidos === 1, 'validación: detecta duplicado de fixture');

  const { data: invalidDni } = await adminUser.rpc('validar_importacion_votantes', {
    p_votantes: [{ dni: 'abc', nombre: 'Fila inválida', mesa_id: mesaA.id }],
  });
  assert(invalidDni?.[0]?.invalidos === 1, 'validación: rechaza DNI inválido');

  const { data: invalidMesa } = await adminUser.rpc('validar_importacion_votantes', {
    p_votantes: [{ dni: dnis.invalidMesa, nombre: 'Mesa inválida', mesa_id: '00000000-0000-0000-0000-000000000000' }],
  });
  assert(invalidMesa?.[0]?.invalidos === 1, 'validación: rechaza mesa inválida');

  const { data: emptyName } = await adminUser.rpc('validar_importacion_votantes', {
    p_votantes: [{ dni: dnis.emptyName, nombre: '', mesa_id: mesaA.id }],
  });
  assert(emptyName?.[0]?.invalidos === 1, 'validación: rechaza nombre vacío');
}

async function testBulkImport() {
  const { dnis, mesaA } = fixture;
  const newRows = [
    { dni: dnis.importOne, nombre: 'Importado uno', mesa_id: mesaA.id },
    { dni: dnis.importTwo, nombre: 'Importado dos', mesa_id: mesaA.id },
  ];
  const { data, error } = await adminUser.rpc('importar_votantes', { p_votantes: newRows });
  assert(!error && data?.[0]?.insertados === 2 && data[0].duplicados === 0, 'importación: inserta filas propias', error?.message);

  const { data: inserted } = await backend.from('votantes').select('dni')
    .in('dni', [dnis.importOne, dnis.importTwo]);
  assert(inserted?.length === 2, 'importación: fixtures aparecen en padrón');

  const { data: duplicate } = await adminUser.rpc('importar_votantes', { p_votantes: newRows });
  assert(duplicate?.[0]?.insertados === 0 && duplicate[0].duplicados === 2, 'importación: detecta reintento duplicado');

  const { data: mixed } = await adminUser.rpc('importar_votantes', {
    p_votantes: [
      { dni: dnis.importNew, nombre: 'Importado nuevo', mesa_id: mesaA.id },
      { dni: dnis.importOne, nombre: 'Duplicado propio', mesa_id: mesaA.id },
      { dni: 'not-a-dni', nombre: 'Error DNI', mesa_id: mesaA.id },
    ],
  });
  assert(mixed?.[0]?.insertados === 1 && mixed[0].duplicados === 1 && mixed[0].errores?.length >= 1,
    'importación: procesa filas válidas, duplicadas e inválidas');
}

async function testAuthorization() {
  const { error: anonReadError } = await anon.from('votantes').select('dni').limit(1);
  assert(Boolean(anonReadError), 'anon: sin acceso directo al padrón', anonReadError?.message);

  const protectedCalls = [
    ['estadísticas', client => client.rpc('obtener_estadisticas_padron')],
    ['listado', client => client.rpc('listar_votantes', { p_limit: 10 })],
    ['validación', client => client.rpc('validar_importacion_votantes', { p_votantes: [] })],
    ['importación', client => client.rpc('importar_votantes', { p_votantes: [] })],
  ];
  for (const [name, call] of protectedCalls) {
    const { error } = await call(anon);
    assert(Boolean(error), `anon: RPC de ${name} denegada`, error?.message);
  }

  const { data: memberRows, error: memberReadError } = await member.from('votantes').select('dni').limit(1);
  assert(!memberReadError && memberRows?.length === 0, 'usuario normal: RLS no devuelve DNI', memberReadError?.message);

  for (const [name, call] of protectedCalls) {
    const { error } = await call(member);
    assert(Boolean(error), `usuario normal: RPC de ${name} denegada`, error?.message);
  }

  const { data: userMetadata, error: metadataError } = await member.auth.updateUser({
    data: { role: 'admin' },
  });
  assert(!metadataError && userMetadata?.user?.user_metadata?.role === 'admin',
    'usuario normal: puede alterar solo user_metadata', metadataError?.message);
  await member.auth.refreshSession();
  const { error: forgedRoleError } = await member.rpc('obtener_estadisticas_padron');
  assert(Boolean(forgedRoleError), 'user_metadata no permite falsificar app_metadata.role', forgedRoleError?.message);

  const { data: adminRows, error: adminReadError } = await adminUser.from('votantes')
    .select('dni').eq('dni', fixture.dnis.voted);
  assert(!adminReadError && adminRows?.length === 1, 'admin autenticado: accede al padrón por RLS', adminReadError?.message);

  for (const [name, call] of protectedCalls) {
    const { error } = await call(adminUser);
    assert(!error, `admin autenticado: autorizado en RPC de ${name}`, error?.message);
  }
}

async function cleanup() {
  if (fixture) {
    const dnis = Object.values(fixture.dnis);
    const { error: voterError } = await backend.from('votantes').delete().in('dni', dnis);
    if (voterError) console.error(`No se pudieron limpiar fixtures del padrón: ${voterError.message}`);

    const mesaIds = fixture.mesas.map(mesa => mesa.id);
    if (fixture.extraMesaId) mesaIds.push(fixture.extraMesaId);
    const { error: mesaError } = await backend.from('mesas').delete().in('id', mesaIds);
    if (mesaError) console.error(`No se pudieron limpiar fixtures de mesas: ${mesaError.message}`);
  }

  for (const id of createdUserIds) {
    const { error } = await backend.auth.admin.deleteUser(id);
    if (error) console.error(`No se pudo eliminar usuario temporal de prueba: ${error.message}`);
  }
}

async function runAllTests() {
  try {
    adminUser = await createPrincipal('admin');
    member = await createPrincipal('member');
    await createFixtures();

    await testMesasCRUD();
    await testMesasValidation();
    await testPadronStats();
    await testListVoters();
    await testImportValidation();
    await testBulkImport();
    await testAuthorization();
  } catch (error) {
    failed++;
    console.error(`ERROR de ejecución de pruebas: ${error.message}`);
  } finally {
    await cleanup();
  }

  console.log(`\nResultados reales Fase 2: ${passed} aprobadas, ${failed} fallidas`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runAllTests();
