import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { filasARegistros, parsearCSV } from '../src/lib/importarPadron.ts';
import {
  cumpleFiltroDatos,
  dnisDuplicadosPadron,
  evaluarDatosPadron
} from '../src/lib/padronIncompleto.ts';

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
const kioskHeader = readFileSync(new URL('../src/features/voting/KioskHeader.tsx', import.meta.url), 'utf8');
const maskedHeading = readFileSync(new URL('../src/components/ui/MaskedHeading.tsx', import.meta.url), 'utf8');
const resultadosPage = readFileSync(new URL('../src/features/resultados/ResultadosPage.tsx', import.meta.url), 'utf8');
const acta = readFileSync(new URL('../src/features/resultados/ActaImprimible.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/features/voting/votingService.ts', import.meta.url), 'utf8');
const votoBlancoHelper = readFileSync(new URL('../src/lib/votoBlanco.ts', import.meta.url), 'utf8');
const migracionVotoBlanco = readFileSync(
  new URL('../supabase/migrations/019_voto_en_blanco.sql', import.meta.url),
  'utf8'
);
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
const panelDock = readFileSync(new URL('../src/components/ui/PanelDock.tsx', import.meta.url), 'utf8');
const dock = readFileSync(new URL('../src/components/ui/Dock.tsx', import.meta.url), 'utf8');
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
const padronCompat = readFileSync(new URL('../src/lib/padronCompat.ts', import.meta.url), 'utf8');
const padronIncompleto = readFileSync(new URL('../src/lib/padronIncompleto.ts', import.meta.url), 'utf8');
const migracionEdicionPadron = readFileSync(
  new URL('../supabase/migrations/020_editar_padron_auditoria.sql', import.meta.url),
  'utf8'
);
const migracionRevisionPadron = readFileSync(
  new URL('../supabase/migrations/021_padron_revision.sql', import.meta.url),
  'utf8'
);
const migracionVotoUnico = readFileSync(
  new URL('../supabase/migrations/022_fix_voto_unico.sql', import.meta.url),
  'utf8'
);
const mesasPage = readFileSync(new URL('../src/features/mesas/MesasPage.tsx', import.meta.url), 'utf8');
const candidatosPage = readFileSync(new URL('../src/features/candidatos/CandidatosPage.tsx', import.meta.url), 'utf8');
const candidatoImageField = readFileSync(new URL('../src/features/candidatos/CandidatoImageField.tsx', import.meta.url), 'utf8');
const flexCarousel = readFileSync(new URL('../src/components/ui/FlexCarousel.tsx', import.meta.url), 'utf8');
const flipCard = readFileSync(new URL('../src/components/ui/FlipCard.tsx', import.meta.url), 'utf8');
const chromaGrid = readFileSync(new URL('../src/components/ui/ChromaGrid.tsx', import.meta.url), 'utf8');
const sessionHelper = readFileSync(new URL('../src/lib/session.ts', import.meta.url), 'utf8');
const rolesHelper = readFileSync(new URL('../src/lib/roles.ts', import.meta.url), 'utf8');
const supabaseClient = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const auditoriaPage = readFileSync(
  new URL('../src/features/auditoria/AuditoriaPage.tsx', import.meta.url),
  'utf8'
);
const operadoresPage = readFileSync(
  new URL('../src/features/operadores/OperadoresPage.tsx', import.meta.url),
  'utf8'
);

