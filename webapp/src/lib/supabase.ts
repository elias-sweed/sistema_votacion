import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

// La sesión del panel se guarda en sessionStorage, no en localStorage:
// - sobrevive a recargas dentro de la misma pestaña
// - desaparece al cerrar la pestaña o el navegador
// - no se comparte entre pestañas ni queda en equipos compartidos
// Si el navegador bloquea sessionStorage, se usa memoria (se pierde al recargar).
function crearAlmacenSesion() {
  const memoria = new Map<string, string>()

  const respaldo = {
    getItem: (clave: string) => memoria.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      memoria.set(clave, valor)
    },
    removeItem: (clave: string) => {
      memoria.delete(clave)
    }
  }

  if (typeof window === 'undefined') return respaldo

  try {
    const prueba = '__sv_session_probe__'
    window.sessionStorage.setItem(prueba, '1')
    window.sessionStorage.removeItem(prueba)
    return window.sessionStorage
  } catch {
    return respaldo
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: crearAlmacenSesion(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})
