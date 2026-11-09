import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon'
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon'
import ImageAdd01Icon from '@hugeicons/core-free-icons/ImageAdd01Icon'
import ImageUpload01Icon from '@hugeicons/core-free-icons/ImageUpload01Icon'
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon'
import UserIcon from '@hugeicons/core-free-icons/UserIcon'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { CandidatosSkeleton } from '../panel/PanelSkeletons'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'
import { Badge } from '../../components/ui/Badge'

type Candidato = { id: string; nombre: string; foto_url: string | null; activo: boolean }

function iniciales(texto: string) {
  return texto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024

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
  const archivoRef = useRef<HTMLInputElement>(null)
  const [candidatosInicial] = useState(() => leerCache<Candidato[]>(CLAVES_CACHE.candidatos))
  const [candidatos, setCandidatos] = useState<Candidato[]>(candidatosInicial ?? [])
  const [cargando, setCargando] = useState(candidatosInicial === null)
  const [tieneDatos, setTieneDatos] = useState(candidatosInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Candidato | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function procesarImagen(file: File) {
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

  async function seleccionarImagen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await procesarImagen(file)
  }

  async function soltarImagen(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await procesarImagen(file)
  }

  function quitarImagen() {
    setFoto(null)
    setNombreArchivo(null)
  }

  function cambiarNombre(valor: string) {
    setNombre(valor.slice(0, 60))
    if (error) setError(null)
    if (exito) setExito(null)
  }

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('candidatos').select('*').order('creado_en', { ascending: true })
    setCargando(false)
    if (err) { setError(mensajeDeError(err, 'No se pudieron cargar los candidatos.')); return }
    const lista = data ?? []
    setCandidatos(lista)
    guardarCache(CLAVES_CACHE.candidatos, lista)
    setTieneDatos(true)
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
    if (err) { setError(mensajeDeError(err, 'No se pudo agregar el candidato.')); return }

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
        description: mensajeDeError(err, err.message),
        variant: 'error',
        duration: 6000
      })
      return
    }
    setCandidatos((prev) => {
      const siguiente = prev.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x))
      guardarCache(CLAVES_CACHE.candidatos, siguiente)
      return siguiente
    })
    toast({
      title: c.activo ? 'Candidato desactivado' : 'Candidato activado',
      description: c.nombre,
      variant: 'success',
      duration: 3000
    })
  }

  function iniciarEdicion(c: Candidato) {
    setEditandoId(c.id)
    setEditNombre(c.nombre)
    setError(null)
    setExito(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
  }

  async function guardarEdicion(c: Candidato) {
    setError(null); setExito(null)
    const nombreTrim = editNombre.trim()
    if (nombreTrim.length < 3) { setError('El nombre debe tener al menos 3 caracteres.'); return }
    if (nombreTrim === c.nombre) { setEditandoId(null); return }

    const { error: err } = await supabase.from('candidatos')
      .update({ nombre: nombreTrim }).eq('id', c.id)
    if (err) {
      setError(mensajeDeError(err, 'No se pudo actualizar el candidato.'))
      return
    }
    setEditandoId(null)
    setEditNombre('')
    setExito('Candidato actualizado.')
    await cargar()
  }

  async function eliminarCandidato(c: Candidato) {
    setEliminando(true)
    try {
      const { error: err } = await supabase.from('candidatos').delete().eq('id', c.id)
      if (err) {
        setError(mensajeDeError(err, 'No se pudo eliminar el candidato.'))
        return
      }
      setExito('Candidato eliminado.')
      setCandidatos((prev) => prev.filter((x) => x.id !== c.id))
      guardarCache(CLAVES_CACHE.candidatos, candidatos.filter((x) => x.id !== c.id))
      await cargar()
    } finally {
      setEliminando(false)
      setConfirmandoEliminar(null)
    }
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Candidatos"
        description="Administra quiénes aparecen en la papeleta."
        actions={
          <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={guardando}>
            {guardando ? 'Actualizando…' : 'Actualizar'}
          </AdminButton>
        }
      />

      <div className="flex items-end justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          {candidatos.length} {candidatos.length === 1 ? 'candidato' : 'candidatos'}
        </div>
      </div>

      {/* Formulario de nuevo candidato */}
      <AdminCard>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.8} className="text-blue-400" />
              <h3 className="text-base font-semibold text-white">Nuevo candidato</h3>
            </div>
          </div>

          <form onSubmit={agregar} className="grid gap-4 sm:grid-cols-3">
            <div className="col-span-3 sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="candidato-nombre" className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Nombre del candidato
                </label>
                <span className={`text-[11px] tabular-nums ${nombre.length >= 55 ? 'text-amber-300' : 'text-slate-500'}`}>
                  {nombre.length}/60
                </span>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <HugeiconsIcon icon={UserIcon} size={17} strokeWidth={1.8} />
                </span>
                <input
                  id="candidato-nombre"
                  value={nombre}
                  onChange={(e) => cambiarNombre(e.target.value)}
                  placeholder="Ej. María Fernanda Rojas"
                  maxLength={60}
                  autoComplete="off"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-11 pr-4 text-[15px] text-white shadow-inner shadow-black/20 backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
              <p className="text-xs text-slate-500">
                Nombre y apellido tal como aparecerán en la papeleta.
              </p>
            </div>

            <div className="col-span-3 sm:col-span-1 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Fotografía</span>
                <span className="text-[11px] text-slate-500">Opcional</span>
              </div>

              <input
                ref={archivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={seleccionarImagen}
                className="sr-only"
                aria-label="Seleccionar fotografía del candidato"
              />

              {foto ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <img src={foto} alt="Fotografía del candidato" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{nombreArchivo ?? 'Imagen seleccionada'}</p>
                    <p className="mt-1 text-xs text-slate-500">Optimizada automáticamente · 640 px · WebP</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => archivoRef.current?.click()}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12]"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={quitarImagen}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => archivoRef.current?.click()}
                  onDragEnter={(e) => { e.preventDefault(); setArrastrando(true) }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => { const siguiente = e.relatedTarget as Node | null; if (!siguiente || !e.currentTarget.contains(siguiente)) setArrastrando(false) }}
                  onDrop={soltarImagen}
                  className={`group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition ${
                    arrastrando ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/15 bg-black/20 hover:border-blue-300/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl border transition ${arrastrando ? 'border-blue-400/40 bg-blue-500/20 text-blue-200' : 'border-white/10 bg-white/[0.05] text-slate-300 group-hover:text-blue-200'}`}>
                    <HugeiconsIcon icon={ImageUpload01Icon} size={22} strokeWidth={1.7} />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-medium text-white">{arrastrando ? 'Suelta la imagen aquí' : 'Arrastra tu imagen aquí'}</span>
                    <span className="block text-xs text-slate-500">o selecciona un archivo desde tu equipo</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-200 transition group-hover:bg-white/[0.1]">
                    <HugeiconsIcon icon={ImageAdd01Icon} size={15} strokeWidth={1.8} />
                    Seleccionar imagen
                  </span>
                  <span className="text-[11px] text-slate-500">JPG, PNG o WebP · máx. 5 MB</span>
                </button>
              )}

            </div>

            {error && (
              <div className="col-span-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
                <span className="mt-0.5 shrink-0 text-red-300"><HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} /></span>
                <span>{error}</span>
              </div>
            )}
            {exito && (
              <div className="col-span-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200">
                <span className="mt-0.5 shrink-0 text-emerald-300"><HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} /></span>
                <span>{exito}</span>
              </div>
            )}

            <div className="col-span-3 flex items-end gap-2 sm:justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-6 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
                {guardando ? 'Guardando…' : 'Agregar candidato'}
              </button>
            </div>
          </form>
        </div>
      </AdminCard>

      {cargando && !tieneDatos && <CandidatosSkeleton />}
      {tieneDatos && candidatos.length === 0 && (
        <AdminCard>
          <div className="text-center py-10">
            <p className="text-slate-500">Aún no hay candidatos. Agrega el primero.</p>
          </div>
        </AdminCard>
      )}

      {/* Lista de candidatos */}
      <AdminCard>
        <ul className="divide-y divide-white/10">
          {candidatos.map((c) => {
            const estaEditando = editandoId === c.id
            return (
              <li key={c.id} className="p-4">
                {estaEditando ? (
                  <form onSubmit={(e) => { e.preventDefault(); void guardarEdicion(c); }} className="flex gap-3 items-end">
                    <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                      className="flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
                    <button type="submit" className="rounded-lg bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelarEdicion} className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/[0.1]">
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0 h-12 w-12 rounded-xl overflow-hidden border border-white/10 bg-black/25">
                        {c.foto_url ? (
                          <img src={c.foto_url} alt={c.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-800 to-[#050a1a]">
                            <span className="text-xl font-bold text-white/90">{iniciales(c.nombre) || '?'}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                        <Badge variant={c.activo ? 'success' : 'default'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void alternarActivo(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition ${c.activo ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20 border border-red-400/30' : 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 border border-emerald-400/30'}"
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmandoEliminar(null); iniciarEdicion(c) }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white hover:bg-white/[0.05]"
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={14} strokeWidth={1.8} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditandoId(null); setConfirmandoEliminar(c) }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/10"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </AdminCard>

      {confirmandoEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar eliminación de candidato"
            onClick={() => setConfirmandoEliminar(null)}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <form onSubmit={(e) => { e.preventDefault(); void eliminarCandidato(confirmandoEliminar); }} role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]">
            <h2 className="text-base font-semibold text-white">Eliminar candidato</h2>
            <p className="mt-2 text-sm text-slate-400">
              Se eliminará <strong className="text-white">{confirmandoEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmandoEliminar(null)} className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12]">
                Cancelar
              </button>
              <button type="submit" disabled={eliminando} className="flex-1 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {eliminando ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
