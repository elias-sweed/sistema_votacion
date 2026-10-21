#!/usr/bin/env node
// ============================================================
// PRUEBAS FASE 2: MESAS Y PADRÓN ELECTORAL
// ============================================================
// Ejecutar contra Supabase local (supabase start)
// Requiere: migraciones 001 y 002 aplicadas
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
  console.log('\n📋 Configurando datos de prueba Fase 2...');

  // Limpiar tablas (orden por FK)
  await admin.from('votos').delete().neq('id', 0);
  await admin.from('votantes').delete().neq('dni', '');
  await admin.from('candidatos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('mesas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('configuracion').update({ eleccion_abierta: false }).eq('id', 1);

  // Crear mesas
  const { data: mesas, error: mesaErr } = await admin
    .from('mesas')
    .insert([
      { nombre: '3ro Primaria A', activo: true },
      { nombre: '3ro Primaria B', activo: true },
      { nombre: '4to Primaria A', activo: false }, // Inactiva
    ])
    .select();
  assert(!mesaErr, 'Setup: Crear mesas', mesaErr?.message);

  // Crear votantes de prueba
  const votantes = [
    { dni: '12345678', nombre: 'Ana Pérez', mesa_id: mesas[0].id, ha_votado: false },
    { dni: '87654321', nombre: 'Carlos López', mesa_id: mesas[0].id, ha_votado: true },
    { dni: '11111111', nombre: 'María García', mesa_id: mesas[1].id, ha_votado: false },
    { dni: '22222222', nombre: 'Pedro Ruiz', mesa_id: mesas[1].id, ha_votado: false },
  ];
  const { error: votErr } = await admin.from('votantes').insert(votantes);
  assert(!votErr, 'Setup: Crear votantes', votErr?.message);

  // Configuración
  await admin.from('configuracion').update({ eleccion_abierta: true }).eq('id', 1);

  return { mesas };
}

async function testMesasCRUD() {
  console.log('\n🧪 PRUEBA: Mesas CRUD');

  // Listar mesas (admin)
  const { data: list, error: listErr } = await admin.from('mesas').select('*').order('nombre');
  assert(!listErr, 'Mesas: listar', listErr?.message);
  assert(list?.length === 3, 'Mesas: 3 mesas creadas');

  // Crear mesa
  const { data: newMesa, error: createErr } = await admin.from('mesas')
    .insert({ nombre: '5to Primaria A', activo: true }).select().single();
  assert(!createErr, 'Mesas: crear', createErr?.message);
  assert(newMesa?.activo === true, 'Mesas: nueva mesa activa por defecto');

  // Editar mesa
  const { error: updateErr } = await admin.from('mesas')
    .update({ nombre: '5to Primaria B' }).eq('id', newMesa.id);
  assert(!updateErr, 'Mesas: editar', updateErr?.message);

  // Desactivar mesa
  const { error: deactErr } = await admin.from('mesas')
    .update({ activo: false }).eq('id', newMesa.id);
  assert(!deactErr, 'Mesas: desactivar', deactErr?.message);

  // Verificar que mesa inactiva no aparece en select activo
  const { data: activas } = await admin.from('mesas').select('*').eq('activo', true);
  assert(!activas?.find(m => m.id === newMesa.id), 'Mesas: inactiva no listada en activas');

  // Volver a activar
  await admin.from('mesas').update({ activo: true }).eq('id', newMesa.id);
}

async function testMesasValidacion() {
  console.log('\n🧪 PRUEBA: Mesas validaciones');

  // Nombre duplicado
  const { error: dupErr } = await admin.from('mesas')
    .insert({ nombre: '3ro Primaria A', activo: true });
  assert(dupErr, 'Mesas: rechaza nombre duplicado', dupErr?.message);
  assert(dupErr?.code === '23505', 'Mesas: error unique_violation');
}

async function testEstadisticasPadron() {
  console.log('\n🧪 PRUEBA: Estadísticas padrón');

  const { data, error } = await admin.rpc('obtener_estadisticas_padron');
  assert(!error, 'Estadisticas: RPC ejecutada', error?.message);
  assert(data?.[0]?.total_votantes === 4, 'Estadisticas: total 4 votantes');
  assert(data?.[0]?.total_votaron === 1, 'Estadisticas: 1 votó');
  assert(data?.[0]?.total_pendientes === 3, 'Estadisticas: 3 pendientes');
  assert(data?.[0]?.participacion_pct === 25, 'Estadisticas: 25% participación');
  assert(data?.[0]?.por_mesa?.length === 2, 'Estadisticas: 2 mesas activas');
}

