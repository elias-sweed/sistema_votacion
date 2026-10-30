import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import GradientASCIIBackground from './components/ui/GradientASCIIBackground'
import { ToastProvider } from './components/ui/ToastProvider'
import LoginPage from './features/auth/LoginPage'
import PanelPage from './features/panel/PanelPage'
import VotingKioskPage from './features/voting/VotingKioskPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const esAdmin = session?.user.app_metadata?.role === 'admin'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

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
              <Route path="/login" element={esAdmin ? <Navigate to="/" replace /> : session ? <Navigate to="/votar" replace /> : <LoginPage />} />
              <Route path="/" element={esAdmin ? <PanelPage /> : <Navigate to={session ? '/votar' : '/login'} replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        )}
      </div>
    </ToastProvider>
  )
}
