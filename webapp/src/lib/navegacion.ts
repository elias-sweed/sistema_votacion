import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { NavigateOptions, To } from 'react-router-dom'

/**
 * BrowserRouter (modo declarativo) no aplica la opción `viewTransition` de
 * React Router, así que envolvemos el cambio de ruta con la View Transitions
 * API directamente. `flushSync` garantiza que el DOM nuevo esté listo antes de
 * capturar el fotograma final.
 */
export function useNavegarConTransicion(): (
  to: To,
  options?: NavigateOptions
) => void {
  const navigate = useNavigate()

  return useCallback((to: To, options?: NavigateOptions) => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    if (reducido || typeof document.startViewTransition !== 'function') {
      navigate(to, options)
      return
    }

    document.startViewTransition(() => {
      flushSync(() => navigate(to, options))
    })
  }, [navigate])
}
