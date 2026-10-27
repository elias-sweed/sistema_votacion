import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { handleProxyRequest } from '../supabase/functions/voting-proxy/handler.ts';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFakeSupabase({ config, candidates, rpc } = {}) {
  const calls = { from: [], rpc: [] };
  return {
    calls,
    from(table) {
      calls.from.push(table);
      const result = table === 'configuracion'
        ? (config ?? { data: null, error: null })
        : table === 'candidatos'
          ? (candidates ?? { data: [], error: null })
          : { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
    rpc(name, params) {
      calls.rpc.push({ name, params });
      return (rpc ?? (async () => ({ data: null, error: null })))(name, params);
    },
  };
}

function proxyRequest(body, headers = {}) {
  return new Request('http://localhost/functions/v1/voting-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '198.51.100.10',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function readJson(response) {
  return response.json();
}

test('OPTIONS responde con CORS', async () => {
  const supabase = createFakeSupabase();
  const response = await handleProxyRequest(
    new Request('http://localhost/functions/v1/voting-proxy', { method: 'OPTIONS' }),
    { supabase },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('método distinto de POST se rechaza', async () => {
  const response = await handleProxyRequest(
    new Request('http://localhost/functions/v1/voting-proxy', { method: 'GET' }),
    { supabase: createFakeSupabase() },
  );
  assert.equal(response.status, 405);
  assert.deepEqual(await readJson(response), { error: 'Método no permitido' });
});

test('JSON inválido se rechaza sin consultar la base', async () => {
  const supabase = createFakeSupabase();
  const response = await handleProxyRequest(proxyRequest('{'), { supabase });
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: 'JSON inválido' });
  assert.equal(supabase.calls.from.length, 0);
});

test('acción desconocida se rechaza', async () => {
  const response = await handleProxyRequest(proxyRequest({ action: 'otra' }), { supabase: createFakeSupabase() });
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: 'Solicitud inválida' });
});

test('estado devuelve apertura y título', async () => {
  const supabase = createFakeSupabase({
    config: { data: { eleccion_abierta: true, titulo: 'Elección de prueba' }, error: null },
  });
  const response = await handleProxyRequest(proxyRequest({ action: 'estado' }), { supabase });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    eleccion_abierta: true,
    titulo: 'Elección de prueba',
  });
});

test('estado informa configuración ausente', async () => {
  const supabase = createFakeSupabase({ config: { data: null, error: null } });
  const response = await handleProxyRequest(proxyRequest({ action: 'estado' }), { supabase });
  assert.equal(response.status, 503);
});

test('candidatos no depende del estado y filtra campos', async () => {
  const supabase = createFakeSupabase({
    candidates: {
      data: [
        { id: 'c1', nombre: 'Lista A', foto_url: 'https://example.test/a.png', activo: true },
        { id: 'c2', nombre: 'Lista B', foto_url: null },
        { id: 'sin-nombre', foto_url: null },
      ],
      error: null,
    },
  });

  const response = await handleProxyRequest(proxyRequest({ action: 'candidatos' }), { supabase });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    candidatos: [
      { id: 'c1', nombre: 'Lista A', foto_url: 'https://example.test/a.png' },
      { id: 'c2', nombre: 'Lista B', foto_url: null },
    ],
  });
  assert.deepEqual(supabase.calls.from, ['candidatos']);
});

test('candidatos devuelve error controlado si falla la consulta', async (t) => {
  t.mock.method(console, 'error', () => {});
  const supabase = createFakeSupabase({
    candidates: { data: null, error: { message: 'db caída' } },
  });
  const response = await handleProxyRequest(proxyRequest({ action: 'candidatos' }), { supabase });
  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { error: 'No se pudieron consultar las opciones electorales' });
});

test('verificar DNI existente devuelve nombre y elegibilidad', async () => {
  const supabase = createFakeSupabase({
    rpc: async () => ({
      data: [{ nombre: 'Ana Pérez', puede_votar: true, rate_limited: false }],
      error: null,
    }),
  });
  const response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '12345678' }), { supabase });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    existe: true,
    nombre: 'Ana Pérez',
    puede_votar: true,
    rate_limited: false,
  });

  const call = supabase.calls.rpc[0];
  assert.equal(call.name, 'verificar_votante_con_limite');
  assert.equal(call.params.p_dni, '12345678');
  assert.equal(call.params.p_client_ip, '198.51.100.10');
  assert.match(call.params.p_dni_hash, /^[0-9a-f]{64}$/);
  assert.equal(call.params.p_dni_hash, createHash('sha256').update('12345678').digest('hex'));
});

