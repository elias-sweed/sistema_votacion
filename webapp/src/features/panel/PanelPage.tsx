import { supabase } from '../../lib/supabase'

export default function PanelPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de Control</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 transition"
        >
          Cerrar sesión
        </button>
      </div>
      <p className="text-slate-400 mt-4">Aquí irá la gestión de padrón, candidatos y resultados en vivo.</p>
    </main>
  )
}