async function testListarVotantesFiltros() {
  console.log('\n🧪 PRUEBA: Listar votantes con filtros');

  // Sin filtros
  const { data: all, error: allErr } = await admin.rpc('listar_votantes', {
    p_limit: 50, p_offset: 0
  });
  assert(!allErr, 'Listar: sin filtros', allErr?.message);
  assert(all?.length === 4, 'Listar: 4 votantes totales');

  // Filtrar por mesa
  const mesaId = (await admin.from('mesas').select('id').eq('nombre', '3ro Primaria A').single()).data.id;
  const { data: porMesa, error: mesaErr } = await admin.rpc('listar_votantes', {
    p_mesa_id: mesaId, p_limit: 50, p_offset: 0
  });
  assert(!mesaErr, 'Listar: por mesa', mesaErr?.message);
  assert(porMesa?.length === 2, 'Listar: 2 votantes en mesa');

  // Solo pendientes
  const { data: pendientes, error: pendErr } = await admin.rpc('listar_votantes', {
    p_solo_pendientes: true, p_limit: 50, p_offset: 0
  });
  assert(!pendErr, 'Listar: solo pendientes', pendErr?.message);
  assert(pendientes?.length === 3, 'Listar: 3 pendientes');

  // Búsqueda por DNI
  const { data: search, error: searchErr } = await admin.rpc('listar_votantes', {
    p_busqueda: '12345678', p_limit: 50, p_offset: 0
  });
  assert(!searchErr, 'Listar: búsqueda DNI', searchErr?.message);
  assert(search?.length === 1, 'Listar: 1 resultado búsqueda');
  assert(search?.[0]?.nombre === 'Ana Pérez', 'Listar: nombre correcto');

  // Búsqueda por nombre
  const { data: search2 } = await admin.rpc('listar_votantes', {
    p_busqueda: 'Carlos', p_limit: 50, p_offset: 0
  });
  assert(search2?.length === 1, 'Listar: búsqueda por nombre');
}

async function testValidarImportacion() {
  console.log('\n🧪 PRUEBA: Validar importación (preview)');

  const mesaId = (await admin.from('mesas').select('id').eq('nombre', '3ro Primaria A').single()).data.id;

  // Datos válidos
  const validos = [
    { dni: '33333333', nombre: 'Luis Torres', mesa_id: mesaId },
    { dni: '44444444', nombre: 'Sofia Vargas', mesa_id: mesaId },
  ];

  const { data, error } = await admin.rpc('validar_importacion_votantes', {
    p_votantes: validos
  });
  assert(!error, 'Validar: datos válidos', error?.message);
  assert(data?.[0]?.validos === 2, 'Validar: 2 válidos');
  assert(data?.[0]?.invalidos === 0, 'Validar: 0 inválidos');

  // DNI duplicado
  const conDuplicado = [
    { dni: '12345678', nombre: 'Ana Pérez', mesa_id: mesaId }, // Ya existe
    { dni: '55555555', nombre: 'Nuevo Alumno', mesa_id: mesaId },
  ];
  const { data: dupData } = await admin.rpc('validar_importacion_votantes', {
    p_votantes: conDuplicado
  });
  assert(dupData?.[0]?.validos === 1, 'Validar: 1 válido (el nuevo)');
  assert(dupData?.[0]?.invalidos === 1, 'Validar: 1 inválido (duplicado)');

  // DNI inválido
  const dniInvalido = [
    { dni: 'abc', nombre: 'Test', mesa_id: mesaId },
  ];
  const { data: invData } = await admin.rpc('validar_importacion_votantes', {
    p_votantes: dniInvalido
  });
  assert(invData?.[0]?.invalidos === 1, 'Validar: DNI inválido rechazado');

  // Mesa inválida
  const mesaInvalida = [
    { dni: '66666666', nombre: 'Test', mesa_id: '00000000-0000-0000-0000-000000000000' },
  ];
  const { data: mesaInvData } = await admin.rpc('validar_importacion_votantes', {
    p_votantes: mesaInvalida
  });
  assert(mesaInvData?.[0]?.invalidos === 1, 'Validar: Mesa inválida rechazada');

  // Nombre vacío
  const sinNombre = [
    { dni: '77777777', nombre: '', mesa_id: mesaId },
  ];
  const { data: nomData } = await admin.rpc('validar_importacion_votantes', {
    p_votantes: sinNombre
  });
  assert(nomData?.[0]?.invalidos === 1, 'Validar: Nombre vacío rechazado');
}

