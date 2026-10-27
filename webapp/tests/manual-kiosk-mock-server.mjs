#!/usr/bin/env node
// Servidor de fixtures SOLO para prueba manual del kiosco en un navegador.
// No usa Supabase, no contiene secretos y no sustituye la prueba de integración
// real contra Postgres/Edge Function. Ejecutar desde webapp/:
//   node tests/manual-kiosk-mock-server.mjs
// Luego iniciar Vite con VITE_SUPABASE_URL=http://127.0.0.1:8787.

import { createServer } from 'node:http';
import { handleProxyRequest } from '../supabase/functions/voting-proxy/handler.ts';

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const TITLE = 'Elección de prueba (fixtures locales)';

const candidates = [
  { id: '11111111-1111-4111-8111-111111111111', nombre: 'Lista A', foto_url: null, activo: true },
  { id: '22222222-2222-4222-8222-222222222222', nombre: 'Lista B', foto_url: null, activo: true },
  { id: '33333333-3333-4333-8333-333333333333', nombre: 'Lista C inactiva', foto_url: null, activo: false },
];

const voters = new Map([
  ['12345678', { nombre: 'Ana Torres', haVotado: false }],
  ['22222222', { nombre: 'Luis Vega', haVotado: true }],
]);

let electionOpen = true;
let failNextVoteAfterRecord = false;
let rateLimitNextVerify = false;
let lastAction = 'ninguna';

function reset() {
  electionOpen = true;
  failNextVoteAfterRecord = false;
  rateLimitNextVerify = false;
  voters.get('12345678').haVotado = false;
  voters.get('22222222').haVotado = true;
  lastAction = 'reset';
}

function fakeSupabase() {
  return {
    from(table) {
      let result = { data: null, error: null };
      if (table === 'configuracion') {
        result = { data: { eleccion_abierta: electionOpen, titulo: TITLE }, error: null };
      } else if (table === 'candidatos') {
        result = { data: candidates.filter((candidate) => candidate.activo), error: null };
      }
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
      if (name === 'verificar_votante_con_limite') {
        lastAction = 'verificar';
        if (rateLimitNextVerify) {
          rateLimitNextVerify = false;
          return Promise.resolve({ data: [{ nombre: null, puede_votar: false, rate_limited: true }], error: null });
        }
        const voter = voters.get(params.p_dni);
        return Promise.resolve({
          data: voter
            ? [{ nombre: voter.nombre, puede_votar: !voter.haVotado, rate_limited: false }]
            : [],
          error: null,
        });
      }

      if (name === 'emitir_voto_con_limite') {
        lastAction = 'votar';
        if (!electionOpen) {
          return Promise.resolve({ data: null, error: { code: 'P0003', message: 'La elección está cerrada' } });
        }
        const voter = voters.get(params.p_dni);
        if (!voter) {
          return Promise.resolve({ data: null, error: { code: 'P0004', message: 'DNI inválido o ya votó' } });
        }
        if (voter.haVotado) {
          return Promise.resolve({ data: null, error: { code: 'P0004', message: 'DNI inválido o ya votó' } });
        }
        const candidate = candidates.find((item) => item.id === params.p_candidato_id && item.activo);
        if (!candidate) {
          return Promise.resolve({ data: null, error: { code: 'P0005', message: 'Candidato inválido o inactivo' } });
        }
        voter.haVotado = true;
        if (failNextVoteAfterRecord) {
          failNextVoteAfterRecord = false;
          return Promise.resolve({ data: null, error: { message: 'respuesta perdida simulada' } });
        }
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve({ data: null, error: { message: 'RPC no simulada' } });
    },
  };
}

function controlResponse(body) {
  return JSON.stringify(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, cors);
    res.end('ok');
    return;
  }

  if (url.pathname === '/__control/state') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(controlResponse({
      electionOpen,
      title: TITLE,
      lastAction,
      voters: [...voters].map(([dni, voter]) => ({ dniSuffix: dni.slice(-2), haVotado: voter.haVotado })),
      candidates: candidates.map(({ id, nombre, activo }) => ({ id, nombre, activo })),
    }));
    return;
  }

  if (url.pathname.startsWith('/__control/') && req.method === 'POST') {
    const action = url.pathname.slice('/__control/'.length);
    if (action === 'reset') reset();
    else if (action === 'close') electionOpen = false;
    else if (action === 'open') electionOpen = true;
    else if (action === 'rate-limit-next-verify') rateLimitNextVerify = true;
    else if (action === 'fail-next-vote-after-record') failNextVoteAfterRecord = true;
    else {
      res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
      res.end(controlResponse({ error: 'control desconocido' }));
      return;
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(controlResponse({ ok: true, action }));
    return;
  }

  if (url.pathname !== '/functions/v1/voting-proxy') {
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
    res.end(controlResponse({ error: 'ruta no encontrada' }));
    return;
  }

  const raw = req.method === 'POST' ? await readBody(req) : '';
  const proxyRequest = new Request(`http://127.0.0.1:${PORT}/functions/v1/voting-proxy`, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] ?? 'application/json',
      'x-forwarded-for': req.headers['x-forwarded-for'] ?? '127.0.0.1',
    },
    body: req.method === 'POST' ? raw : undefined,
  });

  const response = await handleProxyRequest(proxyRequest, { supabase: fakeSupabase() });
  const body = await response.text();
  const headers = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  res.writeHead(response.status, headers);
  res.end(body);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock del kiosco escuchando en http://127.0.0.1:${PORT}`);
  console.log('DNI habilitado: 12345678 (Ana Torres)');
  console.log('DNI que ya votó: 22222222 (Luis Vega)');
  console.log('Controles: /__control/reset, /close, /open, /rate-limit-next-verify, /fail-next-vote-after-record, /state');
});
