import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import CandidatosPage from '../candidatos/CandidatosPage'

export default function PanelPage() {
  const [vista, setVista] = useState<'candidatos'>('candidatos')

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Panel de Control</h1>
          <button onClick={() => supabase.auth.signOut()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 transition">
            Cerrar sesión
          </button>
        </div>

        <nav className="flex gap-2 mb-8">
          <button onClick={() => setVista('candidatos')}
            className="rounded-lg px-4 py-2 text-sm bg-sky-600">
            Candidatos
          </button>
        </nav>

        {vista === 'candidatos' && <CandidatosPage />}
      </div>
    </main>
  )
}
