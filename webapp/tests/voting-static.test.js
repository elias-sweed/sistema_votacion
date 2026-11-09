import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const frontend = sourceFiles(fileURLToPath(new URL('../src/', import.meta.url)))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const kiosk = readFileSync(new URL('../src/features/voting/VotingKioskPage.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/features/voting/votingService.ts', import.meta.url), 'utf8');
const proxyEntry = readFileSync(new URL('../supabase/functions/voting-proxy/index.ts', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../supabase/functions/voting-proxy/handler.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sessionHelper = readFileSync(new URL('../src/lib/session.ts', import.meta.url), 'utf8');
const supabaseClient = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');

test('frontend sources never include a service role key', () => {
  assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test('admin gate only accepts the app_metadata admin role', () => {
  assert.doesNotMatch(app, /const\s+esAdmin\s*=\s*session\s*!==\s*null/);
  assert.match(app, /esSesionAdmin\(session\)/);
  assert.match(sessionHelper, /app_metadata\?\.role/);
});

test('auth session is not persisted in localStorage', () => {
  assert.doesNotMatch(supabaseClient, /localStorage\s*\./);
  assert.match(supabaseClient, /sessionStorage/);
});

test('browser voting service never invokes the protected voting RPCs directly', () => {
  assert.doesNotMatch(service, /\.rpc\s*\(/);
  assert.doesNotMatch(service, /verificar_votante|emitir_voto/);
  assert.match(service, /functions\.invoke/);
  assert.doesNotMatch(service, /\.from\(['"]candidatos['"]\)/);
});

test('kiosk verifies the DNI automatically at eight digits without an identity step', () => {
  assert.match(kiosk, /dniInput\.length\s*!==\s*8/, 'auto verification waits for eight digits');
  assert.match(kiosk, /void verifyDni\(dniInput\)/, 'verification starts without a submit button');
  assert.doesNotMatch(kiosk, /setVoterName|voterName|identityConfirmed/, 'name is never kept in component state');

  const start = kiosk.indexOf('async function verifyDni(');
  const end = kiosk.indexOf('function chooseCandidate(', start);
  assert.ok(start >= 0 && end > start, 'verify handler exists');
  assert.match(kiosk.slice(start, end), /setStep\('candidates'\)/, 'eligible voter goes straight to candidates');
});

test('kiosk shows plain outcomes for already voted and unknown DNI', () => {
  assert.match(kiosk, /title: 'Ya votó'/);
  assert.match(kiosk, /title: 'No existe'/);
});

test('choosing a candidate asks for confirmation before recording the vote', () => {
  const start = kiosk.indexOf('function chooseCandidate(');
  const end = kiosk.indexOf('async function submitVote(', start);
  assert.ok(start >= 0 && end > start, 'candidate handler exists');
  const choose = kiosk.slice(start, end);
  assert.match(choose, /setStep\('confirm'\)/, 'candidate selection opens confirmation');
  assert.doesNotMatch(choose, /castVote/, 'vote is not recorded on candidate tap');
});

test('successful proxy response contains no voter or candidate identifier', () => {
  assert.match(proxy, /json\(\{ success: true \}\)/);
});

test('proxy entrypoint delegates to the shared handler without embedding secrets', () => {
  assert.match(proxyEntry, /handleProxyRequest/);
  assert.doesNotMatch(proxyEntry, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']/);
});

test('candidates action is routed independently from estado', () => {
  const estado = proxy.indexOf('if (body.action === "estado")');
  const candidates = proxy.indexOf('if (body.action === "candidatos")');
  assert.ok(estado >= 0, 'estado branch exists');
  assert.ok(candidates > estado, 'candidatos branch is a sibling after estado');
  assert.doesNotMatch(
    proxy.slice(estado, candidates),
    /body\.action === "candidatos"/,
    'candidatos is not nested inside the estado branch',
  );
});

test('proxy always returns an explicit null name for unknown voters', () => {
  assert.match(proxy, /nombre: null/);
  assert.match(service, /data\.nombre != null/);
});
