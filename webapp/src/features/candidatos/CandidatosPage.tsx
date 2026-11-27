import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon'
import CarouselHorizontalIcon from '@hugeicons/core-free-icons/CarouselHorizontalIcon'
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon'
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon'
import UserIcon from '@hugeicons/core-free-icons/UserIcon'
import { supabase } from '../../lib/supabase'
import type { RolPanel } from '../../lib/roles'
import { esVotoBlanco } from '../../lib/votoBlanco'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { borrarCandidato, mensajeBorrado } from '../../lib/borrado'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { CandidatosSkeleton } from '../panel/PanelSkeletons'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'
import { Badge } from '../../components/ui/Badge'
import { AdminModal } from '../../components/ui/AdminModal'
import { RevealSection } from '../../components/ui/RevealSection'
import { EmptyState } from '../../components/ui/EmptyState'
import CandidatoImageField from './CandidatoImageField'
import FlexCarousel from '../../components/ui/FlexCarousel'
import GridViewIcon from '@hugeicons/core-free-icons/GridViewIcon'
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon'

type Candidato = { id: string; nombre: string; foto_url: string | null; activo: boolean }
type VistaCandidatos = 'lista' | 'galeria' | 'carrusel'

const VISTAS_CANDIDATOS: Array<{ valor: VistaCandidatos; etiqueta: string; icon: typeof Menu01Icon }> = [
  { valor: 'lista', etiqueta: 'Lista', icon: Menu01Icon },
  { valor: 'galeria', etiqueta: 'Galería', icon: GridViewIcon },
  { valor: 'carrusel', etiqueta: 'Carrusel', icon: CarouselHorizontalIcon }
]

