// Aplica un archivo .sql al proyecto remoto usando la Management API de Supabase.
// Útil cuando el SQL Editor responde:
//   ERROR 42501: permission denied for schema public
// porque la Management API ejecuta la consulta con un rol con privilegios.
//
// Requiere un Personal Access Token:
//   Supabase Dashboard -> Account -> Access Tokens -> Generate new token
//
// Uso desde webapp/:
//   $env:SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxx"
//   node supabase/scripts/aplicar_sql.mjs
//
// Opcional:
//   $env:SUPABASE_PROJECT_REF="msnvemicsuyaaqmwjvhi"
//   node supabase/scripts/aplicar_sql.mjs ruta/al/archivo.sql

import { readFileSync } from 'node:fs'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF ?? 'msnvemicsuyaaqmwjvhi'
const archivo = process.argv[2]
  ? new URL(process.argv[2], `file:///${process.cwd().replace(/\\/g, '/')}/`)
  : new URL('./acceso_directo.sql', import.meta.url)

if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN.')
  console.error('Créalo en Supabase Dashboard -> Account -> Access Tokens.')
  process.exit(1)
}

const sql = readFileSync(archivo, 'utf8')

const respuesta = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  }
)

const texto = await respuesta.text()
console.log('HTTP', respuesta.status)
console.log(texto)

if (!respuesta.ok) process.exit(1)
