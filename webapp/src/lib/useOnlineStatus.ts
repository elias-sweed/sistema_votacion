import { useEffect, useState } from 'react'

/**
 * Estado de conexión del navegador. Se usa para avisar al usuario y para
 * evitar que el kiosco intente registrar un voto sin internet.
 */
export function useOnlineStatus(): boolean {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const alConectar = () => setEnLinea(true)
    const alDesconectar = () => setEnLinea(false)

    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)

    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  }, [])

  return enLinea
}
