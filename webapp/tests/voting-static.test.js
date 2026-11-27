import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { filasARegistros, parsearCSV } from '../src/lib/importarPadron.ts';

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
const mesasPage = readFileSync(new URL('../src/features/mesas/MesasPage.tsx', import.meta.url), 'utf8');
const candidatosPage = readFileSync(new URL('../src/features/candidatos/CandidatosPage.tsx', import.meta.url), 'utf8');
const flipCard = readFileSync(new URL('../src/components/ui/FlipCard.tsx', import.meta.url), 'utf8');
const chromaGrid = readFileSync(new URL('../src/components/ui/ChromaGrid.tsx', import.meta.url), 'utf8');
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
  assert.match(padronPage, /listarVotantes\(/, 'listado uses the compatibility helper');
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
  assert.match(mesasPage, /fixed inset-0 z-\[70\]/, 'the menu covers the viewport');
  assert.match(mesasPage, /bg-slate-950\/80 backdrop-blur-md/, 'the background is hidden behind a blur');
  assert.match(mesasPage, /role="dialog"\s+aria-modal="true"/, 'the actions are a modal dialog');
  assert.match(mesasPage, /'Eliminar mesa'/, 'delete is in the front menu');
  assert.match(mesasPage, /mesa\.activo \? 'Desactivar' : 'Activar'/, 'deactivate is in the front menu');
  assert.match(mesasPage, /'Editar nombre'/, 'rename is in the front menu');
  assert.match(mesasPage, /data-accion/, 'the front actions are focusable');
  assert.match(mesasPage, /evento\.key === 'Escape'/, 'Escape closes the front panel');
});

test('the candidate image preview is a FlipCard', () => {
  assert.match(candidatosPage, /from '..\/..\/components\/ui\/FlipCard'/, 'local FlipCard is imported');
  assert.match(candidatosPage, /<FlipCard[\s\S]*?front=\{/, 'the photo is on the front');
  assert.match(candidatosPage, /back=\{/, 'the candidate name is on the back');
  assert.match(candidatosPage, /axis="y"/, 'it flips on the vertical axis');
  assert.match(candidatosPage, /flipOnClick/, 'click flips the preview');
  assert.match(candidatosPage, /dragDistance=\{0\}/, 'dragging is enabled with the default distance');
  assert.match(candidatosPage, /tiltMax=\{12\}/, 'tilt uses the requested intensity');
  assert.match(candidatosPage, /glareOpacity=\{0\.22\}/, 'glare uses the requested opacity');
  assert.match(candidatosPage, /hoverScale=\{1\.03\}/, 'hover scale matches the example');
  assert.match(candidatosPage, /width=\{300\}\s+height=\{400\}/, 'card uses the example size');
  assert.match(candidatosPage, /radius=\{22\}/, 'card uses the example radius');
  assert.match(candidatosPage, /shadowOpacity=\{0\.45\}/, 'shadow matches the example');

  assert.match(flipCard, /from 'motion\/react'/, 'motion powers the animation');
  assert.match(flipCard, /useReducedMotion/, 'reduced motion is respected');
  assert.match(flipCard, /aria-pressed=\{shown\}/, 'flip state is exposed to assistive tech');
  assert.match(flipCard, /role="button"/, 'the card is keyboard reachable');
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
  assert.match(padronPage, /\['con-errores', `Datos faltantes \(\$\{previewInvalidos\}\)`\]/, 'missing-data filter shows a count');
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
  assert.match(kiosk, /h-\[58dvh\] w-auto max-w-full rounded-3xl object-contain/, 'the photo is large and fully visible');
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

test('the DNI screen header shows only the event, the school and the logo', () => {
  assert.match(kiosk, /<header className="mb-10 flex items-center justify-center gap-5 sm:gap-8">/);
  assert.match(kiosk, /\{status\?\.title \|\| 'Votación escolar'\}/, 'the event name comes first');
  assert.match(kiosk, /\{status\.centro\}/, 'the school name comes below');
  assert.match(
    kiosk,
    /font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl/,
    'both names use the same large style'
  );
  assert.match(kiosk, /alt=\{`Logo de \$\{status\.centro \|\| 'la institución educativa'\}`\}/, 'the logo sits beside them');
  assert.doesNotMatch(kiosk, /Kiosco electoral/, 'no extra label');
  assert.doesNotMatch(kiosk, /Mesa \{status\.mesa\.nombre\}/, 'no mesa badge');
  assert.doesNotMatch(kiosk, /Sigue las indicaciones en pantalla/, 'no instruction text');
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
