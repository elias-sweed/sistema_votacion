import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { AdminButton } from '../../components/ui/AdminButton'
import { AdminCard } from '../../components/ui/AdminCard'
import { Badge } from '../../components/ui/Badge'
import { RevealSection } from '../../components/ui/RevealSection'

type Movimiento = {
  id: number
  creado_en: string
  actor_email: string | null
  rol: string | null
  accion: string
  entidad: string
  entidad_id: string | null
  detalle: Record<string, unknown> | null
}

const ETIQUETAS_ACCION: Record<string, string> = {
  alta: 'Alta',
  editar: 'Edición',
  activar: 'Activación',
  desactivar: 'Desactivación',
  eliminar: 'Eliminación',
}

const ETIQUETAS_ENTIDAD: Record<string, string> = {
  candidato: 'Candidato',
  votante: 'Padrón',
  operador: 'Cuenta operador',
}

function resumenDetalle(detalle: Record<string, unknown> | null): string {
  if (!detalle) return ''
  const nombre = detalle.nombre
  const email = detalle.email
  if (typeof nombre === 'string' && nombre.trim()) return nombre
  if (typeof email === 'string' && email.trim()) return email
  return ''
}

export default function AuditoriaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('auditoria_operador')
      .select('id, creado_en, actor_email, rol, accion, entidad, entidad_id, detalle')
      .order('creado_en', { ascending: false })
      .limit(200)

    if (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la auditoría.'))
    } else {
      setMovimientos((data ?? []) as Movimiento[])
    }
    setCargando(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  return (
    <RevealSection className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Altas, ediciones, activaciones, desactivaciones y eliminaciones realizadas en el panel.
        </p>
        <AdminButton variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </AdminButton>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {!cargando && movimientos.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay movimientos registrados.</p>
      )}

      {movimientos.length > 0 && (
        <AdminCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-white/4 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Movimiento</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="text-slate-300">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {new Date(movimiento.creado_en).toLocaleString('es-PE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={movimiento.accion === 'eliminar' ? 'danger' : 'info'}>
                          {ETIQUETAS_ACCION[movimiento.accion] ?? movimiento.accion}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {ETIQUETAS_ENTIDAD[movimiento.entidad] ?? movimiento.entidad}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-white">{resumenDetalle(movimiento.detalle)}</span>
                      {movimiento.entidad_id && (
                        <span className="ml-2 text-slate-500">{movimiento.entidad_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {movimiento.actor_email ?? '—'}
                      {movimiento.rol && <span className="ml-2 text-slate-600">({movimiento.rol})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </RevealSection>
  )
}