test('verificar DNI inexistente devuelve nombre nulo explícito', async () => {
  const supabase = createFakeSupabase({ rpc: async () => ({ data: [], error: null }) });
  const response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '87654321' }), { supabase });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    existe: false,
    nombre: null,
    puede_votar: false,
    rate_limited: false,
  });
});

test('verificar votante que ya votó y rate limit', async () => {
  const alreadyVoted = createFakeSupabase({
    rpc: async () => ({
      data: [{ nombre: 'Carlos', puede_votar: false, rate_limited: false }],
      error: null,
    }),
  });
  let response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '11111111' }), { supabase: alreadyVoted });
  assert.deepEqual(await readJson(response), {
    existe: true,
    nombre: 'Carlos',
    puede_votar: false,
    rate_limited: false,
  });

  const limited = createFakeSupabase({
    rpc: async () => ({
      data: [{ nombre: null, puede_votar: false, rate_limited: true }],
      error: null,
    }),
  });
  response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '22222222' }), { supabase: limited });
  assert.deepEqual(await readJson(response), {
    existe: false,
    nombre: null,
    puede_votar: false,
    rate_limited: true,
  });
});

test('verificar rechaza DNI con formato inválido', async () => {
  const supabase = createFakeSupabase();
  const response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '12A4567' }), { supabase });
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: 'DNI inválido' });
  assert.equal(supabase.calls.rpc.length, 0);
});

test('votar registra un único voto con el candidato recibido', async () => {
  const supabase = createFakeSupabase({ rpc: async () => ({ data: null, error: null }) });
  const candidato = '123e4567-e89b-42d3-a456-426614174000';
  const response = await handleProxyRequest(proxyRequest({ action: 'votar', dni: '12345678', candidato_id: candidato }), { supabase });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { success: true });

  const call = supabase.calls.rpc[0];
  assert.equal(call.name, 'emitir_voto_con_limite');
  assert.equal(call.params.p_dni, '12345678');
  assert.equal(call.params.p_candidato_id, candidato);
  assert.equal(call.params.p_client_ip, '198.51.100.10');
  assert.match(call.params.p_dni_hash, /^[0-9a-f]{64}$/);
});

test('votar propaga el código de elección cerrada', async (t) => {
  t.mock.method(console, 'error', () => {});
  const supabase = createFakeSupabase({
    rpc: async () => ({ data: null, error: { code: 'P0003', message: 'La elección está cerrada' } }),
  });
  const response = await handleProxyRequest(proxyRequest({
    action: 'votar',
    dni: '12345678',
    candidato_id: '123e4567-e89b-42d3-a456-426614174000',
  }), { supabase });
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: 'La elección está cerrada',
    code: 'P0003',
    confirmed: false,
  });
});

test('votar propaga voto duplicado y rate limit', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [code, expected] of [
    ['P0004', 'Este votante ya emitió su voto'],
    ['P0005', 'Candidato inválido'],
    ['P0007', 'Demasiados intentos. Espere un momento'],
  ]) {
    const supabase = createFakeSupabase({
      rpc: async () => ({ data: null, error: { code, message: 'error de prueba' } }),
    });
    const response = await handleProxyRequest(proxyRequest({
      action: 'votar',
      dni: '12345678',
      candidato_id: '123e4567-e89b-42d3-a456-426614174000',
    }), { supabase });
    const body = await readJson(response);
    assert.equal(response.status, 400);
    assert.equal(body.code, code);
    assert.equal(body.error, expected);
    assert.equal(body.confirmed, false);
  }
});

test('votar rechaza candidato que no es UUID antes de llamar a la base', async () => {
  const supabase = createFakeSupabase();
  const response = await handleProxyRequest(proxyRequest({ action: 'votar', dni: '12345678', candidato_id: 'no-uuid' }), { supabase });
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: 'Candidato inválido', code: 'P0005' });
  assert.equal(supabase.calls.rpc.length, 0);
});

test('sin cliente Supabase responde error de configuración', async (t) => {
  t.mock.method(console, 'error', () => {});
  const response = await handleProxyRequest(proxyRequest({ action: 'estado' }), { supabase: null });
  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { error: 'Error de configuración del servidor' });
});

test('una excepción inesperada se convierte en error interno', async (t) => {
  t.mock.method(console, 'error', () => {});
  const supabase = createFakeSupabase({
    rpc: async () => { throw new Error('fallo inesperado'); },
  });
  const response = await handleProxyRequest(proxyRequest({ action: 'verificar', dni: '12345678' }), { supabase });
  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { error: 'Error interno del servidor' });
});
