import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import CandidatosPage from '../candidatos/CandidatosPage'
import MesasPage from '../mesas/MesasPage'
import PadronPage from '../padron/PadronPage'

type Vista = 'candidatos' | 'mesas' | 'padron'

export default function PanelPage() {
  const [vista, setVista] = useState<Vista>('candidatos')

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Panel de Control</h1>
          <button onClick={() => supabase.auth.signOut()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 transition">
            Cerrar sesión
          </button>
        </div>

        <nav className="flex gap-2 mb-8 flex-wrap">
          <button onClick={() => setVista('candidatos')}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              vista === 'candidatos' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}>
            Candidatos
          </button>
          <button onClick={() => setVista('mesas')}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              vista === 'mesas' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}>
            Mesas
          </button>
          <button onClick={() => setVista('padron')}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              vista === 'padron' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}>
            Padrón Electoral
          </button>
        </nav>

        {vista === 'candidatos' && <CandidatosPage />}
        {vista === 'mesas' && <MesasPage />}
        {vista === 'padron' && <PadronPage />}
      </div>
    </main>
  )
}