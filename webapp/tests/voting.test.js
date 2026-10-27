#!/usr/bin/env node
// Pruebas del flujo de kiosco contra Supabase local y la Edge Function desplegada localmente.

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import crypto from 'crypto';

if (existsSync('.env.test')) loadEnvFile('.env.test');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.test');
  process.exit(1);
}

if (!['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname)) {
  console.error('Seguridad: las pruebas solo se ejecutan contra Supabase local.');
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, options);
const backend = createClient(url, serviceRoleKey, options);
const runId = crypto.randomUUID();
const voterDnis = new Set();
let fixture;
let electionOriginalState;
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

async function uniqueDni() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const dni = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
    const { data, error } = await backend.from('votantes').select('dni').eq('dni', dni).maybeSingle();
    if (error) throw error;
    if (!data && !voterDnis.has(dni)) {
      voterDnis.add(dni);
      return dni;
    }
  }
  throw new Error('No se pudo generar un DNI de prueba disponible.');
}

async function callProxy(body) {
  return anon.functions.invoke('voting-proxy', { body });
}

async function responseBody(error) {
  if (!error || !('context' in error) || !(error.context instanceof Response)) return null;
  try {
    return await error.context.clone().json();
  } catch {
    return null;
  }
}

async function setup() {
  const { data: config, error: configError } = await backend.from('configuracion')
    .select('eleccion_abierta').eq('id', 1).single();
  if (configError) throw configError;
  electionOriginalState = config.eleccion_abierta;

  const { data: mesa, error: mesaError } = await backend.from('mesas')
    .insert({ nombre: `test-voting-${runId}` }).select('id').single();
  if (mesaError) throw mesaError;
  fixture = { mesaId: mesa.id, candidateIds: [], dnis: {} };

  const { data: candidates, error: candidateError } = await backend.from('candidatos').insert([
    { nombre: `Lista habilitada ${runId}`, activo: true },
    { nombre: `Lista inactiva ${runId}`, activo: false },
  ]).select('id, activo');
  if (candidateError) throw candidateError;
  fixture.candidateIds = candidates.map(candidate => candidate.id);
  fixture.candidateId = candidates.find(candidate => candidate.activo).id;
  fixture.inactiveCandidateId = candidates.find(candidate => !candidate.activo).id;
  fixture.dnis = {
    success: await uniqueDni(),
    concurrent: await uniqueDni(),
    alreadyVoted: await uniqueDni(),
    closed: await uniqueDni(),
    unknown: await uniqueDni(),
  };

  const { error: voterError } = await backend.from('votantes').insert([
    { dni: fixture.dnis.success, nombre: `Votante ${runId}`, mesa_id: mesa.id, ha_votado: false },
    { dni: fixture.dnis.concurrent, nombre: `Concurrente ${runId}`, mesa_id: mesa.id, ha_votado: false },
    { dni: fixture.dnis.alreadyVoted, nombre: `Ya votó ${runId}`, mesa_id: mesa.id, ha_votado: true },
    { dni: fixture.dnis.closed, nombre: `Elección cerrada ${runId}`, mesa_id: mesa.id, ha_votado: false },
  ]);
  if (voterError) throw voterError;

  const { error: openError } = await backend.from('configuracion')
    .update({ eleccion_abierta: true }).eq('id', 1);
  if (openError) throw openError;
}

async function testStateAndInputValidation() {
  const { data: status, error: statusError } = await callProxy({ action: 'estado' });
  assert(!statusError && status?.eleccion_abierta === true && typeof status?.titulo === 'string',
    'estado electoral consulta apertura y título sin exponer el padrón', statusError?.message);

  const candidateResponse = await callProxy({ action: 'candidatos' });
  const exposedCandidates = candidateResponse.data?.candidatos ?? [];
  assert(!candidateResponse.error && Array.isArray(exposedCandidates),
    'proxy entrega opciones electorales activas', candidateResponse.error?.message);
  assert(exposedCandidates.some(candidate => candidate.id === fixture.candidateId)
    && !exposedCandidates.some(candidate => candidate.id === fixture.inactiveCandidateId),
  'proxy excluye candidatos inactivos');
  assert(exposedCandidates.every(candidate => Object.keys(candidate).every(key => ['id', 'nombre', 'foto_url'].includes(key))),
    'proxy limita datos expuestos de candidatos a los campos de votación');

  const empty = await callProxy({ action: 'verificar', dni: '' });
  const emptyBody = await responseBody(empty.error);
  assert(Boolean(empty.error) && emptyBody?.error === 'DNI inválido', 'proxy rechaza DNI vacío');

  const invalid = await callProxy({ action: 'verificar', dni: '12A4567' });
  const invalidBody = await responseBody(invalid.error);
  assert(Boolean(invalid.error) && invalidBody?.error === 'DNI inválido', 'proxy rechaza DNI con formato inválido');

  const malformed = await callProxy({ action: 'otra-acción' });
  assert(Boolean(malformed.error), 'proxy rechaza acciones no reconocidas');
}

async function testVoterVerification() {
  const missing = await callProxy({ action: 'verificar', dni: fixture.dnis.unknown });
  assert(!missing.error && missing.data?.existe === false, 'DNI inexistente no revela datos del padrón');
  assert(!missing.data?.nombre && !missing.data?.mesa, 'verificación inexistente no devuelve nombre ni mesa');

  const alreadyVoted = await callProxy({ action: 'verificar', dni: fixture.dnis.alreadyVoted });
  assert(!alreadyVoted.error && alreadyVoted.data?.existe === true
    && alreadyVoted.data?.puede_votar === false, 'votante que ya votó no puede continuar');
  assert(!Object.hasOwn(alreadyVoted.data ?? {}, 'mesa'), 'respuesta de kiosco no expone mesa');

  const valid = await callProxy({ action: 'verificar', dni: fixture.dnis.success });
  assert(!valid.error && valid.data?.existe === true && valid.data?.puede_votar === true,
    'votante habilitado puede pasar a selección', valid.error?.message);
  assert(valid.data?.nombre === `Votante ${runId}` && !Object.hasOwn(valid.data, 'mesa'),
    'verificación devuelve solo nombre necesario para confirmar identidad');
}

