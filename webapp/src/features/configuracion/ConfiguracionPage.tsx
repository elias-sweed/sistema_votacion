import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { useToast } from '../../components/ui/ToastProvider'

type Config = {
  eleccion_abierta: boolean
  titulo: string
  centro: string
}

export default function ConfiguracionPage() {
  const toast = useToast()
  const [config, setConfig] = useState<Config | null>(null)
  const [titulo, setTitulo] = useState('')
  const [centro, setCentro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmando, setConfirmando] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('configuracion')
      .select('eleccion_abierta, titulo, centro')
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
  }

  useEffect(() => {
    void cargar()
  }, [])

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
      .update({ titulo: tituloTrim, centro: centroTrim })
      .eq('id', 1)
    setGuardando(false)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la configuración.'))
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'error', duration: 6000 })
      return
    }

    setConfig(current => current ? { ...current, titulo: tituloTrim, centro: centroTrim } : current)
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
    </section>
  )
}
