// Verifica que la Edge Function voting-proxy esté desplegada y respondiendo
// en el proyecto remoto de Supabase.
//
// Uso desde webapp/:
//   npm run verify:prod
//
// Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY desde .env (o del entorno).
// No requiere claves de servicio ni tokens: usa la anon key, igual que el kiosco.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function cargarEnv(ruta) {
  const valores = {}
  if (!existsSync(ruta)) return valores

  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const separador = limpia.indexOf('=')
    if (separador === -1) continue
    const clave = limpia.slice(0, separador).trim()
    let valor = limpia.slice(separador + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    valores[clave] = valor
  }

  return valores
}

const env = { ...cargarEnv(resolve(process.cwd(), '.env')), ...process.env }
const url = String(env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? '')

if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.')
  process.exit(1)
}

const endpoint = `${url}/functions/v1/voting-proxy`
console.log(`Consultando ${endpoint} ...`)

let respuesta
try {
  respuesta = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'estado' })
  })
} catch (error) {
  console.error(`No se pudo conectar: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

const texto = await respuesta.text()
let cuerpo = null
try {
  cuerpo = JSON.parse(texto)
} catch {
  // La respuesta no es JSON (por ejemplo, un 404 HTML del gateway).
}

if (!respuesta.ok) {
  console.error(`Fallo HTTP ${respuesta.status} ${respuesta.statusText}`)
  if (respuesta.status === 404) {
    console.error('La función no existe o no está desplegada. Ejecuta: npm run deploy:function')
  } else if (respuesta.status === 401 || respuesta.status === 403) {
    console.error('El gateway rechazó la petición. Despliega con --no-verify-jwt o revisa la anon key.')
  } else {
    console.error(texto.slice(0, 500))
  }
  process.exit(1)
}

if (
  !cuerpo ||
  typeof cuerpo.eleccion_abierta !== 'boolean' ||
  typeof cuerpo.titulo !== 'string'
) {
  console.error('La función respondió, pero el formato no es el esperado:', texto.slice(0, 500))
  process.exit(1)
}

console.log('OK: voting-proxy está desplegada y responde correctamente.')
console.log(`  eleccion_abierta: ${cuerpo.eleccion_abierta}`)
console.log(`  titulo: ${cuerpo.titulo}`)
