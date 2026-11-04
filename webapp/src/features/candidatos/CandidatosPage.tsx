import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/ToastProvider'
import TiltedCard, { TiltedCardLayer } from '../../components/ui/TiltedCard'

type Candidato = { id: string; nombre: string; foto_url: string | null; activo: boolean }

function iniciales(texto: string) {
  return texto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function Placeholder({ nombre }: { nombre: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-800 to-[#050a1a]">
      <span className="text-5xl font-bold text-white/90">{iniciales(nombre) || '?'}</span>
    </div>
  )
}

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024

// Reduce la imagen a 640 px y la convierte a WebP para no guardar archivos enormes.
function comprimirImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('La imagen no es válida.'))
      img.onload = () => {
        const MAX = 640
        const escala = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * escala))
        canvas.height = Math.max(1, Math.round(img.height * escala))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const webp = canvas.toDataURL('image/webp', 0.85)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function CandidatosPage() {
  const toast = useToast()
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const fotoPreview = foto ?? undefined

  async function seleccionarImagen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setExito(null)

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG o WebP).')
      return
    }
    if (file.size > MAX_IMAGEN_BYTES) {
      setError('La imagen no debe superar 5 MB.')
      return
    }

    try {
      setFoto(await comprimirImagen(file))
      setNombreArchivo(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.')
    }
  }

  function quitarImagen() {
    setFoto(null)
    setNombreArchivo(null)
  }

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
      .insert({ nombre: nombre.trim(), foto_url: foto })
    setGuardando(false)
    if (err) { setError('No se pudo agregar el candidato.'); return }

    setNombre(''); setFoto(null); setNombreArchivo(null)
    setExito('Candidato agregado.')
    await cargar()
  }

  async function alternarActivo(c: Candidato) {
    setError(null); setExito(null)
    const { error: err } = await supabase.from('candidatos')
      .update({ activo: !c.activo }).eq('id', c.id)
    if (err) {
      toast({
        title: 'No se pudo actualizar',
        description: err.message,
        variant: 'error',
        duration: 6000
      })
      return
    }
    setCandidatos((prev) => prev.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x)))
    toast({
      title: c.activo ? 'Candidato desactivado' : 'Candidato activado',
      description: c.nombre,
      variant: 'success',
      duration: 3000
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
        <h2 className="text-xl font-bold text-white">Candidatos</h2>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row gap-8">
          <form onSubmit={agregar} className="flex-1 flex flex-col gap-3">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del candidato"
              className="rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.08] focus-within:border-blue-400/60">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={seleccionarImagen}
                  className="sr-only"
                />
                Seleccionar imagen
              </label>
              {foto && (
                <button
                  type="button"
                  onClick={quitarImagen}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.12]"
                >
                  Quitar imagen
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {nombreArchivo ?? 'JPG, PNG o WebP · máx. 5 MB · se optimiza automáticamente'}
            </p>
            <button disabled={guardando}
              className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
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
                <div className="flex h-full flex-col justify-between border border-white/10 bg-[#07101f]/80 p-5 backdrop-blur-xl">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-blue-300/80">Candidato</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{c.nombre}</h3>
                  </div>
                  <div className="space-y-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      c.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-300'
                    }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); alternarActivo(c) }}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
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
