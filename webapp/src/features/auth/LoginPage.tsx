import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/ToastProvider'
import SpotlightCard from '../../components/ui/SpotlightCard'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const toast = useToast()

  const emailValido = EMAIL_RE.test(email)
  const passwordValido = password.length >= 6
  const formularioValido = emailValido && passwordValido

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault()

    if (!formularioValido) {
      toast({
        title: 'Revisa tus datos',
        description: 'Ingresa un correo válido y una contraseña de al menos 6 caracteres.',
        variant: 'error'
      })
      return
    }

    setCargando(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)

    if (authError) {
      const credencialesInvalidas = authError.message.toLowerCase().includes('invalid login credentials')
      toast({
        title: 'No se pudo ingresar',
        description: credencialesInvalidas
          ? 'Correo o contraseña incorrectos.'
          : authError.message,
        variant: 'error',
        duration: 6000
      })
      return
    }

    toast({
      title: 'Bienvenido',
      description: 'Sesión iniciada correctamente.',
      variant: 'success',
      duration: 3000
    })
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(212,175,55,0.10),transparent_62%)]"
      />

      <div className="relative w-full max-w-sm">
        <SpotlightCard
          theme="dark"
          spotlightColor="#f0d38a"
          intensity={0.16}
          spotlightSize={320}
          softness={0.75}
          shape="circle"
          borderGlow={0.85}
          proximity={100}
          smoothing={0.28}
          grain={0.04}
          ambient={false}
          flare
          className="w-full backdrop-blur-2xl backdrop-saturate-150"
          style={
            {
              '--spotlight-card-surface': 'rgba(10, 10, 10, 0.42)',
              '--spotlight-card-border': 'rgba(232, 196, 122, 0.32)',
              '--spotlight-card-shadow':
                '0 30px 90px -30px rgba(0, 0, 0, 0.95), 0 0 70px -24px rgba(212, 175, 55, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/40 to-transparent"
          />
          <form onSubmit={manejarEnvio} className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/10 text-amber-200 shadow-[0_0_24px_-6px_rgba(234,179,8,0.5)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" strokeLinejoin="round" />
                  <path d="M9.5 12l1.8 1.8 3.4-3.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="bg-gradient-to-r from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
                Ingreso Admin
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/50">Acceso restringido</p>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-amber-100/50" htmlFor="email">
                Correo
              </label>
              <input
                id="email" type="email" value={email} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-amber-50 backdrop-blur-md placeholder:text-slate-500 transition selection:bg-amber-300/30 focus:border-amber-300/60 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-amber-400/15"
              />
              {email && !emailValido && <p className="mt-1 text-xs text-amber-400">Correo no válido</p>}
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-amber-100/50" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password" type="password" value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-amber-50 backdrop-blur-md placeholder:text-slate-500 transition selection:bg-amber-300/30 focus:border-amber-300/60 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-amber-400/15"
              />
            </div>

            <button
              type="submit" disabled={cargando}
              className="w-full rounded-xl bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 py-3 text-sm font-bold text-black shadow-[0_10px_30px_-10px_rgba(234,179,8,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </button>

            <p className="text-center text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Sistema de Votación
            </p>
          </form>
        </SpotlightCard>
      </div>
    </main>
  )
}
