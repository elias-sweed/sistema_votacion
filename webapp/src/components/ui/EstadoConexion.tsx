import { useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../../lib/useOnlineStatus'

/**
 * Aviso global de falta de conexión. En el kiosco se muestra un aviso propio
 * dentro del flujo de votación, por eso aquí se omite en /votar.
 */
export function EstadoConexion() {
  const enLinea = useOnlineStatus()
  const { pathname } = useLocation()

  if (enLinea || pathname.startsWith('/votar')) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950/95 px-4 py-2 text-xs font-medium text-amber-100 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
      Sin conexión: los datos se actualizarán cuando vuelva internet.
    </div>
  )
}
