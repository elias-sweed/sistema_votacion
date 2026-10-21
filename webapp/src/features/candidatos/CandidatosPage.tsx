import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import TiltedCard, { TiltedCardLayer } from '../../components/ui/TiltedCard'

type Candidato = { id: string; nombre: string; foto_url: string | null; activo: boolean }

function iniciales(texto: string) {
  return texto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function Placeholder({ nombre }: { nombre: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-500 via-indigo-600 to-slate-900">
      <span className="text-5xl font-bold text-white/90">{iniciales(nombre) || '?'}</span>
    </div>
  )
}

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [guardando, setGuardando] = useState(false)

  const fotoPreview = /^https?:\/\//i.test(fotoUrl.trim()) ? fotoUrl.trim() : undefined

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

      <div className="flex flex-col lg:flex-row gap-8">
        <form onSubmit={agregar} className="flex-1 flex flex-col gap-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del candidato"
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
          <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="URL de foto (opcional)"
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white" />
          <button disabled={guardando}
            className="rounded-lg bg-sky-600 px-6 py-2 font-semibold text-white disabled:opacity-50 hover:bg-sky-500 transition">
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {exito && <p className="text-emerald-400 text-sm">{exito}</p>}
        </form>

        <aside className="flex flex-col items-center gap-2">
          <TiltedCard
            imageSrc={fotoPreview}
            altText={nombre || 'Nuevo candidato'}
            captionText={nombre || 'Nuevo candidato'}
            showTooltip={false}
            containerHeight={280}
            containerWidth={240}
            imageHeight={280}
            imageWidth={240}
            rotateAmplitude={12}
            scaleOnHover={1.05}
            glare={0.5}
            shadow={0.6}
            radius={16}
          >
            {!fotoPreview && <Placeholder nombre={nombre} />}
            <TiltedCardLayer depth={30}>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                <h3 className="text-base font-semibold text-white">
                  {nombre.trim() || 'Nuevo candidato'}
                </h3>
                <p className="text-xs text-white/70">Vista previa</p>
              </div>
            </TiltedCardLayer>
          </TiltedCard>
          <p className="text-xs text-slate-500">Así se verá tu candidato</p>
        </aside>
      </div>

      {cargando && <p className="text-slate-400">Cargando candidatos…</p>}
      {!cargando && candidatos.length === 0 && (
        <p className="text-slate-500">Aún no hay candidatos. Agrega el primero.</p>
      )}

      <ul className="grid gap-8 justify-items-center sm:grid-cols-2 lg:grid-cols-3">
        {candidatos.map((c) => (
          <li key={c.id}>
            <TiltedCard
              imageSrc={c.foto_url ?? undefined}
              altText={c.nombre}
              captionText={c.nombre}
              showTooltip={false}
              containerHeight={300}
              containerWidth={240}
              imageHeight={300}
              imageWidth={240}
              rotateAmplitude={12}
              scaleOnHover={1.05}
              glare={0.5}
              shadow={0.6}
              radius={16}
              backContent={
                <div className="flex h-full flex-col justify-between bg-slate-950 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-sky-400">Candidato</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{c.nombre}</h3>
                  </div>
                  <div className="space-y-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      c.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); alternarActivo(c) }}
                      className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 transition">
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              }
            >
              {c.foto_url ? null : <Placeholder nombre={c.nombre} />}
              <TiltedCardLayer depth={30}>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                  <h3 className={`text-base font-semibold text-white ${c.activo ? '' : 'line-through opacity-70'}`}>
                    {c.nombre}
                  </h3>
                  <p className="text-xs text-white/70">{c.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
              </TiltedCardLayer>
            </TiltedCard>
          </li>
        ))}
      </ul>
    </section>
  )
}
