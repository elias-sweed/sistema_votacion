import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Mesa = { id: string; nombre: string; activo: boolean; creado_en: string }

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('mesas').select('*').order('creado_en', { ascending: true })
    setCargando(false)
    if (err) { setError('No se pudieron cargar las mesas.'); return }
    setMesas(data ?? [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    setError(null); setExito(null)
    const nombreTrim = nombre.trim()
    if (nombreTrim.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }

    setGuardando(true)
    const { error: err } = await supabase.from('mesas')
      .insert({ nombre: nombreTrim, activo: true })
    setGuardando(false)
    if (err) {
      if (err.code === '23505') setError('Ya existe una mesa con ese nombre.')
      else setError('No se pudo agregar la mesa.')
      return
    }

    setNombre('')
    setExito('Mesa agregada.')
    await cargar()
  }

  async function iniciarEdicion(m: Mesa) {
    setEditandoId(m.id)
    setEditNombre(m.nombre)
    setError(null); setExito(null)
  }

  async function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
  }

  async function guardarEdicion(m: Mesa) {
    setError(null); setExito(null)
    const nombreTrim = editNombre.trim()
    if (nombreTrim.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (nombreTrim === m.nombre) { setEditandoId(null); return }

    const { error: err } = await supabase.from('mesas')
      .update({ nombre: nombreTrim }).eq('id', m.id)
    if (err) {
      if (err.code === '23505') setError('Ya existe una mesa con ese nombre.')
      else setError('No se pudo actualizar la mesa.')
      return
    }

    setEditandoId(null)
    setEditNombre('')
    setExito('Mesa actualizada.')
    await cargar()
  }

  async function alternarActivo(m: Mesa) {
    const { error: err } = await supabase.from('mesas')
      .update({ activo: !m.activo }).eq('id', m.id)
    if (err) { setError('No se pudo actualizar.'); return }
    setMesas((prev) => prev.map((x) => (x.id === m.id ? { ...x, activo: !x.activo } : x)))
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-amber-300/80 to-transparent" />
        <h2 className="text-xl font-bold text-white">Mesas / Salones</h2>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl space-y-4">
        <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la mesa (ej: 3ro Primaria A)"
            className="flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-400/15" />
          <button disabled={guardando}
            className="rounded-xl bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 px-6 py-2.5 font-bold text-black shadow-[0_10px_30px_-12px_rgba(234,179,8,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {exito && <p className="text-emerald-400 text-sm">{exito}</p>}
      </div>

      {cargando && <p className="text-slate-400">Cargando mesas…</p>}
      {!cargando && mesas.length === 0 && (
        <p className="text-slate-500">Aún no hay mesas. Agrega la primera.</p>
      )}

      <ul className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        {mesas.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-5 py-3">
            {editandoId === m.id ? (
              <form onSubmit={(e) => { e.preventDefault(); guardarEdicion(m); }} className="flex flex-col sm:flex-row gap-2 flex-1">
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-white backdrop-blur-md transition focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-400/15" />
                <button type="submit"
                  className="rounded-lg bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:brightness-110">
                  Guardar
                </button>
                <button type="button" onClick={cancelarEdicion}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className={m.activo ? 'text-white' : 'text-slate-500 line-through'} flex-1>{m.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => iniciarEdicion(m)}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                    Editar
                  </button>
                  <button onClick={() => alternarActivo(m)}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}