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
      <h2 className="text-xl font-bold text-white">Mesas / Salones</h2>

      <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la mesa (ej: 3ro Primaria A)"
          className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
        <button disabled={guardando}
          className="rounded-lg bg-sky-600 px-6 py-2 font-semibold text-white disabled:opacity-50 hover:bg-sky-500 transition">
          {guardando ? 'Guardando…' : 'Agregar'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {exito && <p className="text-emerald-400 text-sm">{exito}</p>}

      {cargando && <p className="text-slate-400">Cargando mesas…</p>}
      {!cargando && mesas.length === 0 && (
        <p className="text-slate-500">Aún no hay mesas. Agrega la primera.</p>
      )}

      <ul className="divide-y divide-slate-800">
        {mesas.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3">
            {editandoId === m.id ? (
              <form onSubmit={(e) => { e.preventDefault(); guardarEdicion(m); }} className="flex flex-col sm:flex-row gap-2 flex-1">
                <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
                <button type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition">
                  Guardar
                </button>
                <button type="button" onClick={cancelarEdicion}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className={m.activo ? 'text-white' : 'text-slate-500 line-through'} flex-1>{m.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => iniciarEdicion(m)}
                    className="text-sm rounded-lg bg-slate-800 px-3 py-1 hover:bg-slate-700 transition">
                    Editar
                  </button>
                  <button onClick={() => alternarActivo(m)}
                    className="text-sm rounded-lg bg-slate-800 px-3 py-1 hover:bg-slate-700 transition">
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