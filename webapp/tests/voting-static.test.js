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
const backgroundCanvas = readFileSync(
  new URL('../src/components/ui/BackgroundCanvas.tsx', import.meta.url),
  'utf8'
);
const globalBackground = readFileSync(
  new URL('../src/components/ui/FondoGlobal.tsx', import.meta.url),
  'utf8'
);
const panelPage = readFileSync(new URL('../src/features/panel/PanelPage.tsx', import.meta.url), 'utf8');
const configuracionPage = readFileSync(
  new URL('../src/features/configuracion/ConfiguracionPage.tsx', import.meta.url),
  'utf8'
);
const estilos = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const transiciones = readFileSync(
  new URL('../src/components/ui/TransicionesSuaves.tsx', import.meta.url),
  'utf8'
);
const revealSection = readFileSync(
  new URL('../src/components/ui/RevealSection.tsx', import.meta.url),
  'utf8'
);
const scrollProgress = readFileSync(
  new URL('../src/components/ui/ScrollProgress.tsx', import.meta.url),
  'utf8'
);
const dashboardPage = readFileSync(
  new URL('../src/features/dashboard/DashboardPage.tsx', import.meta.url),
  'utf8'
);
const statCard = readFileSync(new URL('../src/components/ui/StatCard.tsx', import.meta.url), 'utf8');
const navegacion = readFileSync(new URL('../src/lib/navegacion.ts', import.meta.url), 'utf8');
const padronPage = readFileSync(
  new URL('../src/features/padron/PadronPage.tsx', import.meta.url),
  'utf8'
);
const importarPadron = readFileSync(new URL('../src/lib/importarPadron.ts', import.meta.url), 'utf8');
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

test('animated background is global, decorative and never interactive', () => {
  assert.match(app, /<FondoGlobal \/>/, 'background is mounted once for every route');
  assert.match(globalBackground, /fixed inset-0/, 'background covers every section and mode');
  assert.match(backgroundCanvas, /pointer-events-none/, 'canvas never intercepts input');
  assert.doesNotMatch(
    backgroundCanvas,
    /addEventListener\(\s*['"](pointer|mouse|click|touch)/,
    'background has no pointer interaction'
  );
  assert.match(backgroundCanvas, /uTime/, 'only the background is animated');
});

test('admin panel navigation uses the dock with a switchable position', () => {
  assert.match(panelPage, /<PanelDock\s/, 'sidebar was replaced by the dock');
  assert.doesNotMatch(panelPage, /<Sidebar|components\/ui\/Sidebar/, 'old sidebar is gone');
  assert.match(panelPage, /dock-posicion/, 'position is persisted between sessions');
  assert.match(panelPage, /PADDING_DOCK\[posicionDock\]/, 'content adapts to the chosen side');
  assert.doesNotMatch(panelPage, /TopBar/, 'header was removed');
  assert.match(configuracionPage, /POSICIONES_MENU/, 'menu position is configured in Configuración');
  assert.match(configuracionPage, /onPosicionDockChange\(posicion\.value\)/, 'selector updates the dock');
});

test('section and page transitions are smooth, animated and accessibility-safe', () => {
  assert.match(app, /<TransicionesSuaves \/>/, 'transitions are mounted for every route');
  assert.match(estilos, /html\s*\{[^}]*scroll-behavior:\s*smooth/s, 'internal anchors scroll smoothly');
  assert.match(estilos, /scroll-margin-top/, 'fixed dock never covers an anchor target');
  assert.match(estilos, /main\[data-dock='top'\]/, 'top dock gets extra scroll clearance');
  assert.match(panelPage, /data-dock=\{posicionDock\}/, 'panel exposes the dock side to CSS');

  assert.match(transiciones, /a\[href\^="#"\]/, 'internal anchor clicks are handled');
  assert.match(transiciones, /scrollIntoView/, 'anchor navigation scrolls to the target');

  assert.match(revealSection, /from ['"]motion\/react['"]/, 'reveal uses installed Framer Motion');
  assert.match(revealSection, /whileInView/, 'sections reveal when they enter the viewport');
  assert.match(revealSection, /type:\s*'spring'/, 'reveal uses an Apple-like spring');
  assert.match(revealSection, /opacity:\s*0,\s*y:\s*30,\s*scale:\s*0\.985/, 'reveal animates opacity and transform only');
  assert.match(revealSection, /useReducedMotion/, 'reveal respects reduced motion');
  assert.match(frontend, /<RevealSection\s/g, 'every admin section uses the animated wrapper');
  assert.match(dashboardPage, /staggerChildren/, 'dashboard cards appear in a stagger');
  assert.match(statCard, /motion\.div/, 'stat cards are motion-driven');
  assert.match(scrollProgress, /useScroll/, 'scroll progress follows the viewport');
  assert.match(scrollProgress, /useSpring/, 'scroll progress is smoothed with a spring');
  assert.match(scrollProgress, /pointer-events-none/, 'progress bar never intercepts input');

  assert.match(estilos, /::view-transition-old\(root\)/, 'page transitions use View Transitions API');
  assert.match(navegacion, /document\.startViewTransition/, 'browser router navigations are wrapped');
  assert.match(navegacion, /flushSync/, 'new DOM is committed before capturing the transition');
  assert.match(panelPage, /useNavegarConTransicion/, 'panel uses the animated navigator');
  assert.match(estilos, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'reduced motion is respected');
  assert.match(estilos, /scroll-behavior:\s*auto/, 'reduced motion disables smooth scrolling');
  assert.match(estilos, /::view-transition-group\(\*\)/, 'reduced motion neutralizes page transitions');
});

test('padron imports Excel with six columns and manual entry uses both surnames', () => {
  assert.match(padronPage, /leerFilasPadron/, 'page uses the shared import utility');
  assert.match(padronPage, /accept="\.xlsx,\.xlsm,\.csv"/, 'file picker accepts Excel and CSV');
  assert.doesNotMatch(padronPage, /parseFile|Formato Excel no soportado/, 'old CSV-only code is gone');
  assert.match(padronPage, /id="padron-apellido-paterno"/, 'manual form asks for paternal surname');
  assert.match(padronPage, /id="padron-apellido-materno"/, 'manual form asks for maternal surname');
  assert.match(padronPage, /dividirEnLotes/, 'large files are split to respect the RPC limit');

  assert.match(importarPadron, /parsearXlsx/, 'XLSX files are parsed locally');
  assert.match(importarPadron, /DecompressionStream/, 'XLSX parsing needs no new dependency');
  assert.match(importarPadron, /apellidopaterno/, 'paternal surname header is recognized');
  assert.match(importarPadron, /apellidomaterno/, 'maternal surname header is recognized');
  assert.match(importarPadron, /normalizarDni/, 'DNI values are normalized before reaching the RPC');
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
