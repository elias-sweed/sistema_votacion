#!/usr/bin/env node
// Pruebas de seguridad e integridad contra Supabase local.
// Requiere .env.test con URL local, anon key y service_role key de pruebas.

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

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(SUPABASE_URL, ANON_KEY, options);
const backend = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, options);
const runId = crypto.randomUUID();
const mesaName = `test-security-${runId}`;
const ipBase = crypto.randomInt(1, 240);

let adminUser;
let member;
let fixture;
let originalElectionOpen;
const createdUserIds = [];
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

function hashDni(dni) {
  return crypto.createHash('sha256').update(dni).digest('hex');
}

function testIp(offset = 0) {
  return `198.51.${ipBase}.${offset + 1}`;
}

async function createPrincipal(role) {
  const email = `${role}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-aA1!`;
  const { data, error } = await backend.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: role === 'admin' ? { role: 'admin' } : {},
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = createClient(SUPABASE_URL, ANON_KEY, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function resetRateLimit() {
  const hashes = Object.values(fixture.dnis).map(hashDni);
  const { error } = await backend.from('rate_limit_intentos').delete().in('dni_hash', hashes);
  if (error) throw error;
}

function backendVerify(dni, ip = testIp()) {
  return backend.rpc('verificar_votante_con_limite', {
    p_dni: dni,
    p_client_ip: ip,
    p_dni_hash: hashDni(dni),
  });
}

function backendVote(dni, candidateId, ip = testIp()) {
  return backend.rpc('emitir_voto_con_limite', {
    p_dni: dni,
    p_candidato_id: candidateId,
    p_client_ip: ip,
    p_dni_hash: hashDni(dni),
  });
}

async function setupTestData() {
  const dnis = {};
  for (const key of ['vote', 'concurrent', 'alreadyVoted', 'unused']) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
      const { data, error } = await backend.from('votantes').select('dni').eq('dni', candidate).maybeSingle();
      if (error) throw error;
      if (!data && !Object.values(dnis).includes(candidate)) {
        dnis[key] = candidate;
        break;
      }
    }
    if (!dnis[key]) throw new Error('No se pudo generar un DNI de prueba disponible.');
  }

  const { data: mesa, error: mesaError } = await backend
    .from('mesas').insert({ nombre: mesaName }).select().single();
  if (mesaError) throw mesaError;
  fixture = { dnis, mesaId: mesa.id, candidateIds: [] };

  const { data: candidates, error: candidateError } = await backend
    .from('candidatos')
    .insert([
      { nombre: `Lista segura ${runId}`, activo: true },
      { nombre: `Lista inactiva ${runId}`, activo: false },
    ])
    .select();
  if (candidateError) throw candidateError;

  fixture = {
    ...fixture,
    dnis,
    mesaId: mesa.id,
    candidateIds: candidates.map(candidate => candidate.id),
    candidateId: candidates.find(candidate => candidate.activo).id,
    inactiveCandidateId: candidates.find(candidate => !candidate.activo).id,
  };

  const { error: voterError } = await backend.from('votantes').insert([
    { dni: dnis.vote, nombre: `Estudiante de prueba ${runId}`, mesa_id: mesa.id, ha_votado: false },
    { dni: dnis.concurrent, nombre: `Segundo estudiante de prueba ${runId}`, mesa_id: mesa.id, ha_votado: false },
    { dni: dnis.alreadyVoted, nombre: `Estudiante que ya voto ${runId}`, mesa_id: mesa.id, ha_votado: true },
    { dni: dnis.unused, nombre: `Tercer estudiante de prueba ${runId}`, mesa_id: mesa.id, ha_votado: false },
  ]);
  if (voterError) throw voterError;

  const { data: config, error: configReadError } = await backend.from('configuracion')
    .select('eleccion_abierta').eq('id', 1).single();
  if (configReadError) throw configReadError;
  originalElectionOpen = config.eleccion_abierta;
  const { error: configError } = await backend.from('configuracion')
    .update({ eleccion_abierta: true }).eq('id', 1);
  if (configError) throw configError;

  return fixture;
}

async function testDirectRpcBlocked() {
  const calls = [
    ['anon', anon],
    ['usuario normal', member],
    ['admin autenticado', adminUser],
  ];

  for (const [label, client] of calls) {
    const { error: verifyError } = await client.rpc('verificar_votante', { p_dni: fixture.dnis.vote });
    assert(Boolean(verifyError), `${label}: RPC base verificar_votante denegada`, verifyError?.message);

    const { error: voteError } = await client.rpc('emitir_voto', {
      p_dni: fixture.dnis.vote,
      p_candidato_id: fixture.candidateId,
    });
    assert(Boolean(voteError), `${label}: RPC base emitir_voto denegada`, voteError?.message);

    const { error: wrappedError } = await client.rpc('verificar_votante_con_limite', {
      p_dni: fixture.dnis.vote,
      p_client_ip: testIp(5),
      p_dni_hash: hashDni(fixture.dnis.vote),
    });
    assert(Boolean(wrappedError), `${label}: wrapper reservado al backend`, wrappedError?.message);
  }
}

