import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ENTORNO_VALIDO, PROBLEMAS_ENTORNO } from './lib/env'
import { esSesionAdmin, puedeEntrarPanel } from './lib/session'
import { limpiarCacheLegado, limpiarCachePanel } from './lib/panelCache'
import ConfigErrorPage from './components/ConfigErrorPage'
import { FondoGlobal } from './components/ui/FondoGlobal'
import { ToastProvider } from './components/ui/ToastProvider'
import { EstadoConexion } from './components/ui/EstadoConexion'
import { TransicionesSuaves } from './components/ui/TransicionesSuaves'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import LoginPage from './features/auth/LoginPage'
import PanelPage from './features/panel/PanelPage'
import VotingKioskPage from './features/voting/VotingKioskPage'

type PanelGateProps = {
  puedeEntrar: boolean
  session: Session | null
  children: ReactNode
}

function PanelGate({ puedeEntrar, session, children }: PanelGateProps) {
  if (puedeEntrar) return <>{children}</>
  if (session) return <AccessDeniedPage />
  return <Navigate to="/login" replace />
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  // admin y operador pueden abrir el panel. Cualquier otra sesión autenticada
  // ve la pantalla de acceso denegado. esSesionAdmin se mantiene para las
  // acciones exclusivas del administrador principal.
  const esAdmin = esSesionAdmin(session)
  const puedeEntrar = esAdmin || puedeEntrarPanel(session)

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

  if (!ENTORNO_VALIDO) {
    return (
      <>
        <FondoGlobal />
        <div className="relative z-10">
          <ConfigErrorPage problemas={PROBLEMAS_ENTORNO} />
        </div>
      </>
    )
  }

  return (
    <>
      <FondoGlobal />
      <ToastProvider>
        <div className="relative z-10">
          {cargando ? (
            <main className="min-h-screen flex items-center justify-center text-slate-400">
              Cargando…
            </main>
          ) : (
            <BrowserRouter>
              <TransicionesSuaves />
              <EstadoConexion />
              <Routes>
                <Route path="/votar/:token" element={<VotingKioskPage />} />
                <Route path="/votar" element={<VotingKioskPage />} />
                <Route
                  path="/login"
                  element={
                    puedeEntrar
                      ? <Navigate to="/admin" replace />
                      : session
                        ? <AccessDeniedPage />
                        : <LoginPage />
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <PanelGate puedeEntrar={puedeEntrar} session={session}>
                      <PanelPage />
                    </PanelGate>
                  }
                />
                <Route
                  path="/admin/:seccion"
                  element={
                    <PanelGate puedeEntrar={puedeEntrar} session={session}>
                      <PanelPage />
                    </PanelGate>
                  }
                />
                <Route
                  path="/admin/:seccion/:subseccion"
                  element={
                    <PanelGate puedeEntrar={puedeEntrar} session={session}>
                      <PanelPage />
                    </PanelGate>
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
    </>
  )
}