async function testElectionClosed() {
  const { error } = await backend.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);
  if (error) throw error;
  const result = await callProxy({
    action: 'votar',
    dni: fixture.dnis.closed,
    candidato_id: fixture.candidateId,
  });
  const body = await responseBody(result.error);
  assert(Boolean(result.error) && body?.code === 'P0003', 'servidor rechaza voto cuando la elección está cerrada');
  await backend.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);
}

async function testSuccessfulAndDuplicateVote() {
  const first = await callProxy({
    action: 'votar',
    dni: fixture.dnis.success,
    candidato_id: fixture.candidateId,
  });
  assert(!first.error && first.data?.success === true, 'backend confirma explícitamente el voto registrado', first.error?.message);
  assert(Object.keys(first.data ?? {}).join(',') === 'success', 'respuesta exitosa no vincula identidad con selección');

  const repeated = await callProxy({
    action: 'votar',
    dni: fixture.dnis.success,
    candidato_id: fixture.candidateId,
  });
  const repeatedBody = await responseBody(repeated.error);
  assert(Boolean(repeated.error) && repeatedBody?.code === 'P0004', 'reenvío de voto se rechaza como duplicado');

  const { data: voter } = await backend.from('votantes')
    .select('ha_votado').eq('dni', fixture.dnis.success).single();
  const { data: votes } = await backend.from('votos').select('*').eq('mesa_id', fixture.mesaId);
  assert(voter?.ha_votado === true && votes?.length === 1, 'base de datos conserva exactamente un voto');
  assert(!Object.hasOwn(votes?.[0] ?? {}, 'dni'), 'registro electoral no guarda el DNI junto al voto');
}

async function testConcurrentRequests() {
  const requests = [0, 1].map(() => callProxy({
    action: 'votar',
    dni: fixture.dnis.concurrent,
    candidato_id: fixture.candidateId,
  }));
  const [first, second] = await Promise.all(requests);
  const successes = [first, second].filter(result => !result.error && result.data?.success === true);
  const errors = [first, second].filter(result => result.error);
  assert(successes.length === 1 && errors.length === 1, 'solicitudes concurrentes registran como máximo un voto');

  const { data: voter } = await backend.from('votantes')
    .select('ha_votado').eq('dni', fixture.dnis.concurrent).single();
  const { data: votes } = await backend.from('votos').select('id').eq('mesa_id', fixture.mesaId);
  assert(voter?.ha_votado === true && votes?.length === 2, 'concurrencia mantiene un voto por votante en fixtures aislados');
}

async function testRestrictedDirectRpc() {
  const verify = await anon.rpc('verificar_votante', { p_dni: fixture.dnis.unknown });
  const vote = await anon.rpc('emitir_voto', {
    p_dni: fixture.dnis.unknown,
    p_candidato_id: fixture.candidateId,
  });
  const wrapper = await anon.rpc('emitir_voto_con_limite', {
    p_dni: fixture.dnis.unknown,
    p_candidato_id: fixture.candidateId,
    p_client_ip: '198.51.100.200',
    p_dni_hash: hashDni(fixture.dnis.unknown),
  });
  assert(Boolean(verify.error), 'cliente anon no puede invocar RPC base de verificación');
  assert(Boolean(vote.error), 'cliente anon no puede invocar RPC base de voto');
  assert(Boolean(wrapper.error), 'cliente anon no puede saltarse proxy llamando al wrapper');
}

async function cleanup() {
  if (!fixture) return;
  const { error: votesError } = await backend.from('votos').delete().eq('mesa_id', fixture.mesaId);
  if (votesError) console.error(`No se pudieron limpiar votos de prueba: ${votesError.message}`);
  const { error: votersError } = await backend.from('votantes').delete().in('dni', [...voterDnis]);
  if (votersError) console.error(`No se pudieron limpiar votantes de prueba: ${votersError.message}`);
  const { error: candidatesError } = await backend.from('candidatos').delete().in('id', fixture.candidateIds);
  if (candidatesError) console.error(`No se pudieron limpiar candidatos de prueba: ${candidatesError.message}`);
  const { error: mesaError } = await backend.from('mesas').delete().eq('id', fixture.mesaId);
  if (mesaError) console.error(`No se pudo limpiar mesa de prueba: ${mesaError.message}`);
  const { error: rateError } = await backend.from('rate_limit_intentos').delete()
    .in('dni_hash', [...voterDnis].map(hashDni));
  if (rateError) console.error(`No se pudieron limpiar límites de prueba: ${rateError.message}`);
  if (electionOriginalState !== undefined) {
    const { error } = await backend.from('configuracion')
      .update({ eleccion_abierta: electionOriginalState }).eq('id', 1);
    if (error) console.error(`No se pudo restaurar la apertura electoral: ${error.message}`);
  }
}

async function run() {
  try {
    await setup();
    await testStateAndInputValidation();
    await testVoterVerification();
    await testElectionClosed();
    await testSuccessfulAndDuplicateVote();
    await testConcurrentRequests();
    await testRestrictedDirectRpc();
  } catch (error) {
    failed++;
    console.error(`ERROR de ejecución de pruebas: ${error instanceof Error ? error.message : 'Error no identificado'}`);
  } finally {
    await cleanup();
  }

  console.log(`\nResultados reales del kiosco: ${passed} aprobadas, ${failed} fallidas`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run();
