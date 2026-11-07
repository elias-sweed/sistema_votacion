import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { esSesionAdmin } from '../../lib/session'

export default function AccessDeniedPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [rpcAdmin, setRpcAdmin] = useState<boolean | null>(null)
  const [rpcError, setRpcError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    void supabase
      .rpc('is_app_admin')
      .then(({ data, error }) => {
        if (error) {
          setRpcError(`${error.code ?? 'error'}: ${error.message}`)
          return
        }
        setRpcAdmin(Boolean(data))
      })
  }, [])

  const correo = session?.user.email ?? '—'
  const rolApp = session?.user.app_metadata?.role
  const rolUsuario = session?.user.user_metadata?.role

  async function volverARevisar() {
    setRevisando(true)
    setMensaje(null)
    const { data, error } = await supabase.auth.refreshSession()
    setRevisando(false)

    if (error) {
      setMensaje(`No se pudo refrescar la sesión: ${error.message}`)
      return
    }

    if (esSesionAdmin(data.session)) {
      navigate('/admin', { replace: true })
      return
    }

    setMensaje(
      'La sesión sigue sin el rol admin. Verifica que el rol esté en App Metadata (no en User Metadata) y vuelve a intentarlo.'
    )
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.12),transparent_62%)]"
      />

      <div className="relative w-full max-w-xl rounded-2xl border border-red-400/25 bg-slate-950/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 text-red-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
              <path d="M12 3l9 16H3L12 3Z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white">Acceso al panel restringido</h1>
            <p className="mt-1 text-sm text-slate-400">
              La sesión se inició correctamente, pero este usuario no tiene el rol de administrador.
              Por eso no se abrió el panel de gestión.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-slate-400">Usuario</span>
            <span className="font-medium text-slate-200">{correo}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-slate-400">app_metadata.role</span>
            <span className={rolApp === 'admin' ? 'font-medium text-emerald-300' : 'font-medium text-red-300'}>
              {rolApp === undefined || rolApp === null ? 'no definido' : String(rolApp)}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-slate-400">user_metadata.role</span>
            <span className="font-medium text-slate-300">
              {rolUsuario === undefined || rolUsuario === null ? 'no definido' : String(rolUsuario)}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-slate-400">Servidor is_app_admin()</span>
            <span className="font-medium text-slate-300">
              {rpcError ? `error: ${rpcError}` : rpcAdmin === null ? 'consultando…' : rpcAdmin ? 'true' : 'false'}
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Para habilitar el panel: en Supabase Dashboard → Authentication → Users → selecciona el
          usuario → <span className="text-slate-300">App Metadata</span> y agrega{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">{'{"role":"admin"}'}</code>.
          El rol debe estar en App Metadata; si está en User Metadata no se reconoce. Después usa
          «Volver a revisar» o cierra sesión y vuelve a ingresar.
        </p>

        {mensaje && (
          <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {mensaje}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void volverARevisar()}
            disabled={revisando}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {revisando ? 'Revisando…' : 'Volver a revisar'}
          </button>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12]"
          >
            Cerrar sesión
          </button>
          <Link
            to="/votar"
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-medium text-slate-200 transition hover:bg-white/[0.12]"
          >
            Ir al kiosco
          </Link>
        </div>
      </div>
    </main>
  )
}
