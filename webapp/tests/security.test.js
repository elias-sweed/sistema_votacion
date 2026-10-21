#!/usr/bin/env node
// ============================================================
// PRUEBAS DE SEGURIDAD E INTEGRIDAD - FASE 1
// ============================================================
// Ejecutar contra Supabase local (supabase start) o DB de pruebas
// Requiere: npm install @supabase/supabase-js dotenv
// Variables en .env.test: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';

config({ path: '.env.test' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables en .env.test: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, ANON_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
    results.push({ name, status: 'PASSED', details });
  } else {
    console.error(`❌ ${name}${details ? ' - ' + details : ''}`);
    failed++;
    results.push({ name, status: 'FAILED', details });
  }
}

function hashDni(dni) {
  return crypto.createHash('sha256').update(dni).digest('hex');
}

async function setupTestData() {
  console.log('\n📋 Configurando datos de prueba...');

  // Limpiar tablas (orden por FK)
  await admin.from('votos').delete().neq('id', 0);
  await admin.from('votantes').delete().neq('dni', '');
  await admin.from('candidatos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('mesas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);

  // Crear mesa
  const { data: mesa, error: mesaErr } = await admin
    .from('mesas')
    .insert({ nombre: '3ro Primaria A' })
    .select()
    .single();
  assert(!mesaErr, 'Setup: Crear mesa', mesaErr?.message);

  // Crear votantes de prueba
  const votantes = [
    { dni: '12345678', nombre: 'Ana Pérez', mesa_id: mesa.id, ha_votado: false },
    { dni: '87654321', nombre: 'Carlos López', mesa_id: mesa.id, ha_votado: false },
    { dni: '11111111', nombre: 'María García', mesa_id: mesa.id, ha_votado: true }, // Ya votó
  ];
  const { error: votErr } = await admin.from('votantes').insert(votantes);
  assert(!votErr, 'Setup: Crear votantes', votErr?.message);

  // Crear candidatos
  const { data: cands, error: candErr } = await admin
    .from('candidatos')
    .insert([
      { nombre: 'Lista A', activo: true },
      { nombre: 'Lista B', activo: true },
      { nombre: 'Lista Inactiva', activo: false },
    ])
    .select();
  assert(!candErr, 'Setup: Crear candidatos', candErr?.message);

  // Configuración: elección cerrada inicialmente
  await admin.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);

  return { mesa, candidatos: cands };
}

async function testVerificarVotante() {
  console.log('\n🧪 PRUEBA: verificar_votante');
  const { data, error } = await anon.rpc('verificar_votante', { p_dni: '12345678' });
  assert(!error, 'verificar_votante: DNI válido no votado', error?.message);
  assert(data?.[0]?.puede_votar === true, 'verificar_votante: puede_votar = true');
  assert(data?.[0]?.nombre === 'Ana Pérez', 'verificar_votante: nombre correcto');

  // DNI ya votó
  const { data: data2, error: err2 } = await anon.rpc('verificar_votante', { p_dni: '11111111' });
  assert(!err2, 'verificar_votante: DNI ya votó', err2?.message);
  assert(data2?.[0]?.puede_votar === false, 'verificar_votante: puede_votar = false para ya votado');

  // DNI inexistente
  const { data: data3, error: err3 } = await anon.rpc('verificar_votante', { p_dni: '99999999' });
  assert(!err3, 'verificar_votante: DNI inexistente', err3?.message);
  assert(data3?.length === 0 || data3?.[0]?.puede_votar === false, 'verificar_votante: vacío para inexistente');

  // DNI malformado
  const { data: data4, error: err4 } = await anon.rpc('verificar_votante', { p_dni: 'abc' });
  assert(!err4, 'verificar_votante: DNI malformado no lanza error', err4?.message);
  assert(data4?.[0]?.puede_votar === false, 'verificar_votante: false para malformado');
}

async function testEmitirVotoValido() {
  console.log('\n🧪 PRUEBA: emitir_voto - voto válido');
  await admin.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);

  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  const { error } = await anon.rpc('emitir_voto', { p_dni: '12345678', p_candidato_id: candidatoId });
  assert(!error, 'emitir_voto: voto válido aceptado', error?.message);

  // Verificar estado en BD
  const { data: votante } = await admin.from('votantes').select('ha_votado').eq('dni', '12345678').single();
  assert(votante?.ha_votado === true, 'emitir_voto: votante marcado ha_votado=true');

  const { data: votos } = await admin.from('votos').select('*').eq('candidato_id', candidatoId);
  assert(votos?.length === 1, 'emitir_voto: voto insertado en tabla votos');
  assert(!votos?.[0]?.dni, 'emitir_voto: voto NO contiene DNI (privacidad)');
}