async function testImportarVotantes() {
  console.log('\n🧪 PRUEBA: Importar votantes (bulk insert)');

  const mesaId = (await admin.from('mesas').select('id').eq('nombre', '3ro Primaria A').single()).data.id;

  // Importar nuevos
  const nuevos = [
    { dni: '88888888', nombre: 'Importado Uno', mesa_id: mesaId },
    { dni: '99999999', nombre: 'Importado Dos', mesa_id: mesaId },
  ];
  const { data, error } = await admin.rpc('importar_votantes', {
    p_votantes: nuevos
  });
  assert(!error, 'Importar: insertar nuevos', error?.message);
  assert(data?.[0]?.insertados === 2, 'Importar: 2 insertados');
  assert(data?.[0]?.duplicados === 0, 'Importar: 0 duplicados');

  // Verificar en BD
  const { data: check } = await admin.from('votantes').select('dni').in('dni', ['88888888', '99999999']);
  assert(check?.length === 2, 'Importar: confirmados en BD');

  // Intentar duplicados
  const { data: dupImport } = await admin.rpc('importar_votantes', {
    p_votantes: nuevos
  });
  assert(dupImport?.[0]?.insertados === 0, 'Importar: 0 insertados en reintento');
  assert(dupImport?.[0]?.duplicados === 2, 'Importar: 2 duplicados detectados');

  // Mixto: válidos + duplicados + errores
  const mixto = [
    { dni: '10101010', nombre: 'Nuevo Tres', mesa_id: mesaId },
    { dni: '88888888', nombre: 'Importado Uno', mesa_id: mesaId }, // Duplicado
    { dni: 'invalid', nombre: 'Error DNI', mesa_id: mesaId }, // Error
  ];
  const { data: mixData } = await admin.rpc('importar_votantes', {
    p_votantes: mixto
  });
  assert(mixData?.[0]?.insertados === 1, 'Importar mixto: 1 insertado');
  assert(mixData?.[0]?.duplicados === 1, 'Importar mixto: 1 duplicado');
  assert((mixData?.[0]?.errores?.length ?? 0) >= 1, 'Importar mixto: al menos 1 error');
}

async function testAnonNoAccesoPadron() {
  console.log('\n🧪 PRUEBA: anon NO accede a padrón ni mesas');

  // Mesas
  const { error: e1 } = await anon.from('mesas').select('*').limit(1);
  assert(e1, 'anon: bloqueado SELECT mesas', e1?.message);

  // Votantes
  const { error: e2 } = await anon.from('votantes').select('*').limit(1);
  assert(e2, 'anon: bloqueado SELECT votantes', e2?.message);

  // RPCs de padrón
  const { error: e3 } = await anon.rpc('obtener_estadisticas_padron');
  assert(e3, 'anon: bloqueado RPC estadísticas', e3?.message);

  const { error: e4 } = await anon.rpc('listar_votantes', { p_limit: 10 });
  assert(e4, 'anon: bloqueado RPC listar', e4?.message);

  const { error: e5 } = await anon.rpc('validar_importacion_votantes', { p_votantes: [] });
  assert(e5, 'anon: bloqueado RPC validar', e5?.message);

  const { error: e6 } = await anon.rpc('importar_votantes', { p_votantes: [] });
  assert(e6, 'anon: bloqueado RPC importar', e6?.message);
}

async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS FASE 2\n');

  try {
    await setupTestData();

    await testMesasCRUD();
    await testMesasValidacion();
    await testEstadisticasPadron();
    await testListarVotantesFiltros();
    await testValidarImportacion();
    await testImportarVotantes();
    await testAnonNoAccesoPadron();

  } catch (e) {
    console.error('\n💥 Error fatal en pruebas:', e);
    failed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTADOS FASE 2: ${passed} aprobadas, ${failed} fallidas`);
  console.log('='.repeat(50));

  const fs = await import('fs');
  fs.writeFileSync('test-results-fase2.json', JSON.stringify({ passed, failed, results, timestamp: new Date().toISOString() }, null, 2));
  console.log('📄 Reporte guardado en test-results-fase2.json');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();