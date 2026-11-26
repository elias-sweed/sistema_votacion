'use client'

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollProgress } from './ScrollProgress'

function prefiereMovimientoReducido() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Anclas internas y transiciones globales. El reveal de secciones lo hace
 * RevealSection con Framer Motion; las transiciones de ruta las hace
 * useNavegarConTransicion con la View Transitions API.
 */
export function TransicionesSuaves() {
  const { pathname, hash } = useLocation()
  const navegar = useNavigate()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }

    const id = decodeURIComponent(hash.replace(/^#/, ''))
    const destino = document.getElementById(id)
    if (!destino) return

    const cuadro = requestAnimationFrame(() => {
      destino.scrollIntoView({
        behavior: prefiereMovimientoReducido() ? 'auto' : 'smooth',
        block: 'start'
      })
    })
    return () => cancelAnimationFrame(cuadro)
  }, [pathname, hash])

  useEffect(() => {
    const alHacerClic = (evento: MouseEvent) => {
      if (
        evento.defaultPrevented ||
        evento.button !== 0 ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey ||
        evento.altKey
      ) {
        return
      }

      const objetivo = evento.target as Element | null
      const enlace = objetivo?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      const href = enlace?.getAttribute('href')
      if (!href || href === '#') return

      const id = decodeURIComponent(href.slice(1))
      if (!document.getElementById(id)) return

      evento.preventDefault()
      navegar({ hash: `#${id}` })
    }

    document.addEventListener('click', alHacerClic)
    return () => document.removeEventListener('click', alHacerClic)
  }, [navegar])

  return <ScrollProgress />
}

export default TransicionesSuaves
