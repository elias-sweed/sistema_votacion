// Validación de variables de entorno al arrancar.
// Si faltan, la app muestra una pantalla de configuración en lugar de
// fallar con errores crípticos de Supabase.

const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const PROBLEMAS_ENTORNO: string[] = []

if (!url) {
  PROBLEMAS_ENTORNO.push('Falta VITE_SUPABASE_URL.')
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  PROBLEMAS_ENTORNO.push('VITE_SUPABASE_URL no tiene el formato https://<proyecto>.supabase.co.')
}

if (!anonKey) {
  PROBLEMAS_ENTORNO.push('Falta VITE_SUPABASE_ANON_KEY.')
}

export const ENTORNO_VALIDO = PROBLEMAS_ENTORNO.length === 0

// Valores de relleno para permitir que el módulo cargue y se muestre el
// error de configuración sin lanzar una excepción en tiempo de importación.
export const SUPABASE_URL = url || 'https://configuracion-invalida.supabase.co'
export const SUPABASE_ANON_KEY = anonKey || 'configuracion-invalida'
