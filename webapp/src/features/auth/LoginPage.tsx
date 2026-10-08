import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const emailValido = EMAIL_RE.test(email)
  const passwordValido = password.length >= 6
  const formularioValido = emailValido && passwordValido

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formularioValido) {
      setError('Revisa tu correo y contraseña (mínimo 6 caracteres).')
      return
    }

    setCargando(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)

    if (authError) {
      setError('Correo o contraseña incorrectos.')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={manejarEnvio} className="w-full max-w-sm bg-slate-800 rounded-2xl p-8 space-y-5 shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center">Ingreso Admin</h1>

        <div>
          <label className="block text-sm text-slate-400 mb-1" htmlFor="email">Correo</label>
          <input
            id="email" type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white focus:outline-none focus:border-sky-500"
          />
          {email && !emailValido && <p className="text-amber-400 text-xs mt-1">Correo no válido</p>}
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1" htmlFor="password">Contraseña</label>
          <input
            id="password" type="password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit" disabled={cargando || !formularioValido}
          className="w-full rounded-lg bg-sky-600 py-2 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-500 transition"
        >
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
