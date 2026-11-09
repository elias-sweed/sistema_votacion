import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import ImageAdd01Icon from '@hugeicons/core-free-icons/ImageAdd01Icon'
import ImageUpload01Icon from '@hugeicons/core-free-icons/ImageUpload01Icon'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { useToast } from '../../components/ui/ToastProvider'

type Config = {
  eleccion_abierta: boolean
  titulo: string
  centro: string
  logo_url?: string | null
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024

// Reduce el logo a 512 px. Se conserva PNG cuando el navegador no soporta WebP
// para no perder la transparencia del escudo o logotipo.
function comprimirLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('La imagen no es válida.'))
      img.onload = () => {
        const MAX = 512
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
        const webp = canvas.toDataURL('image/webp', 0.9)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function ConfiguracionPage() {
  const toast = useToast()
  const archivoRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [titulo, setTitulo] = useState('')
  const [centro, setCentro] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmando, setConfirmando] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Eliminar todo (votantes, candidatos, centro educativo)
  const [eliminandoTodo, setEliminandoTodo] = useState<'votantes' | 'candidatos' | 'centro' | null>(null)
  const [passwordEliminarTodo, setPasswordEliminarTodo] = useState('')
  const [eliminandoTodoCargando, setEliminandoTodoCargando] = useState(false)
  const [errorEliminarTodo, setErrorEliminarTodo] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    setCargando(false)
    if (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la configuración electoral.'))
      return
    }
    if (!data) {
      setError('No existe la fila de configuración. Aplica las migraciones de Supabase.')
      return
    }

    const fila = data as Config
    setConfig(fila)
    setTitulo(fila.titulo)
    setCentro(fila.centro)
    setLogoUrl(fila.logo_url ?? null)
    setNombreArchivo(null)
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function procesarLogo(file: File) {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG o WebP).')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('La imagen no debe superar 5 MB.')
      return
    }

    try {
      setLogoUrl(await comprimirLogo(file))
      setNombreArchivo(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.')
    }
  }

  async function seleccionarLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await procesarLogo(file)
  }

  async function soltarLogo(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await procesarLogo(file)
  }

  function quitarLogo() {
    setLogoUrl(null)
    setNombreArchivo(null)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const tituloTrim = titulo.trim()
    const centroTrim = centro.trim()

    if (tituloTrim.length < 3) {
      setError('El título debe tener al menos 3 caracteres.')
      return
    }
    if (centroTrim.length < 3) {
      setError('El nombre del centro debe tener al menos 3 caracteres.')
      return
    }

    setGuardando(true)
    const { error: err } = await supabase
      .from('configuracion')
      .update({ titulo: tituloTrim, centro: centroTrim, logo_url: logoUrl })
      .eq('id', 1)
    setGuardando(false)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la configuración.'))
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'error', duration: 6000 })
      return
    }

    setConfig(current => current ? { ...current, titulo: tituloTrim, centro: centroTrim, logo_url: logoUrl } : current)
    toast({ title: 'Configuración guardada', description: 'Los kioscos verán los cambios al refrescar.', variant: 'success', duration: 3500 })
  }

  async function cambiarEstado(abrir: boolean) {
    setCambiandoEstado(true)
    setError(null)
    const { error: err } = await supabase
      .from('configuracion')
      .update({ eleccion_abierta: abrir })
      .eq('id', 1)
    setCambiandoEstado(false)
    setConfirmando(null)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo cambiar el estado de la elección.'))
      toast({ title: 'No se pudo cambiar el estado', description: err.message, variant: 'error', duration: 6000 })
      return
    }

    setConfig(current => current ? { ...current, eleccion_abierta: abrir } : current)
    toast({
      title: abrir ? 'Elección abierta' : 'Elección cerrada',
      description: abrir
        ? 'Los kioscos ya pueden registrar votos.'
        : 'Los kioscos dejaron de aceptar votos inmediatamente.',
      variant: 'success',
      duration: 4000
    })
  }

  async function autenticarAdmin(): Promise<string | null> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (userError || !email) return null
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: passwordEliminarTodo
    })
    if (authError) return null
    return email
  }

  async function cerrarEliminarTodo() {
    setEliminandoTodo(null)
    setPasswordEliminarTodo('')
    setErrorEliminarTodo(null)
  }

  async function ejecutarEliminarTodo() {
    if (!eliminandoTodo || eliminandoTodoCargando) return

    setErrorEliminarTodo(null)

    const email = await autenticarAdmin()
    if (!email) {
      setErrorEliminarTodo('La contraseña no es correcta. Inténtalo otra vez.')
      return
    }

    setEliminandoTodoCargando(true)
    try {
      if (eliminandoTodo === 'votantes') {
        const { error: err } = await supabase.from('votantes').delete().neq('dni', '')
        if (err) {
          setErrorEliminarTodo(mensajeDeError(err, 'No se pudieron eliminar los votantes.'))
          return
        }
        toast({
          title: 'Votantes eliminados',
          description: 'Se borraron todos los votantes del padrón.',
          variant: 'success',
          duration: 4000
        })
      } else if (eliminandoTodo === 'candidatos') {
        const { error: err } = await supabase.from('candidatos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (err) {
          setErrorEliminarTodo(mensajeDeError(err, 'No se pudieron eliminar los candidatos.'))
          return
        }
        toast({
          title: 'Candidatos eliminados',
          description: 'Se borraron todos los candidatos.',
          variant: 'success',
          duration: 4000
        })
      } else if (eliminandoTodo === 'centro') {
        const { error: err } = await supabase
          .from('configuracion')
          .update({ titulo: 'Elección de Municipios Escolares', centro: 'I.E. Jimenez Pimentel', logo_url: null })
          .eq('id', 1)
        if (err) {
          setErrorEliminarTodo(mensajeDeError(err, 'No se pudo restablecer el centro educativo.'))
          return
        }
        setTitulo('Elección de Municipios Escolares')
        setCentro('I.E. Jimenez Pimentel')
        setLogoUrl(null)
        setConfig(current => current ? { ...current, titulo: 'Elección de Municipios Escolares', centro: 'I.E. Jimenez Pimentel', logo_url: null } : current)
        toast({
          title: 'Centro educativo restablecido',
          description: 'Se restablecieron el título, el centro y el logo por defecto.',
          variant: 'success',
          duration: 4000
        })
      }

      await cerrarEliminarTodo()
    } finally {
      setEliminandoTodoCargando(false)
    }
  }

  const abierta = config?.eleccion_abierta === true

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
        <h2 className="text-xl font-bold text-white">Configuración de la elección</h2>
      </div>

      {cargando && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-400">
          Cargando configuración…
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!cargando && config && (
        <>
          <div
            className={`rounded-3xl border p-6 backdrop-blur-xl ${
              abierta
                ? 'border-emerald-400/30 bg-emerald-500/[0.07]'
                : 'border-amber-400/30 bg-amber-500/[0.07]'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Estado actual</p>
                <p className={`mt-2 flex items-center gap-2 text-xl font-bold ${abierta ? 'text-emerald-200' : 'text-amber-200'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${abierta ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden="true" />
                  {abierta ? 'Elección abierta' : 'Elección cerrada'}
                </p>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  {abierta
                    ? 'Los kioscos con enlace válido pueden verificar votantes y registrar votos.'
                    : 'Ningún kiosco puede registrar votos. La verificación de votantes tampoco está disponible para votar.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmando(!abierta)}
                disabled={cambiandoEstado}
                className={`rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
                  abierta
                    ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600'
                    : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600'
                }`}
              >
                {cambiandoEstado ? 'Aplicando…' : abierta ? 'Cerrar elección' : 'Abrir elección'}
              </button>
            </div>
          </div>

          <form
            onSubmit={guardar}
            className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          >
            <div>
              <h3 className="text-lg font-semibold text-white">Datos que verán los votantes</h3>
              <p className="mt-1 text-sm text-slate-400">
                Se muestran en la pantalla de votación y en el panel.
              </p>
            </div>

            <div>
              <label htmlFor="config-titulo" className="mb-1 block text-xs text-slate-400">
                Título de la elección
              </label>
              <input
                id="config-titulo"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                placeholder="Elección de Municipios Escolares"
              />
            </div>

            <div>
              <label htmlFor="config-centro" className="mb-1 block text-xs text-slate-400">
                Nombre del centro educativo
              </label>
              <input
                id="config-centro"
                value={centro}
                onChange={e => setCentro(e.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                placeholder="I.E. Jimenez Pimentel"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">Imagen de la I.E</span>
                <span className="text-[11px] text-slate-500">Opcional · se muestra en la pantalla de votación</span>
              </div>

              <input
                ref={archivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={seleccionarLogo}
                className="sr-only"
                aria-label="Seleccionar imagen de la institución educativa"
              />

              {logoUrl ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/95 p-1.5">
                    <img
                      src={logoUrl}
                      alt="Imagen de la institución educativa"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {nombreArchivo ?? 'Imagen de la I.E'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Optimizada automáticamente · 512 px · se conserva la transparencia
                    </p>
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
                      onClick={quitarLogo}
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
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setArrastrando(true)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    const siguiente = e.relatedTarget as Node | null
                    if (!siguiente || !e.currentTarget.contains(siguiente)) setArrastrando(false)
                  }}
                  onDrop={soltarLogo}
                  className={`group flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-5 py-6 text-center transition ${
                    arrastrando
                      ? 'border-blue-400/70 bg-blue-500/10'
                      : 'border-white/15 bg-black/20 hover:border-blue-300/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl border transition ${
                      arrastrando
                        ? 'border-blue-400/40 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-white/[0.05] text-slate-300 group-hover:text-blue-200'
                    }`}
                  >
                    <HugeiconsIcon icon={ImageUpload01Icon} size={20} strokeWidth={1.7} />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-medium text-white">
                      {arrastrando ? 'Suelta la imagen aquí' : 'Arrastra el logo aquí'}
                    </span>
                    <span className="block text-xs text-slate-500">
                      o selecciona un archivo desde tu equipo
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-200 transition group-hover:bg-white/[0.1]">
                    <HugeiconsIcon icon={ImageAdd01Icon} size={15} strokeWidth={1.8} />
                    Seleccionar imagen
                  </span>
                  <span className="text-[11px] text-slate-500">JPG, PNG o WebP · máx. 5 MB</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Los enlaces por mesa se generan en la sección «Mesas».
              </p>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </>
      )}

      {confirmando !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar cambio de estado"
            onClick={() => !cambiandoEstado && setConfirmando(null)}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmar-estado"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <h2 id="titulo-confirmar-estado" className="text-base font-semibold text-white">
              {confirmando ? 'Abrir la elección' : 'Cerrar la elección'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {confirmando
                ? 'Los kioscos con enlace válido podrán registrar votos de inmediato.'
                : 'Los kioscos dejarán de aceptar votos de inmediato. Esta acción no borra los votos ya registrados.'}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                disabled={cambiandoEstado}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void cambiarEstado(confirmando)}
                disabled={cambiandoEstado}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmando
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600'
                    : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600'
                }`}
              >
                {cambiandoEstado ? 'Aplicando…' : confirmando ? 'Abrir elección' : 'Cerrar elección'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eliminar todo */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-red-400/80 to-transparent" />
          <h3 className="text-lg font-semibold text-white">Eliminar todo (solo admin)</h3>
        </div>
        <p className="text-sm text-slate-400">
          Estas acciones borran datos permanentemente. Se requiere tu contraseña de administrador.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => { setEliminandoTodo('votantes'); setPasswordEliminarTodo(''); setErrorEliminarTodo(null) }}
            disabled={eliminandoTodoCargando}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />
              <span>Eliminar todos los votantes</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Borra todo el padrón</p>
          </button>
          <button
            type="button"
            onClick={() => { setEliminandoTodo('candidatos'); setPasswordEliminarTodo(''); setErrorEliminarTodo(null) }}
            disabled={eliminandoTodoCargando}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />
              <span>Eliminar todos los candidatos</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Borra todas las opciones</p>
          </button>
          <button
            type="button"
            onClick={() => { setEliminandoTodo('centro'); setPasswordEliminarTodo(''); setErrorEliminarTodo(null) }}
            disabled={eliminandoTodoCargando}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />
              <span>Restablecer centro educativo</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Título, I.E y logo por defecto</p>
          </button>
        </div>
        {errorEliminarTodo && <p className="mt-3 text-sm text-red-400">{errorEliminarTodo}</p>}
      </div>

      {eliminandoTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Cancelar eliminación masiva"
            onClick={cerrarEliminarTodo}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <form
            onSubmit={(e) => { e.preventDefault(); void ejecutarEliminarTodo() }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-eliminar-todo"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <h2 id="titulo-eliminar-todo" className="text-base font-semibold text-white">
              Confirmar eliminación masiva
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {eliminandoTodo === 'votantes'
                ? 'Se borrarán todos los votantes del padrón. Esta acción no se puede deshacer.'
                : eliminandoTodo === 'candidatos'
                  ? 'Se borrarán todos los candidatos. Esta acción no se puede deshacer.'
                  : 'Se restablecerán el título, el centro educativo y el logo a los valores por defecto.'}
            </p>
            <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/80">
              Para confirmar, escribe la contraseña de tu cuenta de administrador.
            </p>

            <label htmlFor="password-eliminar-todo" className="mt-4 mb-1 block text-xs text-slate-400">
              Contraseña
            </label>
            <input
              id="password-eliminar-todo"
              type="password"
              autoComplete="current-password"
              value={passwordEliminarTodo}
              onChange={(e) => setPasswordEliminarTodo(e.target.value)}
              autoFocus
              disabled={eliminandoTodoCargando}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
            />

            {errorEliminarTodo && <p className="mt-3 text-sm text-red-400">{errorEliminarTodo}</p>}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cerrarEliminarTodo}
                disabled={eliminandoTodoCargando}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eliminandoTodoCargando || passwordEliminarTodo.length === 0}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {eliminandoTodoCargando ? 'Procesando…' : 'Sí, eliminar todo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