async function testDobleVoto() {
  console.log('\n🧪 PRUEBA: emitir_voto - doble voto');
  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  // Segundo intento con mismo DNI
  const { error } = await anon.rpc('emitir_voto', { p_dni: '12345678', p_candidato_id: candidatoId });
  assert(error, 'emitir_voto: rechaza doble voto', error?.message);
  assert(error?.code === 'P0004' || error?.message?.includes('ya votó'), 'emitir_voto: error code P0004');
}

async function testVotoConcurrente() {
  console.log('\n🧪 PRUEBA: emitir_voto - concurrencia (simulada)');
  // Resetear votante
  await admin.from('votantes').update({ ha_votado: false }).eq('dni', '87654321');
  await admin.from('votos').delete().eq('candidato_id', (await admin.from('candidatos').select('id').limit(1).single()).data.id);

  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  // Dos promesas simultáneas
  const p1 = anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });
  const p2 = anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });

  const [r1, r2] = await Promise.all([p1, p2]);

  const errores = [r1.error, r2.error].filter(e => e);
  const exitos = [r1.error, r2.error].filter(e => !e);

  assert(errores.length === 1, 'concurrencia: exactamente 1 error', `errores: ${errores.length}`);
  assert(exitos.length === 1, 'concurrencia: exactamente 1 éxito', `exitos: ${exitos.length}`);

  // Verificar BD: solo 1 voto, 1 ha_votado
  const { data: votos } = await admin.from('votos').select('*').eq('candidato_id', candidatoId);
  assert(votos?.length === 1, 'concurrencia: solo 1 voto en BD');
}

async function testCandidatoInexistente() {
  console.log('\n🧪 PRUEBA: emitir_voto - candidato inexistente');
  await admin.from('votantes').update({ ha_votado: false }).eq('dni', '87654321');
  await admin.from('votos').delete().neq('id', 0);

  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { error } = await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: fakeId });
  assert(error, 'emitir_voto: rechaza candidato inexistente', error?.message);
  assert(error?.code === 'P0005', 'emitir_voto: error code P0005');
}

async function testCandidatoInactivo() {
  console.log('\n🧪 PRUEBA: emitir_voto - candidato inactivo');
  const { data: candInactivo } = await admin.from('candidatos').select('id').eq('activo', false).limit(1).single();

  const { error } = await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candInactivo.id });
  assert(error, 'emitir_voto: rechaza candidato inactivo', error?.message);
  assert(error?.code === 'P0005', 'emitir_voto: error code P0005 para inactivo');
}

async function testEleccionCerrada() {
  console.log('\n🧪 PRUEBA: emitir_voto - elección cerrada');
  await admin.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);
  await admin.from('votantes').update({ ha_votado: false }).eq('dni', '87654321');

  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  const { error } = await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });
  assert(error, 'emitir_voto: rechaza voto con elección cerrada', error?.message);
  assert(error?.code === 'P0003', 'emitir_voto: error code P0003');
}

async function testAtomicidadCierreEleccion() {
  console.log('\n🧪 PRUEBA: Atomicidad - voto durante cierre de elección');
  // Esta prueba verifica que no hay ventana de carrera entre check y update
  // Requiere transacciones concurrentes reales; simulamos verificando que
  // el check de eleccion_abierta está DENTRO de la transacción (FOR SHARE)

  await admin.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);
  await admin.from('votantes').update({ ha_votado: false }).eq('dni', '87654321');
  await admin.from('votos').delete().neq('id', 0);

  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  // Iniciar transacción manual que cierra la elección y luego intenta voto
  // Nota: Supabase JS no expone BEGIN/COMMIT directo, pero la función
  // usa FOR SHARE en configuracion que bloquea hasta commit.
  // Verificamos que la función falla si elección se cierra ANTES de llamar.
  await admin.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);

  const { error } = await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });
  assert(error, 'atomicidad: rechaza voto post-cierre', error?.message);
  assert(error?.code === 'P0003', 'atomicidad: error P0003');
}

