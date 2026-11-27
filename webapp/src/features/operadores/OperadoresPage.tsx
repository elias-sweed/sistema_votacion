import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { AdminButton } from '../../components/ui/AdminButton'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminModal } from '../../components/ui/AdminModal'
import { Badge } from '../../components/ui/Badge'
import { RevealSection } from '../../components/ui/RevealSection'

type Operador = {
  id: string
  email: string | null
  banned_until: string | null
  last_sign_in_at: string | null
}

type RespuestaOperadores = {
  success?: boolean
  operadores?: Operador[]
  error?: string
}

function estaActivo(operador: Operador): boolean {
  if (!operador.banned_until) return true
  return new Date(operador.banned_until).getTime() <= Date.now()
}

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState<Operador | null>(null)
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke<RespuestaOperadores>('voting-proxy', {
      body: { action: 'operadores', operacion: 'listar' },
    })

    if (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la lista de operadores.'))
    } else if (data?.error || data?.success === false) {
      setError(data?.error ?? 'No se pudo cargar la lista de operadores.')
    } else {
      setOperadores(data?.operadores ?? [])
    }
    setCargando(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function confirmarCambio() {
    if (!cambiando || procesando) return
    setProcesando(true)
    setError(null)
    setExito(null)

    const activar = !estaActivo(cambiando)
    const { data, error: err } = await supabase.functions.invoke<RespuestaOperadores>('voting-proxy', {
      body: {
        action: 'operadores',
        operacion: activar ? 'activar' : 'desactivar',
        id: cambiando.id,
      },
    })

    setProcesando(false)
    if (err) {
      setError(mensajeDeError(err, 'No se pudo actualizar la cuenta.'))
      return
    }
    if (data?.error || data?.success === false) {
      setError(data?.error ?? 'No se pudo actualizar la cuenta.')
      return
    }

    setExito(activar ? 'Cuenta activada.' : 'Cuenta desactivada y sesión cerrada.')
    setCambiando(null)
    await cargar()
  }

  return (
    <RevealSection className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Las cuentas con rol operador solo pueden gestionar candidatos, padrón y ver la mesa.
        </p>
        <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </AdminButton>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {exito && <p className="text-sm text-emerald-400">{exito}</p>}

      {!cargando && operadores.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay cuentas operador.</p>
      )}

      {operadores.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {operadores.map((operador) => {
            const activo = estaActivo(operador)
            return (
              <AdminCard key={operador.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {operador.email ?? 'Sin correo'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {operador.last_sign_in_at
                        ? `Último ingreso: ${new Date(operador.last_sign_in_at).toLocaleString('es-PE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}`
                        : 'Nunca ha ingresado'}
                    </p>
                  </div>
                  <Badge variant={activo ? 'success' : 'danger'}>
                    {activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <AdminButton
                  variant={activo ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setCambiando(operador)}
                >
                  {activo ? 'Desactivar' : 'Activar'}
                </AdminButton>
              </AdminCard>
            )
          })}
        </div>
      )}

      {cambiando && (
        <AdminModal
          open={cambiando !== null}
          onClose={() => { if (!procesando) setCambiando(null) }}
          title={estaActivo(cambiando) ? 'Desactivar operador' : 'Activar operador'}
          description={
            estaActivo(cambiando)
              ? 'La cuenta dejará de funcionar y se cerrarán sus sesiones abiertas.'
              : 'La cuenta volverá a tener acceso a sus secciones permitidas.'
          }
          confirmLabel={estaActivo(cambiando) ? 'Desactivar' : 'Activar'}
          confirmVariant={estaActivo(cambiando) ? 'danger' : 'primary'}
          tone={estaActivo(cambiando) ? 'warning' : 'primary'}
          loading={procesando}
          onConfirm={() => void confirmarCambio()}
        />
      )}
    </RevealSection>
  )
}