test('frontend sources never include a service role key', () => {
  assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test('panel gate accepts only app_metadata admin or operador roles', () => {
  assert.doesNotMatch(app, /const\s+esAdmin\s*=\s*session\s*!==\s*null/);
  assert.match(app, /esSesionAdmin\(session\)/);
  assert.match(app, /puedeEntrarPanel\(session\)/);
  assert.match(sessionHelper, /app_metadata\?\.role/);
  assert.match(sessionHelper, /esSesionOperador/);
  assert.match(rolesHelper, /ROL_ADMIN\s*=\s*'admin'/);
  assert.match(rolesHelper, /ROL_OPERADOR\s*=\s*'operador'/);
});

test('operador is limited to candidates, padrón and read-only mesa', () => {
  assert.match(rolesHelper, /operador:\s*\['candidatos',\s*'mesas',\s*'padron'\]/);
  assert.match(panelDock, /puedeVerSeccion\(rol \?\? null, item\.vista\)/);
  assert.match(panelPage, /puedeVerSeccion\(rol, vistaSolicitada\)/);
  assert.match(mesasPage, /const soloLectura = rol === 'operador'/);
  assert.match(mesasPage, /\{!soloLectura && \(\s*<AdminButton variant="secondary" onClick=\{\(\) => setMenuAbierto\(true\)\}/);
  assert.match(candidatosPage, /const puedeEliminar = rol !== 'operador'/);
  assert.match(candidatosPage, /\{puedeEliminar && \(/);
});

test('admin dashboard shows operator movements and can toggle operator accounts', () => {
  assert.match(dashboardPage, /auditoria_operador/);
  assert.match(dashboardPage, /Últimos movimientos/);
  assert.match(auditoriaPage, /from\('auditoria_operador'\)/);
  assert.match(operadoresPage, /supabase\.rpc\('listar_operadores'\)/);
  assert.match(operadoresPage, /activar \? 'activar_operador' : 'desactivar_operador'/);
  assert.doesNotMatch(operadoresPage, /functions\.invoke/);
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
  assert.match(globalBackground, /<BackgroundCanvas\b/, 'the animated canvas is the background');
  assert.doesNotMatch(globalBackground, /<img\b/, 'no static image sits behind the animation');
  assert.doesNotMatch(frontend, /fondo\.jpg/, 'the old fondo.jpg asset is not referenced');
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

test('the dock opens iOS-style sub-actions for the padrón', () => {
  assert.match(panelDock, /menuPadron/, 'padrón has a contextual menu');
  assert.match(panelDock, /menuOnClick:\s*true/, 'tapping padrón opens its sub-actions');
  assert.match(panelDock, /label: 'Agregar manualmente'/, 'manual entry is a dock action');
  assert.match(panelDock, /label: 'Importar desde Excel'/, 'Excel import is a dock action');
  assert.match(panelDock, /label: 'Ver padrón cargado'/, 'loaded list is a dock action');
  assert.match(panelDock, /onNavigate\('padron', 'agregar'\)/, 'manual action navigates to its screen');
  assert.match(panelDock, /onNavigate\('padron', 'excel'\)/, 'Excel action navigates to its screen');
  assert.match(panelDock, /onNavigate\('padron', 'lista'\)/, 'list action navigates to its screen');
  assert.match(panelDock, /subvista/, 'dock shows the active sub-screen');
  assert.match(dock, /menuOnClick/, 'dock supports opening a menu on click');
  assert.match(dock, /if \(item\.menu\?\.length && item\.menuOnClick\)/, 'click opens the contextual menu');
});

test('the dock opens iOS-style sub-actions for configuración', () => {
  assert.match(panelDock, /menuConfiguracion/, 'configuración has a contextual menu');
  assert.match(panelDock, /label: 'General'/, 'general settings are a dock action');
  assert.match(panelDock, /label: 'Seguridad'/, 'security is a dock action');
  assert.match(panelDock, /label: 'Zona peligrosa'/, 'danger zone is a dock action');
  assert.match(panelDock, /onNavigate\('configuracion', 'general'\)/, 'general action navigates to its screen');
  assert.match(panelDock, /onNavigate\('configuracion', 'seguridad'\)/, 'security action navigates to its screen');
  assert.match(panelDock, /onNavigate\('configuracion', 'peligro'\)/, 'danger action navigates to its screen');
  assert.match(panelDock, /item\.vista === 'configuracion' \? \{ menu: menuConfiguracion, menuOnClick: true \}/, 'tapping configuración opens its sub-actions');

  assert.match(configuracionPage, /type ConfigVista = 'general' \| 'seguridad' \| 'peligro'/, 'three screens exist');
  assert.match(
    configuracionPage,
    /segmentoConfiguracion === 'seguridad' \|\| segmentoConfiguracion === 'peligro'/,
    'the URL picks the screen'
  );
  assert.match(configuracionPage, /role="tablist"/, 'the three screens can be switched');
  assert.match(configuracionPage, /pestaniaActiva === 'general'/, 'general screen is isolated');
  assert.match(configuracionPage, /pestaniaActiva === 'seguridad'/, 'security screen is isolated');
  assert.match(configuracionPage, /pestaniaActiva === 'peligro'/, 'danger screen is isolated');
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
  assert.match(app, /path="\/admin\/:seccion\/:subseccion"/, 'sub-screens such as padrón have their own route');
  assert.match(navegacion, /transicion\.finished\.catch/, 'a skipped view transition is not an unhandled rejection');
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

test('padron declares selection state before the values derived from it', () => {
  const declaracion = padronPage.indexOf('const [seleccionados, setSeleccionados]');
  const derivado = padronPage.indexOf('const todosSeleccionados');
  assert.ok(declaracion >= 0, 'selection state exists');
  assert.ok(derivado >= 0, 'derived selection value exists');
  assert.ok(declaracion < derivado, 'no temporal dead zone when a page has pending voters');
});

test('render failures are logged and shown instead of a black screen', () => {
  const boundary = readFileSync(
    new URL('../src/components/ui/ErrorBoundary.tsx', import.meta.url),
    'utf8'
  );
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /\[sistema-votacion\] Error al renderizar/);
  assert.match(boundary, /Stack de componentes/);
  assert.match(main, /<ErrorBoundary>/);
  assert.match(main, /\[sistema-votacion\] Error global/);
  assert.match(main, /\[sistema-votacion\] Promesa no manejada/);
});

test('padron works even when the remote table lacks grado and seccion columns', () => {
  assert.match(padronPage, /listarTodosVotantes\(/, 'listado uses the paginated compatibility helper');
  assert.match(padronPage, /importarLotePadron\(/, 'import uses the compatibility helper');
  assert.match(padronPage, /insertarVotantePadron\(/, 'manual entry uses the compatibility helper');
  assert.match(padronPage, /detectarColumnasPadron\(/, 'schema is detected once');
  assert.match(padronPage, /017_reparar_padron_grado_seccion\.sql/, 'warning explains how to complete the migration');
  assert.doesNotMatch(padronPage, /supabase\.rpc\('listar_votantes'/, 'no direct RPC that returns 42703');
  assert.doesNotMatch(padronPage, /supabase\.rpc\('importar_votantes'/, 'no direct RPC that inserts missing columns');
});

test('import accepts uppercase headers in the order GRADO SECCION DNI APELLIDOS NOMBRES', () => {
  const filas = filasARegistros(parsearCSV(
    'GRADO,SECCION,DNI,APELLIDO PATERNO,APELLIDO MATERNO,NOMBRES\n' +
    '1°,A,12345678,Pérez,García,Ana María'
  ));

  assert.deepEqual(filas, [
    { dni: '12345678', nombre: 'Ana María Pérez García', grado: '1°', seccion: 'A' }
  ]);
});

test('padron loads every page and can filter incomplete records', () => {
  assert.match(padronCompat, /export async function listarTodosVotantes/, 'a helper reads all pages');
  assert.match(padronCompat, /offset \+= tamano/, 'each page advances the offset');
  assert.match(padronCompat, /limit: tamano/, 'each batch respects the 200-row RPC cap');
  assert.match(padronIncompleto, /digitos\.length !== 8/, 'DNI length is checked');
  assert.match(padronIncompleto, /palabras\.length < 3/, 'missing surnames are detected');
  assert.match(padronPage, /etiqueta: 'Datos faltantes'/, 'missing-data filter is offered');
  assert.match(padronPage, /etiqueta: 'Completos'/, 'complete-data filter is offered');
  assert.match(padronPage, /etiqueta: 'Duplicados'/, 'duplicates filter is offered');
  assert.match(padronPage, /etiqueta: 'Falta grado'/, 'grade filter is offered');
  assert.match(padronPage, /etiqueta: 'Falta sección'/, 'section filter is offered');
  assert.match(padronPage, /etiqueta: 'DNI incompleto'/, 'DNI filter is offered');
  assert.match(padronPage, /etiqueta: 'Nombre incompleto'/, 'name filter is offered');
  assert.match(padronPage, /etiqueta: 'Falta apellido'/, 'surname filter is offered');
});

test('padron detects duplicate names, missing fields and complete records', () => {
  const votantes = [
    { dni: '11111111', nombre: 'Ana Pérez García', grado: '1°', seccion: 'A' },
    { dni: '22222222', nombre: 'ana perez garcia', grado: '2°', seccion: 'B' },
    { dni: '33333333', nombre: 'Luis Torres', grado: '', seccion: null }
  ];

  const duplicados = dnisDuplicadosPadron(votantes);
  assert.deepEqual([...duplicados], ['11111111', '22222222'], 'accents and case are ignored');
  assert.equal(cumpleFiltroDatos(votantes[0], 'duplicados', duplicados), true);
  assert.equal(cumpleFiltroDatos(votantes[2], 'duplicados', duplicados), false);

  const mismoDni = [
    { dni: '123456789', nombre: 'Ana Uno' },
    { dni: '123456789', nombre: 'Ana Dos' },
    { dni: '99999999', nombre: 'Otro Nombre' }
  ];
  const duplicadosPorDni = dnisDuplicadosPadron(mismoDni);
  assert.deepEqual([...duplicadosPorDni], ['123456789'], 'repeated DNI is detected too');
  assert.equal(cumpleFiltroDatos(votantes[0], 'completos'), true);
  assert.equal(cumpleFiltroDatos(votantes[2], 'completos'), false);
  assert.equal(cumpleFiltroDatos(votantes[2], 'grado'), true);
  assert.equal(cumpleFiltroDatos(votantes[2], 'seccion'), true);
  assert.equal(cumpleFiltroDatos(votantes[2], 'incompletos'), true);
  assert.deepEqual(evaluarDatosPadron(votantes[2]).motivos, [
    'Falta un apellido',
    'Falta grado',
    'Falta sección'
  ]);
});

test('padron rows have an edit button and edits are audited', () => {
  assert.match(padronPage, /import Edit02Icon/);
  assert.match(padronPage, /actualizarVotantePadron/, 'the compatibility update helper is used');
  assert.match(padronCompat, /export async function actualizarVotantePadron/);
  assert.match(padronCompat, /\.update\(registro\)\.eq\('dni', dniOriginal\)/, 'the original DNI is the key');
  assert.match(padronPage, /aria-label=\{`Editar a \$\{v\.nombre\}`\}/, 'one edit button per row');
  assert.match(padronPage, /modalId="modal-editar-votante"/, 'editing uses a modal');
  assert.match(padronPage, /editando\.ha_votado && dni !== editando\.dni/, 'voted voters keep their DNI');
  assert.match(padronPage, /Completa el apellido paterno y el apellido materno/, 'new records are complete');
  assert.match(padronPage, /Selecciona el grado del estudiante/, 'grade is required');
  assert.match(padronPage, /Selecciona la sección del estudiante/, 'section is required');
  assert.match(padronPage, /filasValidas/, 'incomplete import rows are skipped');

  assert.match(migracionEdicionPadron, /for update to authenticated[\s\S]*public\.es_admin_uuid\(\)/);
  assert.match(migracionEdicionPadron, /for update to authenticated[\s\S]*public\.es_operador\(\)/);
  assert.match(migracionEdicionPadron, /after insert or update or delete on public\.votantes/);
  assert.match(migracionEdicionPadron, /'editar', 'votante', new\.dni/);
  assert.match(migracionEdicionPadron, /before update on public\.votantes/, 'integrity trigger');
  assert.doesNotMatch(
    migracionEdicionPadron,
    /new\.ha_votado := old\.ha_votado/,
    'the panel trigger must not revert the voting RPC update'
  );
  assert.match(migracionEdicionPadron, /if old\.ha_votado then[\s\S]*new\.ha_votado := true/);
});

test('a student who already voted cannot vote again', () => {
  assert.match(service, /if \(!data\.puede_votar\) throw new VotingError\(/, 'frontend blocks a voted DNI');
  assert.match(proxy, /puede_votar: result\.puede_votar === true/);
  assert.match(proxy, /p_mesa_id: resolved\.mesa\.id/, 'vote is bound to the link mesa');
  assert.match(proxy, /emitir_voto_con_limite/, 'vote goes through the atomic RPC');

  assert.match(migracionVotoUnico, /new\.ha_votado := true/, 'voting update is preserved');
  assert.doesNotMatch(
    migracionVotoUnico,
    /new\.ha_votado := old\.ha_votado/,
    'the trigger never reopens a vote'
  );
  assert.match(migracionVotoUnico, /where dni = v_dni[\s\S]*for update/, 'row is locked for concurrency');
  assert.match(migracionVotoUnico, /if not found or v_ya_voto is true then/, 'already voted is rejected');
  assert.match(migracionVotoUnico, /v_quedo_marcado is not true/, 'persisted state is verified');
  assert.match(migracionVotoUnico, /'P0004'/, 'duplicate vote error code');
  assert.match(migracionVotoUnico, /not found or not v_conf\.eleccion_abierta/, 'no configuration means closed');
});

test('Excel import keeps every row: invalid ones go to a separate review list', () => {
  assert.match(padronCompat, /export async function listarRevisionPadron/);
  assert.match(padronCompat, /export async function insertarFilasRevision/);
  assert.match(padronCompat, /export async function actualizarFilaRevision/);
  assert.match(padronCompat, /export async function eliminarFilaRevision/);
  assert.match(padronCompat, /export async function promoverFilaRevision/);
  assert.match(padronCompat, /promover_votante_revision/, 'promotion goes through a validated RPC');

  assert.match(padronPage, /filasARevision/, 'invalid Excel rows are collected');
  assert.match(padronPage, /insertarFilasRevision\(filasARevision\)/, 'no Excel row is dropped');
  assert.match(padronPage, /previewData\.length === 0/, 'import is enabled even when every row needs review');
  assert.match(padronPage, /enRevision: true/, 'review rows are merged into the list');
  assert.match(padronPage, /Pasar al padrón a \$\{v\.nombre\}/, 'review rows can be promoted');
  assert.match(padronPage, /Descartar a \$\{v\.nombre\}/, 'review rows can be discarded');
  assert.match(padronPage, /v\.ha_votado \|\| Boolean\(v\.enRevision\)/, 'review rows cannot be bulk deleted');
  assert.match(padronPage, /El DNI debe tener exactamente 8 dígitos numéricos\./, 'manual entry stays strict');
});

test('review table accepts long and repeated DNIs without touching the real padron', () => {
  assert.match(migracionRevisionPadron, /create table if not exists public\.padron_revision/);
  assert.doesNotMatch(
    migracionRevisionPadron,
    /unique\s*\(dni\)|dni\s+text\s+primary key/,
    'review DNI is neither unique nor primary key'
  );
  assert.match(migracionRevisionPadron, /for update[\s\S]*public\.es_admin_uuid\(\)/);
  assert.match(migracionRevisionPadron, /for update[\s\S]*public\.es_operador\(\)/);
  assert.match(migracionRevisionPadron, /length\(v_dni\) <> 8/, 'promotion requires a valid DNI');
  assert.match(migracionRevisionPadron, /ya está registrado en el padrón/, 'promotion rejects duplicate DNI');
  assert.match(migracionRevisionPadron, /insert into public\.votantes/);
  assert.match(migracionRevisionPadron, /delete from public\.padron_revision where id = p_id/);
  assert.match(migracionRevisionPadron, /'importar_revision', 'votante', new\.dni/);
});

test('manual padron form matches the template fields and a template can be downloaded', () => {
  const campos = [...padronPage.matchAll(/id="(padron-(?:grado|seccion|dni|apellido-paterno|apellido-materno|nombre))"/g)]
    .map((coincidencia) => coincidencia[1]);
  assert.deepEqual(campos, [
    'padron-grado',
    'padron-seccion',
    'padron-dni',
    'padron-apellido-paterno',
    'padron-apellido-materno',
    'padron-nombre'
  ]);
  assert.match(padronPage, /<select\s+id="padron-grado"/, 'grade uses a normal select');
  assert.match(padronPage, /<select\s+id="padron-seccion"/, 'section uses a normal select');
  assert.doesNotMatch(padronPage, /<AdminSelect/, 'custom dropdown was removed from the manual form');
  assert.match(padronPage, /generarPlantillaXlsx\(\)/, 'Excel template can be downloaded');
  assert.match(padronPage, /generarPlantillaCSV\(\)/, 'CSV template can be downloaded');
  assert.match(padronPage, /Descargar plantilla Excel/);
  assert.match(padronPage, /Apellido Paterno/, 'labels match the template headers');
  assert.match(padronPage, /Apellido Materno/, 'labels match the template headers');
});

test('only one main mesa with one link is shown', () => {
  assert.match(mesasPage, /NOMBRE_PRINCIPAL = 'Mesa principal'/, 'a single main mesa exists');
  assert.match(mesasPage, /mesas\.find\(esPrincipal\) \?\? mesas\[0\] \?\? null/, 'only one mesa is selected');
  assert.match(mesasPage, /insert\(\{ nombre: NOMBRE_PRINCIPAL, activo: true \}\)/, 'creating adds just the main mesa');
  assert.doesNotMatch(mesasPage, /const GRADOS|gradoDeNombre|mesa-grado|mesa-seccion|modoAlta/, 'per-grade and grouped mesas are gone');
  assert.doesNotMatch(mesasPage, /mesas\.map\(/, 'no list of mesas is rendered');
  assert.match(mesasPage, /Un solo enlace para toda la votación/, 'the page explains the single link');
});

test('the Más menu is a front panel that covers the background', () => {
  assert.match(mesasPage, /fixed inset-0 z-(?:\[70\]|70)/, 'the menu covers the viewport');
  assert.match(mesasPage, /bg-slate-950\/80 backdrop-blur-md/, 'the background is hidden behind a blur');
  assert.match(mesasPage, /role="dialog"\s+aria-modal="true"/, 'the actions are a modal dialog');
  assert.match(mesasPage, /'Eliminar mesa'/, 'delete is in the front menu');
  assert.match(mesasPage, /mesa\.activo \? 'Desactivar' : 'Activar'/, 'deactivate is in the front menu');
  assert.match(mesasPage, /'Editar nombre'/, 'rename is in the front menu');
  assert.match(mesasPage, /data-accion/, 'the front actions are focusable');
  assert.match(mesasPage, /evento\.key === 'Escape'/, 'Escape closes the front panel');
});

test('the candidate image preview is a FlipCard', () => {
  assert.match(candidatosPage, /from '\.\/CandidatoImageField'/, 'the reusable image field is imported');
  assert.match(candidatoImageField, /from '..\/..\/components\/ui\/FlipCard'/, 'local FlipCard is imported');
  assert.match(candidatoImageField, /<FlipCard[\s\S]*?front=\{/, 'the photo is on the front');
  assert.match(candidatoImageField, /back=\{/, 'the candidate name is on the back');
  assert.match(candidatoImageField, /axis="y"/, 'it flips on the vertical axis');
  assert.match(candidatoImageField, /flipOnClick/, 'click flips the preview');
  assert.match(candidatoImageField, /dragDistance=\{0\}/, 'dragging is enabled with the default distance');
  assert.match(candidatoImageField, /tiltMax=\{12\}/, 'tilt uses the requested intensity');
  assert.match(candidatoImageField, /glareOpacity=\{0\.22\}/, 'glare uses the requested opacity');
  assert.match(candidatoImageField, /hoverScale=\{1\.03\}/, 'hover scale matches the example');
  assert.match(candidatoImageField, /width=\{400\}\s+height=\{300\}/, 'card uses a 4:3 landscape size');
  assert.match(candidatoImageField, /radius=\{22\}/, 'card uses the example radius');
  assert.match(candidatoImageField, /shadowOpacity=\{0\.45\}/, 'shadow matches the example');

  assert.match(flipCard, /from 'motion\/react'/, 'motion powers the animation');
  assert.match(flipCard, /useReducedMotion/, 'reduced motion is respected');
  assert.match(flipCard, /aria-pressed=\{shown\}/, 'flip state is exposed to assistive tech');
  assert.match(flipCard, /role="button"/, 'the card is keyboard reachable');
});

test('candidates can be browsed as Lista, Galería and Carrusel', () => {
  assert.match(candidatosPage, /type VistaCandidatos = 'lista' \| 'galeria' \| 'carrusel'/, 'three views exist');
  assert.match(candidatosPage, /etiqueta: 'Carrusel'/, 'the third tab is labelled');
  assert.match(candidatosPage, /CarouselHorizontalIcon/, 'the carousel tab has its own icon');
  assert.match(candidatosPage, /role="tablist"/, 'the views are a tab list');
  assert.match(candidatosPage, /aria-selected=\{activa\}/, 'the active view is announced');
  assert.match(candidatosPage, /from '\.\.\/\.\.\/components\/ui\/FlexCarousel'/, 'the local FlexCarousel is imported');
  assert.match(candidatosPage, /<FlexCarousel[\s\S]*?preset="liquid"/, 'the liquid preset is used');
  assert.match(candidatosPage, /intro="rise"[\s\S]*?cardHeight=\{0\.5\}/, 'the example intro and card height are used');
  assert.match(candidatosPage, /fit="landscape"/, 'the carousel uses landscape cards');
  assert.match(candidatosPage, /lensWidth=\{1\.18\}[\s\S]*?lensHeight=\{0\.74\}/, 'the lens matches landscape photos');
  assert.match(candidatosPage, /tilt=\{62\}[\s\S]*?bend=\{0\.34\}/, 'the bend matches the example');
  assert.match(candidatosPage, /curl="twist"[\s\S]*?dispersion=\{0\.45\}/, 'the curl and dispersion match the example');
  assert.match(candidatosPage, /onChange=\{\(indice\) => setCarruselIndice\(indice\)\}/, 'the focused candidate is tracked');
  assert.match(candidatosPage, /candidatos\.map\(\(c\) => \(\{[\s\S]*?title: c\.nombre,[\s\S]*?subtitle: c\.activo \? 'Activo' : 'Inactivo'/, 'candidates become carousel items');
  assert.doesNotMatch(candidatosPage, /snap-x snap-mandatory/, 'the old CSS carousel is gone');
  assert.doesNotMatch(candidatosPage, /aria-label="Candidato anterior"/, 'the old arrow buttons are gone');
});

test('FlexCarousel animates with WebGL and supports motion preferences', () => {
  assert.match(flexCarousel, /from 'ogl'/, 'ogl renders the carousel');
  assert.match(flexCarousel, /renderer\.isWebgl2/, 'WebGL2 is required');
  assert.match(flexCarousel, /prefers-reduced-motion: reduce/, 'reduced motion is respected');
  assert.match(flexCarousel, /ResizeObserver/, 'resizes are observed');
  assert.match(flexCarousel, /IntersectionObserver/, 'offscreen carousels pause');
  assert.match(flexCarousel, /document\.addEventListener\('visibilitychange'/, 'hidden tabs pause the animation');
  assert.match(flexCarousel, /role="region"/, 'the carousel is a labelled region');
  assert.match(flexCarousel, /aria-roledescription="carousel"/, 'the carousel role is exposed');
  assert.match(flexCarousel, /aria-live="polite"/, 'the active slide is announced');
  assert.match(flexCarousel, /onKeyDown/, 'keyboard navigation is included');
});

test('editing a candidate saves the name and the full image', () => {
  assert.match(candidatosPage, /setEditFoto\(c\.foto_url\)/, 'the current image is loaded into the editor');
  assert.match(candidatosPage, /foto_url: editFoto/, 'the image is part of the update');
  assert.match(candidatosPage, /id="editar-candidato-form"/, 'the full editor is a form');
  assert.match(candidatosPage, /confirmFormId="editar-candidato-form"/, 'save submits the whole form');
  assert.match(candidatosPage, /<CandidatoImageField[\s\S]*?foto=\{editFoto\}/, 'the editor uses the image field');
  assert.match(candidatosPage, /onImagen=\{procesarImagenEdicion\}/, 'the editor can replace the image');
  assert.match(candidatosPage, /onQuitar=\{quitarImagenEdicion\}/, 'the editor can remove the image');
});

test('the change and remove image buttons are below the FlipCard preview', () => {
  const preview = candidatoImageField.indexOf('<FlipCard');
  const cambiar = candidatoImageField.search(/>\s*Cambiar\s*</);
  const quitar = candidatoImageField.search(/>\s*Quitar\s*</);

  assert.ok(preview >= 0 && cambiar > preview && quitar > preview, 'both buttons come after the preview');
  assert.match(candidatoImageField, /border-t border-white\/10 pt-4/, 'the buttons are separated below the card');
  assert.doesNotMatch(candidatosPage, /onChange=\{seleccionarImagen\}/, 'the old inline uploader is gone');
});

test('the printable acta is a formal document with the I.E. logo', () => {
  assert.match(resultadosPage, /import ActaImprimible from '\.\/ActaImprimible'/, 'the acta lives in its own component');
  assert.match(resultadosPage, /<ActaImprimible[\s\S]*?titulo=\{datos\.titulo\}/, 'the election title is passed');
  assert.match(resultadosPage, /centro=\{datos\.centro\}/, 'the school name is passed');
  assert.match(resultadosPage, /resultados=\{ordenados\}/, 'the final count is passed');
  assert.match(resultadosPage, /mesas=\{mesas\}/, 'the per-table count is passed');
  assert.match(resultadosPage, /hayEmpate=\{empate\}/, 'ties are reported without a winner');
  assert.doesNotMatch(resultadosPage, /<header style=\{\{ textAlign: 'center'/, 'the old compact acta is gone');

  assert.match(acta, /import logoIE from '\.\.\/\.\.\/assets\/logo\.png'/, 'the I.E. logo is a bundled asset');
  assert.match(acta, /<img[\s\S]*?src=\{logoIE\}/, 'the logo appears in the acta');
  assert.match(acta, /Acta de resultados/, 'the document has a formal title');
  assert.match(acta, /Se deja constancia/, 'the acta opens with a direct formal statement');
  assert.match(acta, /Fecha de emisión/, 'the issue date is explicit');
  assert.match(acta, /Total de votos emitidos/, 'the total is stated');
  assert.match(acta, /Padrón electoral/, 'participation data is included');
  assert.match(acta, /Votos por mesa/, 'the per-table detail is included');
  assert.match(acta, /Firma del presidente de mesa/, 'signature lines are included');
  assert.match(acta, /Firma del secretario de mesa/, 'both authorities sign');
  assert.match(acta, /Observación[\s\S]*?empate/, 'a tie is recorded as an observation');

  assert.match(estilos, /@page[\s\S]*?size: A4/, 'the document prints on A4');
  assert.match(estilos, /print-color-adjust: exact/, 'the logo colours survive printing');
  assert.match(estilos, /break-inside: avoid/, 'rows and sections do not split across pages');
});

test('padron separates individual entry, the Excel padrón and the loaded list', () => {
  const individual = padronPage.indexOf('id="padron-dni"');
  const excel = padronPage.indexOf('id="file-input"');
  const lista = padronPage.indexOf('data-busqueda-padron');

  assert.ok(individual >= 0 && excel > individual && lista > excel, 'sections appear in that order');
  assert.match(padronPage, /type PadronVista = 'agregar' \| 'excel' \| 'lista'/, 'three screens exist');
  assert.match(padronPage, /segmentoPadron === 'excel' \|\| segmentoPadron === 'lista'/, 'the URL picks the screen');
  assert.match(padronPage, /subvista === 'agregar' &&/, 'manual screen is isolated');
  assert.match(padronPage, /subvista === 'excel' &&/, 'Excel screen is isolated');
  assert.match(padronPage, /subvista === 'lista' &&/, 'list screen is isolated');
  assert.match(padronPage, /role="tablist"/, 'the three screens can be switched');
  assert.match(padronPage, /Agregar una persona/, 'individual area is labelled');
  assert.match(padronPage, /Padrón desde Excel/, 'Excel area is labelled');
  assert.match(padronPage, /Padrón cargado/, 'loaded list area is labelled');
});

test('the Excel preview can filter rows with missing or invalid data', () => {
  assert.match(padronPage, /filtroPreview/, 'preview has its own filter state');
  assert.match(padronPage, /\['con-errores', `A revisión \(\$\{previewInvalidos\}\)`\]/, 'review filter shows a count');
  assert.match(padronPage, /setFiltroPreview\(valor\)/, 'buttons change the filter');
  assert.match(padronPage, /filasPreview\.slice\(0, 100\)/, 'the table uses filtered rows');
  assert.match(padronPage, /if \(filtroPreview === 'con-errores'\) return !item\.valido/, 'invalid rows are isolated');
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

test('candidate cards use ChromaGrid and stay full-screen with up to six visible', () => {
  assert.doesNotMatch(kiosk, /AccordionGallery/, 'the accordion was removed');
  assert.match(kiosk, /h-dvh w-full overflow-hidden text-white/, 'the step fills the viewport');
  assert.match(kiosk, /import ChromaGrid from '\.\.\/\.\.\/components\/ui\/ChromaGrid'/, 'local ChromaGrid is used');
  assert.match(kiosk, /const separacion =/, 'spacing adapts to the number of candidates');
  assert.match(kiosk, /candidates\.length <= 2\s*\? 40/, 'two cards are very separated');
  assert.match(kiosk, /candidates\.length <= 4\s*\? 24/, 'four cards have room between them');
  assert.match(kiosk, /: 12/, 'six cards use the compact gap');
  assert.match(kiosk, /columns=\{candidates\.length === 1 \? 1 : 2\}/, 'one candidate fills the row');
  assert.match(kiosk, /gap=\{separacion\}/, 'the computed gap reaches the grid');
  assert.match(kiosk, /fill\b/, 'cards fill their grid cell');
  assert.match(kiosk, /titleClassName="text-3xl font-bold text-white drop-shadow-lg sm:text-5xl"/, 'names stay large');
  assert.doesNotMatch(kiosk, /Elige a tu candidato/, 'no step title');
  assert.doesNotMatch(kiosk, /Toca para seleccionar/, 'no instructional text on the cards');
  assert.match(chromaGrid, /aria-pressed=\{onSelect \? selected : undefined\}/, 'ChromaGrid marks the tapped card');
});

test('voto en blanco is a fixed reserved option, hidden in the panel and shown in the kiosk', () => {
  assert.match(votoBlancoHelper, /import imagenVotoBlanco from '\.\.\/assets\/boto_blanco\.png'/);
  assert.match(votoBlancoHelper, /ID_VOTO_BLANCO = 'b1a0c4d2-6f1e-4c8a-9d3f-7e2a5c8b1f04'/);
  assert.match(votoBlancoHelper, /export function esVotoBlanco/);
  assert.match(votoBlancoHelper, /export function ordenarOpciones/);
  assert.match(migracionVotoBlanco, /insert into public\.candidatos/);
  assert.match(migracionVotoBlanco, /'Voto en blanco'/);
  assert.match(migracionVotoBlanco, /on conflict \(id\) do update/, 'the migration is idempotent');
  assert.match(kiosk, /if \(esVotoBlanco\(candidate\.id\)\) return IMAGEN_VOTO_BLANCO/);
  assert.match(kiosk, /setCandidates\(ordenarOpciones\(activeCandidates\)\)/, 'blank vote goes last');
  assert.match(kiosk, /candidato o voto en blanco/, 'screen reader announces the option');
  assert.match(candidatosPage, /filter\(\(c\) => !esVotoBlanco\(c\.id\)\)/);
  assert.equal((candidatosPage.match(/filter\(\(c\) => !esVotoBlanco\(c\.id\)\)/g) ?? []).length, 2, 'both cache and server lists are filtered');
});

test('selecting a card shows ElectricBorder, then the candidate photo with yes/no', () => {
  const border = readFileSync(new URL('../src/components/ui/ElectricBorder.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(kiosk, /LaserFlow/, 'the laser animation was removed');
  assert.match(kiosk, /import ElectricBorder from '\.\.\/\.\.\/components\/ui\/ElectricBorder'/, 'local ElectricBorder is used');
  assert.match(kiosk, /selectedIndex=\{indiceSeleccionado\}/, 'ChromaGrid knows which card is selected');
  assert.match(kiosk, /onSelect=\{\(indice\) => chooseCandidate\(candidates\[indice\]\.id\)\}/, 'tapping a card chooses that candidate');
  assert.match(kiosk, /selectedWrapper=\{\(children\) => \(\s*<ElectricBorder/, 'only the chosen card gets the border');
  assert.match(chromaGrid, /\{selected && selectedWrapper \? selectedWrapper\(card\) : card\}/, 'the wrapper is applied only to the selected card');
  assert.match(kiosk, /color=\"#7df9ff\"/, 'registry border color');
  assert.match(kiosk, /speed=\{1\}/, 'registry border speed');
  assert.match(kiosk, /chaos=\{0\.5\}/, 'registry border chaos');
  assert.match(kiosk, /spread=\{0\.6\}/, 'registry border spread');
  assert.match(kiosk, /strands=\{3\}/, 'registry border strands');
  assert.match(kiosk, /thickness=\{1\.5\}/, 'registry border thickness');
  assert.match(kiosk, /borderRadius=\{24\}/, 'rounded border matches the cards');
  assert.match(kiosk, /interactive=\{false\}/, 'no pointer tracking on the kiosk');
  assert.match(kiosk, /}, reduce \? 0 : 1200\)/, 'the photo follows the border highlight');
  assert.match(kiosk, /gsap\.timeline\(\)/, 'GSAP marks the selected card');
  assert.match(kiosk, /clearProps: 'transform'/, 'only cheap properties are animated');
  assert.match(kiosk, /if \(eleccionLista && step === 'confirm' && selectedCandidate\)/, 'confirmation is its own screen');
  assert.match(kiosk, /max-h-\[58dvh\] w-\[min\(90vw,900px\)\] max-w-full rounded-3xl object-contain/, 'the photo is large and fully visible');
  assert.match(kiosk, /alt=\{`Foto de \$\{selectedCandidate\.nombre\}`\}/, 'the photo has an accessible label');
  assert.doesNotMatch(kiosk, /bg-slate-950\/65 backdrop-blur-xl/, 'the blurred confirmation dialog was removed');
  assert.doesNotMatch(kiosk, /role=\"dialog\"/, 'no modal dialog remains');
  assert.match(kiosk, />\s*No, elegir otro\s*</, 'cancel is available');
  assert.match(kiosk, />\s*\{submitting \? 'Guardando…' : 'Sí, confirmar'\}\s*</, 'confirm button');
  assert.match(border, /MAX_DPR = 1\.25/, 'DPR is capped for old machines');
  assert.match(border, /PIXEL_BUDGET = 1\.2e6/, 'render surface is capped for old machines');
  assert.match(border, /if \(pointerEnabled\)/, 'unused pointer listeners are skipped');
  assert.match(border, /prefers-reduced-motion/, 'reduced motion is respected');
});

test('ChromaGrid is local and safe for a touch kiosk', () => {
  assert.match(chromaGrid, /from 'react'/, 'uses React directly, no new dependency');
  assert.match(chromaGrid, /onSelect\?:\s*\(index: number\) => void/, 'cards can be tapped');
  assert.match(chromaGrid, /selectedIndex\?:\s*number \| null/, 'selection is controlled by the kiosk');
  assert.match(chromaGrid, /if \(interactive && spotlight\) \{/, 'pointer listeners are optional');
  assert.match(chromaGrid, /prefers-reduced-motion/, 'reduced motion is respected');
  assert.match(chromaGrid, /referrerPolicy="no-referrer"/, 'candidate photos do not leak the referrer');
  assert.match(chromaGrid, /gridAutoRows: fill \? 'minmax\(0, 1fr\)' : undefined/, 'fill mode stretches the rows');
  assert.doesNotMatch(chromaGrid, /https?:\/\//, 'no remote demo photos are bundled');
});

test('a confirmed vote announces success and returns straight to the DNI', () => {
  assert.match(kiosk, />\s*Tu voto fue registrado\s*</, 'the success message is shown');
  assert.match(kiosk, /step !== 'success'\) return/, 'the auto-return only runs after success');
  assert.match(kiosk, /reduce \? 0 : 1800/, 'the message stays visible briefly');
  assert.match(kiosk, /setStep\('dni'\)/, 'the next voter enters a DNI directly');
  assert.doesNotMatch(kiosk, /Comenzar siguiente votante/, 'no extra button is needed');
});

test('the DNI header fits one screen with a video MaskedHeading, one-line names and logo', () => {
  assert.match(kiosk, /import KioskHeader from '\.\/KioskHeader'/, 'header lives in its own component');
  assert.match(kiosk, /<KioskHeader[\s\S]*?titulo=\{status\?\.title \|\| 'Votación escolar'\}/, 'event name comes first');
  assert.match(kiosk, /centro=\{status\?\.centro\}/, 'school name comes below');
  assert.match(kiosk, /logoUrl=\{status\?\.logoUrl\}/, 'logo is passed to the header');
  assert.match(kiosk, /h-dvh w-full flex-col items-center justify-center overflow-hidden/, 'the DNI screen never scrolls');
  assert.doesNotMatch(kiosk, /min-h-screen px-4 py-8/, 'the old scrollable layout is gone');

  assert.match(kioskHeader, /import MaskedHeading from '\.\.\/\.\.\/components\/ui\/MaskedHeading'/, 'masked title component is local');
  assert.match(kioskHeader, /<MaskedHeading[\s\S]*?text=\{titulo\}/, 'the event name is the masked text');
  assert.match(kioskHeader, /tag="h1"/, 'the masked title remains the main heading');
  assert.match(kioskHeader, /mediaType="video"/, 'the letters are filled by video');
  assert.match(kioskHeader, /src=\{videoTitulo\}/, 'the kiosk video fills the title');
  assert.match(kioskHeader, /playa\.mp4/, 'the video asset is imported');
  assert.match(kioskHeader, /fillScale=\{1\.25\}/);
  assert.match(kioskHeader, /parallax=\{26\}/);
  assert.match(kioskHeader, /reveal="scale"/);
  assert.match(kioskHeader, /trigger="view"/);
  assert.match(kioskHeader, /spotlight=\{false\}/);
  assert.match(kioskHeader, /outline=\{false\}/);
  assert.match(kioskHeader, /duration=\{1\.1\}/);
  assert.match(kioskHeader, /stagger=\{0\.09\}/);
  assert.match(kioskHeader, /drift=\{18\}/);
  assert.match(kioskHeader, /hoverZoom=\{0\}/);
  assert.match(kioskHeader, /align="center"/);
  assert.match(kioskHeader, /brightness=\{1\}/);
  assert.match(kioskHeader, /saturation=\{1\}/);
  assert.match(kioskHeader, /grayscale=\{false\}/);
  assert.match(kioskHeader, /outlineWidth=\{1\}/);
  assert.match(kioskHeader, /weight=\{700\}/);
  assert.match(kioskHeader, /tracking=\{-0\.03\}/);
  assert.match(kioskHeader, /lineHeight=\{1\.06\}/);
  assert.match(kioskHeader, /textScale=\{0\.115\}/);
  assert.match(kioskHeader, /singleLine/, 'the masked title stays on one line');
  assert.doesNotMatch(kioskHeader, /<video\b/, 'the video belongs to the letters, not a separate background');

  assert.match(maskedHeading, /ref=\{measureRef\} className="text-transparent"/, 'the transparent measure text remains accessible');
  assert.doesNotMatch(maskedHeading, /ref=\{measureRef\}[^\n]*aria-hidden/, 'the heading is not hidden from assistive tech');
  assert.match(maskedHeading, /clipPath/, 'the video is clipped to the glyphs');
  assert.match(maskedHeading, /<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline/, 'masked video is decorative and silent');
  assert.match(maskedHeading, /whitespace-nowrap/, 'masked titles never wrap');
  assert.match(maskedHeading, /getBoundingClientRect\(\)\.width/, 'the masked title is measured to avoid clipping');
  assert.match(maskedHeading, /ResizeObserver/, 'masked titles resize with the viewport');
  assert.match(maskedHeading, /prefers-reduced-motion/, 'video and reveal respect reduced motion');

  assert.match(kioskHeader, /measureText/, 'the I.E. name is measured to avoid clipping');
  assert.match(kioskHeader, /object-contain/, 'the logo is never cropped');
  assert.match(kioskHeader, /alt=\{`Logo de \$\{centro \|\| 'la institución educativa'\}`\}/, 'the logo stays labelled');
  assert.doesNotMatch(kioskHeader + maskedHeading, /truncate|text-ellipsis/, 'titles are never cut');
  assert.doesNotMatch(kiosk, /Kiosco electoral/, 'no extra label');
  assert.doesNotMatch(kiosk, /Mesa \{status\.mesa\.nombre\}/, 'no mesa badge');
  assert.doesNotMatch(kiosk, /Sigue las indicaciones en pantalla/, 'no instruction text');
});

test('the old fondo.jpg asset and its component are removed', () => {
  assert.throws(
    () => readFileSync(new URL('../src/assets/fondo.jpg', import.meta.url), 'utf8'),
    'fondo.jpg no longer exists'
  );
  assert.throws(
    () => readFileSync(new URL('../src/components/ui/GradientASCIIBackground.tsx', import.meta.url), 'utf8'),
    'the static background component no longer exists'
  );
});

test('the removed laser component is not bundled', () => {
  assert.throws(
    () => readFileSync(new URL('../src/components/ui/LaserFlow.tsx', import.meta.url), 'utf8'),
    'LaserFlow.tsx no longer exists'
  );
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