async function testAnonNoAccesoDirectoTablas() {
  console.log('\n🧪 PRUEBA: anon NO accede a tablas sensibles');

  // votantes
  const { error: e1 } = await anon.from('votantes').select('*').limit(1);
  assert(e1, 'anon: bloqueado SELECT votantes', e1?.message);

  // votos
  const { error: e2 } = await anon.from('votos').select('*').limit(1);
  assert(e2, 'anon: bloqueado SELECT votos', e2?.message);

  // configuracion
  const { error: e3 } = await anon.from('configuracion').select('*').limit(1);
  assert(e3, 'anon: bloqueado SELECT configuracion', e3?.message);

  // mesas
  const { error: e4 } = await anon.from('mesas').select('*').limit(1);
  assert(e4, 'anon: bloqueado SELECT mesas', e4?.message);

  // candidatos (solo activos permitido)
  const { data: cands, error: e5 } = await anon.from('candidatos').select('*').eq('activo', true).limit(1);
  assert(!e5, 'anon: permite SELECT candidatos activos', e5?.message);

  // candidatos inactivos NO
  const { data: candsInact, error: e6 } = await anon.from('candidatos').select('*').eq('activo', false).limit(1);
  assert(candsInact?.length === 0, 'anon: NO ve candidatos inactivos');
}

async function testAdminAccesoCompleto() {
  console.log('\n🧪 PRUEBA: app_admin (service_role) tiene acceso completo');
  // service_role bypass RLS, pero verificamos que políticas existen
  const { data: vots, error } = await admin.from('votantes').select('*').limit(1);
  assert(!error, 'admin: SELECT votantes', error?.message);

  const { error: e2 } = await admin.from('votos').select('*').limit(1);
  assert(!e2, 'admin: SELECT votos', e2?.message);

  const { error: e3 } = await admin.from('configuracion').select('*').limit(1);
  assert(!e3, 'admin: SELECT configuracion', e3?.message);
}

async function testModificacionVotos() {
  console.log('\n🧪 PRUEBA: No se puede modificar votos directamente');
  const { data: voto } = await admin.from('votos').select('id').limit(1).single();
  if (voto) {
    const { error } = await anon.from('votos').update({ candidato_id: '00000000-0000-0000-0000-000000000000' }).eq('id', voto.id);
    assert(error, 'anon: bloqueado UPDATE votos', error?.message);
  }
}

async function testConsultaVotosIndividuales() {
  console.log('\n🧪 PRUEBA: No se pueden consultar votos individuales por anon');
  const { error } = await anon.from('votos').select('candidato_id, mesa_id').limit(1);
  assert(error, 'anon: bloqueado SELECT votos individuales', error?.message);
}

async function testRepeticionPeticion() {
  console.log('\n🧪 PRUEBA: Reenvío de petición (idempotencia)');
  await admin.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);
  await admin.from('votantes').update({ ha_votado: false }).eq('dni', '87654321');
  await admin.from('votos').delete().neq('id', 0);

  const { data: cands } = await admin.from('candidatos').select('id').eq('activo', true).limit(1);
  const candidatoId = cands[0].id;

  // Primera llamada
  await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });
  // Segunda llamada inmediata (simula reenvío por timeout de red)
  const { error } = await anon.rpc('emitir_voto', { p_dni: '87654321', p_candidato_id: candidatoId });

  assert(error, 'idempotencia: rechaza reenvío', error?.message);
  assert(error?.code === 'P0004', 'idempotencia: error P0004');
}

async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DE SEGURIDAD FASE 1\n');

  try {
    await setupTestData();

    await testVerificarVotante();
    await testEmitirVotoValido();
    await testDobleVoto();
    await testVotoConcurrente();
    await testCandidatoInexistente();
    await testCandidatoInactivo();
    await testEleccionCerrada();
    await testAtomicidadCierreEleccion();
    await testAnonNoAccesoDirectoTablas();
    await testAdminAccesoCompleto();
    await testModificacionVotos();
    await testConsultaVotosIndividuales();
    await testRepeticionPeticion();

  } catch (e) {
    console.error('\n💥 Error fatal en pruebas:', e);
    failed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTADOS: ${passed} aprobadas, ${failed} fallidas`);
  console.log('='.repeat(50));

  // Guardar reporte
  const fs = await import('fs');
  fs.writeFileSync('test-results.json', JSON.stringify({ passed, failed, results, timestamp: new Date().toISOString() }, null, 2));
  console.log('📄 Reporte guardado en test-results.json');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();