function iniciales(texto: string) {
  return texto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function imagenPlaceholder(nombre: string) {
  const siglas = iniciales(nombre) || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="0.55" stop-color="#1e3a8a"/><stop offset="1" stop-color="#050a1a"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#f)"/>
<text x="320" y="288" text-anchor="middle" font-family="system-ui,sans-serif" font-size="180" font-weight="700" fill="rgba(255,255,255,0.92)">${siglas}</text>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
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

type CandidatosPageProps = { rol?: RolPanel | null }

export default function CandidatosPage({ rol }: CandidatosPageProps) {
  const puedeEliminar = rol !== 'operador'
  const toast = useToast()
  const [candidatosInicial] = useState(() => {
    const cache = leerCache<Candidato[]>(CLAVES_CACHE.candidatos)
    return cache === null ? null : cache.filter((c) => !esVotoBlanco(c.id))
  })
  const [candidatos, setCandidatos] = useState<Candidato[]>(candidatosInicial ?? [])
  const [cargando, setCargando] = useState(candidatosInicial === null)
  const [tieneDatos, setTieneDatos] = useState(candidatosInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<VistaCandidatos>('lista')
  const [carruselIndice, setCarruselIndice] = useState(0)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editFoto, setEditFoto] = useState<string | null>(null)
  const [editNombreArchivo, setEditNombreArchivo] = useState<string | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Candidato | null>(null)
  const [eliminando, setEliminando] = useState(false)

  function validarImagen(file: File) {
    if (!file.type.startsWith('image/')) return 'El archivo debe ser una imagen (JPG, PNG o WebP).'
    if (file.size > MAX_IMAGEN_BYTES) return 'La imagen no debe superar 5 MB.'
    return null
  }

  async function aplicarImagen(file: File, destino: 'nuevo' | 'editar') {
    const problema = validarImagen(file)
    if (problema) {
      if (destino === 'editar') setErrorEdicion(problema)
      else setError(problema)
      return
    }
    if (destino === 'editar') setErrorEdicion(null)
    else { setError(null); setExito(null) }

    try {
      const datos = await comprimirImagen(file)
      if (destino === 'editar') {
        setEditFoto(datos)
        setEditNombreArchivo(file.name)
      } else {
        setFoto(datos)
        setNombreArchivo(file.name)
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo procesar la imagen.'
      if (destino === 'editar') setErrorEdicion(mensaje)
      else setError(mensaje)
    }
  }

  async function procesarImagenNueva(file: File) {
    await aplicarImagen(file, 'nuevo')
  }

  async function procesarImagenEdicion(file: File) {
    await aplicarImagen(file, 'editar')
  }

  function quitarImagen() {
    setFoto(null)
    setNombreArchivo(null)
    setError(null)
  }

  function quitarImagenEdicion() {
    setEditFoto(null)
    setEditNombreArchivo(null)
    setErrorEdicion(null)
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
    const lista = (data ?? []).filter((c) => !esVotoBlanco(c.id))
    setCandidatos(lista)
    guardarCache(CLAVES_CACHE.candidatos, lista)
    setTieneDatos(true)
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    setCarruselIndice((actual) => Math.min(actual, Math.max(0, candidatos.length - 1)))
  }, [candidatos.length])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    setError(null); setExito(null)
    if (nombre.trim().length < 3) { setError('El nombre debe tener al menos 3 caracteres.'); return }

    setGuardando(true)
    const { error: err } = await supabase.from('candidatos')
      .insert({ nombre: nombre.trim(), foto_url: foto })
    setGuardando(false)
    if (err) { setError(mensajeDeError(err, 'No se pudo agregar el candidato.')); return }

    const nombreCreado = nombre.trim()
    setNombre(''); setFoto(null); setNombreArchivo(null)
    setExito('Candidato agregado.')
    toast({
      title: 'Candidato agregado',
      description: `${nombreCreado} ya aparece en la papeleta.`,
      variant: 'success',
      duration: 3500
    })
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
      description: c.activo
        ? `${c.nombre} ya no aparece en la papeleta.`
        : `${c.nombre} ahora aparece en la papeleta.`,
      variant: 'success',
      duration: 3500
    })
  }

  function iniciarEdicion(c: Candidato) {
    setEditandoId(c.id)
    setEditNombre(c.nombre)
    setEditFoto(c.foto_url)
    setEditNombreArchivo(null)
    setErrorEdicion(null)
    setConfirmandoEliminar(null)
    setError(null)
    setExito(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
    setEditFoto(null)
    setEditNombreArchivo(null)
    setErrorEdicion(null)
    setGuardandoEdicion(false)
  }

  async function guardarEdicion(c: Candidato) {
    setErrorEdicion(null); setExito(null)
    const nombreTrim = editNombre.trim()
    if (nombreTrim.length < 3) {
      setErrorEdicion('El nombre debe tener al menos 3 caracteres.')
      return
    }

    const fotoAnterior = c.foto_url ?? null
    if (nombreTrim === c.nombre && editFoto === fotoAnterior) {
      cancelarEdicion()
      return
    }

    setGuardandoEdicion(true)
    const { error: err } = await supabase.from('candidatos')
      .update({ nombre: nombreTrim, foto_url: editFoto }).eq('id', c.id)
    setGuardandoEdicion(false)
    if (err) {
      setErrorEdicion(mensajeDeError(err, 'No se pudo actualizar el candidato.'))
      return
    }

    const detalleImagen = editFoto === null
      ? ' · imagen quitada'
      : editFoto !== fotoAnterior
        ? ' · imagen actualizada'
        : ''
    cancelarEdicion()
    setExito('Candidato actualizado.')
    toast({
      title: 'Candidato actualizado',
      description: `${nombreTrim}${detalleImagen}.`,
      variant: 'success',
      duration: 3500
    })
    await cargar()
  }

  async function eliminarCandidato(c: Candidato) {
    if (!puedeEliminar) return
    setEliminando(true)
    try {
      const resultado = await borrarCandidato(c.id)
      if (!resultado.ok) {
        setError(mensajeBorrado(resultado))
        return
      }
      setExito('Candidato eliminado.')
      toast({
        title: 'Candidato eliminado',
        description: `${c.nombre} fue eliminado permanentemente.`,
        variant: 'success',
        duration: 3500
      })
      setCandidatos((prev) => prev.filter((x) => x.id !== c.id))
      guardarCache(CLAVES_CACHE.candidatos, candidatos.filter((x) => x.id !== c.id))
      await cargar()
    } finally {
      setEliminando(false)
      setConfirmandoEliminar(null)
    }
  }

  function enfocarNuevoCandidato() {
    const campo = document.getElementById('candidato-nombre')
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    campo?.focus()
  }

  function botonesAccion(c: Candidato) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void alternarActivo(c)}
          aria-pressed={c.activo}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            c.activo
              ? 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
          }`}
        >
          {c.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={() => { setConfirmandoEliminar(null); iniciarEdicion(c) }}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <HugeiconsIcon icon={Edit02Icon} size={14} strokeWidth={1.8} />
          Editar
        </button>
        {puedeEliminar && (
          <button
            type="button"
            onClick={() => { setEditandoId(null); setConfirmandoEliminar(c) }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/10"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
            Eliminar
          </button>
        )}
      </div>
    )
  }

  const candidatoEditando = candidatos.find((c) => c.id === editandoId) ?? null
  const itemsCarrusel = candidatos.map((c) => ({
    src: c.foto_url ?? imagenPlaceholder(c.nombre),
    alt: `Fotografía de ${c.nombre}`,
    title: c.nombre,
    subtitle: c.activo ? 'Activo' : 'Inactivo'
  }))
  const candidatoEnFoco = candidatos[Math.min(carruselIndice, candidatos.length - 1)] ?? null

  return (
    <RevealSection className="space-y-6">
      <SectionHeader
        title="Candidatos"
        description="Administra quiénes aparecen en la papeleta."
        actions={
          <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={guardando}>
            {guardando ? 'Actualizando…' : 'Actualizar'}
          </AdminButton>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          {candidatos.length} {candidatos.length === 1 ? 'candidato' : 'candidatos'}
        </div>

        <div
          role="tablist"
          aria-label="Vista de candidatos"
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 p-1"
        >
          {VISTAS_CANDIDATOS.map(({ valor, etiqueta, icon }) => {
            const activa = vista === valor
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                aria-controls="vista-candidatos"
                onClick={() => setVista(valor)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  activa ? 'bg-blue-500/20 text-blue-100' : 'text-slate-400 hover:text-white'
                }`}
              >
                <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} />
                {etiqueta}
              </button>
            )
          })}
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

            <div className="col-span-3 sm:col-span-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Fotografía</span>
                <span className="text-[11px] text-slate-500">Opcional</span>
              </div>

              <CandidatoImageField
                foto={foto}
                nombre={nombre}
                nombreArchivo={nombreArchivo}
                onImagen={procesarImagenNueva}
                onQuitar={quitarImagen}
                variante="control"
              />
            </div>

            {foto && (
              <div className="col-span-3">
                <CandidatoImageField
                  foto={foto}
                  nombre={nombre}
                  nombreArchivo={nombreArchivo}
                  onImagen={procesarImagenNueva}
                  onQuitar={quitarImagen}
                  ariaLabelInput="Cambiar fotografía del candidato"
                  variante="preview"
                />
              </div>
            )}

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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-6 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
          <EmptyState
            icon={<HugeiconsIcon icon={UserIcon} size={22} strokeWidth={1.7} />}
            title="Aún no hay candidatos"
            description="Agrega el primero para que aparezca en la papeleta de votación."
            action={<AdminButton size="sm" onClick={enfocarNuevoCandidato}>Agregar candidato</AdminButton>}
          />
        </AdminCard>
      )}

      {tieneDatos && candidatos.length > 0 && (
        <div id="vista-candidatos">
          {vista === 'lista' ? (
            <AdminCard>
              <ul className="divide-y divide-white/10">
                {candidatos.map((c) => (
                  <li key={c.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25">
                          {c.foto_url ? (
                            <img src={c.foto_url} alt={c.nombre} className="h-full w-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-blue-500 via-blue-800 to-[#050a1a]">
                              <span className="text-xl font-bold text-white/90">{iniciales(c.nombre) || '?'}</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{c.nombre}</p>
                          <Badge variant={c.activo ? 'success' : 'default'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                        </div>
                      </div>

                      {botonesAccion(c)}
                    </div>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : vista === 'galeria' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {candidatos.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/4 backdrop-blur-xl">
                  <div className="relative aspect-4/3 overflow-hidden border-b border-white/10 bg-black/30">
                    {c.foto_url ? (
                      <img src={c.foto_url} alt={c.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-blue-500 via-blue-800 to-[#050a1a]">
                        <span className="text-4xl font-bold text-white/90">{iniciales(c.nombre) || '?'}</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3">
                      <Badge variant={c.activo ? 'success' : 'default'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="truncate text-sm font-semibold text-white">{c.nombre}</p>
                    {botonesAccion(c)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Carrusel de candidatos</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Arrastra, usa la rueda o las flechas del teclado.</p>
                </div>
                <span className="text-xs tabular-nums text-slate-400">
                  {Math.min(carruselIndice + 1, candidatos.length)} / {candidatos.length}
                </span>
              </div>

              <div
                className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                style={{ width: '100%', height: '560px', position: 'relative' }}
              >
                <FlexCarousel
                  items={itemsCarrusel}
                  preset="liquid"
                  intro="rise"
                  cardHeight={0.5}
                  gap={12}
                  squeeze={0.2}
                  focusOnClick
                  captions
                  fit="landscape"
                  radius={0}
                  lensWidth={1.18}
                  lensHeight={0.74}
                  tilt={62}
                  roundness={1}
                  bend={0.34}
                  reach={0.38}
                  curl="twist"
                  dispersion={0.45}
                  liquid={0}
                  followCursor={false}
                  autoplay={false}
                  interval={4}
                  captureWheel
                  onChange={(indice) => setCarruselIndice(indice)}
                />
              </div>

              {candidatoEnFoco && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <p className="truncate text-sm font-semibold text-white">{candidatoEnFoco.nombre}</p>
                    <Badge variant={candidatoEnFoco.activo ? 'success' : 'default'}>
                      {candidatoEnFoco.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  {botonesAccion(candidatoEnFoco)}
                </div>
              )}
            </AdminCard>
          )}
        </div>
      )}

      {candidatoEditando && (
        <AdminModal
          open={editandoId === candidatoEditando.id}
          onClose={cancelarEdicion}
          title={`Editar a ${candidatoEditando.nombre}`}
          description="Actualiza el nombre y la imagen que aparecen en la papeleta."
          confirmLabel={guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
          loading={guardandoEdicion}
          onConfirm={() => {}}
          modalId="editar-candidato-modal"
          className="max-w-2xl"
          confirmFormId="editar-candidato-form"
        >
          <form
            id="editar-candidato-form"
            onSubmit={(e) => { e.preventDefault(); void guardarEdicion(candidatoEditando) }}
            className="grid gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="editar-candidato-nombre" className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Nombre del candidato
                </label>
                <span className={`text-[11px] tabular-nums ${editNombre.length >= 55 ? 'text-amber-300' : 'text-slate-500'}`}>
                  {editNombre.length}/60
                </span>
              </div>
              <input
                id="editar-candidato-nombre"
                value={editNombre}
                onChange={(e) => {
                  setEditNombre(e.target.value.slice(0, 60))
                  setErrorEdicion(null)
                }}
                maxLength={60}
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-[15px] text-white shadow-inner shadow-black/20 backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
              <p className="text-xs text-slate-500">Nombre y apellido tal como aparecerán en la papeleta.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Fotografía</span>
                <span className="text-[11px] text-slate-500">Opcional</span>
              </div>
              <CandidatoImageField
                foto={editFoto}
                nombre={editNombre}
                nombreArchivo={editNombreArchivo}
                onImagen={procesarImagenEdicion}
                onQuitar={quitarImagenEdicion}
                ariaLabelInput="Seleccionar nueva fotografía del candidato"
                etiquetaPreview="Vista previa al editar"
              />
            </div>

            {errorEdicion && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
                <span className="mt-0.5 shrink-0 text-red-300"><HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} /></span>
                <span>{errorEdicion}</span>
              </div>
            )}
          </form>
        </AdminModal>
      )}

      {confirmandoEliminar && (
        <AdminModal
          open={confirmandoEliminar !== null}
          onClose={() => setConfirmandoEliminar(null)}
          title={`Eliminar candidato ${confirmandoEliminar.nombre}`}
          description="Se eliminará el candidato de la papeleta junto con los votos que haya recibido. Esta acción no se puede deshacer."
          confirmLabel="Confirmar eliminación"
          confirmVariant="danger"
          loading={eliminando}
          onConfirm={() => void eliminarCandidato(confirmandoEliminar)}
        />
      )}
    </RevealSection>
  )
}