async function testAdminAndNonAdminAuthorization() {
  const { data: adminVoters, error: adminTableError } = await adminUser
    .from('votantes').select('dni').eq('dni', fixture.dnis.vote);
  assert(!adminTableError && adminVoters?.length === 1, 'admin con app_metadata autorizado a consultar padrón', adminTableError?.message);

  const { error: adminRpcError } = await adminUser.rpc('listar_votantes', { p_limit: 10 });
  assert(!adminRpcError, 'admin con app_metadata autorizado a RPC protegida', adminRpcError?.message);

  const { data: memberVoters, error: memberTableError } = await member
    .from('votantes').select('dni').eq('dni', fixture.dnis.vote);
  assert(!memberTableError && memberVoters?.length === 0, 'usuario normal no obtiene filas del padrón', memberTableError?.message);

  for (const [name, call] of [
    ['estadísticas', () => member.rpc('obtener_estadisticas_padron')],
    ['listado', () => member.rpc('listar_votantes', { p_limit: 10 })],
    ['validación', () => member.rpc('validar_importacion_votantes', { p_votantes: [] })],
    ['importación', () => member.rpc('importar_votantes', { p_votantes: [] })],
  ]) {
    const { error } = await call();
    assert(Boolean(error), `usuario normal bloqueado en RPC de ${name}`, error?.message);
  }

  const { data: updatedUser, error: metadataError } = await member.auth.updateUser({
    data: { role: 'admin' },
  });
  assert(!metadataError && updatedUser?.user?.user_metadata?.role === 'admin',
    'usuario normal solo puede modificar user_metadata', metadataError?.message);
  const { error: refreshError } = await member.auth.refreshSession();
  assert(!refreshError, 'usuario normal actualiza el JWT de prueba', refreshError?.message);
  assert(!refreshError, 'usuario normal puede renovar su token de prueba', refreshError?.message);
  const { error: forgedRoleError } = await member.rpc('listar_votantes', { p_limit: 10 });
  assert(Boolean(forgedRoleError), 'user_metadata.role no eleva privilegios administrativos', forgedRoleError?.message);

  const { error: memberInsertError } = await member.from('votantes').insert({
    dni: crypto.randomInt(0, 100000000).toString().padStart(8, '0'),
    nombre: 'No autorizado',
    mesa_id: fixture.mesaId,
  });
  assert(Boolean(memberInsertError), 'usuario normal no puede alterar el padrón', memberInsertError?.message);
}

async function testResultsView() {
  const { data: publicCandidates, error: candidateError } = await anon
    .from('candidatos').select('id, activo');
  assert(!candidateError && publicCandidates?.some(candidate => candidate.id === fixture.candidateId)
    && publicCandidates.every(candidate => candidate.activo), 'anon solo consulta candidatos activos', candidateError?.message);

  const { error: anonError } = await anon.from('resultados').select('*');
  assert(Boolean(anonError), 'anon no tiene SELECT en resultados', anonError?.message);

  const { data: memberRows, error: memberError } = await member.from('resultados').select('*');
  assert(!memberError && memberRows?.length === 0, 'usuario normal no recibe resultados protegidos', memberError?.message);

  const { data: adminRows, error: adminError } = await adminUser.from('resultados').select('*');
  assert(!adminError && adminRows?.some(row => row.id === fixture.candidateId), 'admin consulta resultados mediante RLS', adminError?.message);
}

async function testBackendVotingAndDuplicateProtection() {
  await resetRateLimit();
  const { data: verification, error: verifyError } = await backendVerify(fixture.dnis.vote);
  assert(!verifyError && verification?.[0]?.puede_votar === true, 'backend verifica votante usando wrapper con límite', verifyError?.message);
  assert(verification?.[0]?.nombre === `Estudiante de prueba ${runId}`, 'wrapper devuelve solo el resultado esperado del flujo de verificación');

  const { error: voteError } = await backendVote(fixture.dnis.vote, fixture.candidateId);
  assert(!voteError, 'backend registra voto usando wrapper con límite', voteError?.message);

  const { error: duplicateError } = await backendVote(fixture.dnis.vote, fixture.candidateId);
  assert(Boolean(duplicateError) && duplicateError?.code === 'P0004', 'backend rechaza un segundo voto para el mismo DNI', duplicateError?.message);

  const { data: voter } = await backend.from('votantes').select('ha_votado').eq('dni', fixture.dnis.vote).single();
  const { data: votes } = await backend.from('votos').select('*').eq('mesa_id', fixture.mesaId);
  assert(voter?.ha_votado === true && votes?.length === 1, 'un solo registro de voto y votante marcado');
  assert(!Object.hasOwn(votes?.[0] ?? {}, 'dni'), 'el registro de voto no contiene DNI');
}

