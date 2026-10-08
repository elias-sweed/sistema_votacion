import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Candidato = { id: string; nombre: string; foto_url: string | null; activo: boolean }

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('candidatos').select('*').order('creado_en', { ascending: true })
    setCargando(false)
    if (err) { setError('No se pudieron cargar los candidatos.'); return }
    setCandidatos(data ?? [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    setError(null); setExito(null)
    if (nombre.trim().length < 3) { setError('El nombre debe tener al menos 3 caracteres.'); return }

    setGuardando(true)
    const { error: err } = await supabase.from('candidatos')
      .insert({ nombre: nombre.trim(), foto_url: fotoUrl.trim() || null })
    setGuardando(false)
    if (err) { setError('No se pudo agregar el candidato.'); return }

    setNombre(''); setFotoUrl('')
    setExito('Candidato agregado.')
    await cargar()
  }

  async function alternarActivo(c: Candidato) {
    const { error: err } = await supabase.from('candidatos')
      .update({ activo: !c.activo }).eq('id', c.id)
    if (err) { setError('No se pudo actualizar.'); return }
    setCandidatos((prev) => prev.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x)))
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-white">Candidatos</h2>

      <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del candidato"
          className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
        <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="URL de foto (opcional)"
          className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
        <button disabled={guardando}
          className="rounded-lg bg-sky-600 px-6 py-2 font-semibold text-white disabled:opacity-50 hover:bg-sky-500 transition">
          {guardando ? 'Guardando…' : 'Agregar'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {exito && <p className="text-emerald-400 text-sm">{exito}</p>}

      {cargando && <p className="text-slate-400">Cargando candidatos…</p>}
      {!cargando && candidatos.length === 0 && (
        <p className="text-slate-500">Aún no hay candidatos. Agrega el primero.</p>
      )}

      <ul className="divide-y divide-slate-800">
        {candidatos.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <span className={c.activo ? 'text-white' : 'text-slate-500 line-through'}>{c.nombre}</span>
            <button onClick={() => alternarActivo(c)}
              className="text-sm rounded-lg bg-slate-800 px-3 py-1 hover:bg-slate-700 transition">
              {c.activo ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
