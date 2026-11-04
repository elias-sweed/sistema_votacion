// Crea o repara el usuario administrador usando la Admin API de Supabase.
// No necesita permisos sobre auth.users en SQL: usa la service_role key.
//
// Uso en PowerShell (desde webapp/):
//   $env:SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
//   node supabase/scripts/crear_usuario.mjs
//
// Opcional:
//   $env:USER_EMAIL="otro@correo.com"
//   $env:USER_PASSWORD="OtraClave123"

const URL_BASE = process.env.SUPABASE_URL ?? 'https://msnvemicsuyaaqmwjvhi.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.USER_EMAIL ?? 'admin@admin.com'
const PASSWORD = process.env.USER_PASSWORD ?? 'Admin123456'

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  console.error('Consíguela en Supabase Dashboard -> Project Settings -> API -> service_role.')
  process.exit(1)
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
}

async function listarUsuarios() {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, { headers: HEADERS })
  if (!res.ok) throw new Error(`listar usuarios: HTTP ${res.status} ${await res.text()}`)
  const body = await res.json()
  return Array.isArray(body) ? body : (body.users ?? [])
}

async function crear() {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true })
  })
  if (!res.ok) throw new Error(`crear usuario: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

async function actualizar(id) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      ban_duration: 'none'
    })
  })
  if (!res.ok) throw new Error(`actualizar usuario: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

try {
  const usuarios = await listarUsuarios()
  const existente = usuarios.find(
    (u) => (u.email ?? '').toLowerCase() === EMAIL.toLowerCase()
  )

  if (existente) {
    await actualizar(existente.id)
    console.log('Usuario actualizado y correo confirmado.')
  } else {
    await crear()
    console.log('Usuario creado y correo confirmado.')
  }

  console.log('Correo:', EMAIL)
  console.log('Contraseña:', PASSWORD)
  console.log('Ya puedes iniciar sesión en la PWA.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
