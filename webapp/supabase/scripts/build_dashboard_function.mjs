// Genera un archivo único de la Edge Function para pegarlo en el editor
// web de Supabase (Dashboard > Edge Functions > Via Editor).
// Uso desde webapp/:
//   npm run build:function-dashboard

import { readFileSync, writeFileSync } from 'node:fs'

const functionsDir = new URL('../functions/voting-proxy/', import.meta.url)

const handler = readFileSync(new URL('handler.ts', functionsDir), 'utf8')
const entry = readFileSync(new URL('index.ts', functionsDir), 'utf8')

const imports = entry
  .split(/\r?\n/)
  .filter((line) => line.startsWith('import ') && line.includes('https://'))
  .join('\n')

const body = entry
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('import '))
  .join('\n')

const banner = [
  '// ============================================================',
  '// voting-proxy — archivo único para desplegar desde el Dashboard',
  '//',
  '// Generado automáticamente desde handler.ts + index.ts.',
  '// No editar a mano: cambia los archivos originales y regenera con',
  '//   npm run build:function-dashboard',
  '//',
  '// En Supabase: Edge Functions > Deploy a new function > Via Editor',
  '// Nombre: voting-proxy',
  '// Verify JWT: DESACTIVADO',
  '// ============================================================',
].join('\n')

const output = `${banner}\n\n${imports}\n\n${handler.trim()}\n\n${body.trim()}\n`

writeFileSync(new URL('dashboard.ts', functionsDir), output)
console.log('Generado supabase/functions/voting-proxy/dashboard.ts')