async function testConcurrentDuplicateVote() {
  await resetRateLimit();
  await backend.from('votos').delete().eq('mesa_id', fixture.mesaId);
  await backend.from('votantes').update({ ha_votado: false }).eq('dni', fixture.dnis.concurrent);
  const requests = [
    backendVote(fixture.dnis.concurrent, fixture.candidateId, testIp(1)),
    backendVote(fixture.dnis.concurrent, fixture.candidateId, testIp(1)),
  ];
  const [first, second] = await Promise.all(requests);
  const errors = [first.error, second.error].filter(Boolean);
  const successes = [first.error, second.error].filter(error => !error);
  assert(errors.length === 1 && successes.length === 1, 'votos simultáneos: exactamente una llamada aceptada');

  const { data: voter } = await backend.from('votantes').select('ha_votado').eq('dni', fixture.dnis.concurrent).single();
  const { data: votes } = await backend.from('votos').select('id').eq('mesa_id', fixture.mesaId);
  assert(voter?.ha_votado === true && votes?.length === 1, 'votos simultáneos: persiste un único voto');
}

async function testRateLimit() {
  await resetRateLimit();
  const attempts = [];
  for (let index = 0; index < 6; index++) {
    attempts.push(await backendVerify(fixture.dnis.alreadyVoted, testIp(2)));
  }
  assert(attempts.slice(0, 5).every(result => !result.error), 'rate limit permite los primeros cinco intentos de verificación');
  assert(attempts[5].data?.[0]?.rate_limited === true, 'rate limit bloquea el siguiente intento por DNI');

  await resetRateLimit();
  const { error: closedError } = await backend.from('configuracion')
    .update({ eleccion_abierta: false }).eq('id', 1);
  assert(!closedError, 'setup: cierra elección para prueba');
  const closedVote = await backendVote(fixture.dnis.unused, fixture.candidateId, testIp(3));
  assert(closedVote.error?.code === 'P0003', 'wrapper rechaza el voto con elección cerrada', closedVote.error?.message);

  await backend.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);
  await resetRateLimit();
  const inactiveVote = await backendVote(fixture.dnis.unused, fixture.inactiveCandidateId, testIp(4));
  assert(inactiveVote.error?.code === 'P0005', 'wrapper rechaza candidato inactivo', inactiveVote.error?.message);
}

async function cleanup() {
  if (fixture) {
    const { error: voteError } = await backend.from('votos').delete().eq('mesa_id', fixture.mesaId);
    if (voteError) console.error(`No se pudieron limpiar votos de prueba: ${voteError.message}`);
    const { error: voterError } = await backend.from('votantes').delete().in('dni', Object.values(fixture.dnis));
    if (voterError) console.error(`No se pudieron limpiar votantes de prueba: ${voterError.message}`);
    const { error: candidateError } = await backend.from('candidatos').delete().in('id', fixture.candidateIds);
    if (candidateError) console.error(`No se pudieron limpiar candidatos de prueba: ${candidateError.message}`);
    const { error: mesaError } = await backend.from('mesas').delete().eq('id', fixture.mesaId);
    if (mesaError) console.error(`No se pudo limpiar mesa de prueba: ${mesaError.message}`);
    const { error: rateLimitError } = await backend.from('rate_limit_intentos')
      .delete().in('dni_hash', Object.values(fixture.dnis).map(hashDni));
    if (rateLimitError) console.error(`No se pudieron limpiar límites de prueba: ${rateLimitError.message}`);
  }
  if (originalElectionOpen !== undefined) {
    const { error } = await backend.from('configuracion')
      .update({ eleccion_abierta: originalElectionOpen }).eq('id', 1);
    if (error) console.error(`No se pudo restaurar configuración: ${error.message}`);
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
    await setupTestData();

    await testDirectRpcBlocked();
    await testAdminAndNonAdminAuthorization();
    await testResultsView();
    await testBackendVotingAndDuplicateProtection();
    await testConcurrentDuplicateVote();
    await testRateLimit();
  } catch (error) {
    failed++;
    console.error(`ERROR de ejecución de pruebas: ${error.message}`);
  } finally {
    await cleanup();
  }

  console.log(`\nResultados reales: ${passed} aprobadas, ${failed} fallidas`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runAllTests();
