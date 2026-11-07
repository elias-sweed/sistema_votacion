import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ENTORNO_VALIDO, PROBLEMAS_ENTORNO } from './lib/env'
import { esSesionAdmin } from './lib/session'
import { limpiarCacheLegado, limpiarCachePanel } from './lib/panelCache'
import ConfigErrorPage from './components/ConfigErrorPage'
import GradientASCIIBackground from './components/ui/GradientASCIIBackground'
import { ToastProvider } from './components/ui/ToastProvider'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import LoginPage from './features/auth/LoginPage'
import PanelPage from './features/panel/PanelPage'
import VotingKioskPage from './features/voting/VotingKioskPage'

type AdminGateProps = {
  esAdmin: boolean
  session: Session | null
  children: ReactNode
}

function AdminGate({ esAdmin, session, children }: AdminGateProps) {
  if (esAdmin) return <>{children}</>
  if (session) return <AccessDeniedPage />
  return <Navigate to="/login" replace />
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  // Solo un usuario con app_metadata.role = 'admin' puede abrir el panel.
  // Cualquier otra sesión autenticada ve la pantalla de acceso denegado.
  const esAdmin = esSesionAdmin(session)

  useEffect(() => {
    limpiarCacheLegado()

    if (!ENTORNO_VALIDO) {
      setCargando(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) limpiarCachePanel()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!ENTORNO_VALIDO) return <ConfigErrorPage problemas={PROBLEMAS_ENTORNO} />


  return (
    <ToastProvider>
      <GradientASCIIBackground />
      <div className="relative z-10">
        {cargando ? (
          <main className="min-h-screen flex items-center justify-center text-slate-400">
            Cargando…
          </main>
        ) : (
          <BrowserRouter>
            <Routes>
              <Route path="/votar" element={<VotingKioskPage />} />
              <Route
                path="/login"
                element={
                  esAdmin
                    ? <Navigate to="/admin" replace />
                    : session
                      ? <AccessDeniedPage />
                      : <LoginPage />
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminGate esAdmin={esAdmin} session={session}>
                    <PanelPage />
                  </AdminGate>
                }
              />
              <Route
                path="/admin/:seccion"
                element={
                  <AdminGate esAdmin={esAdmin} session={session}>
                    <PanelPage />
                  </AdminGate>
                }
              />
              <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </BrowserRouter>
        )}
      </div>
    </ToastProvider>
  )
}
