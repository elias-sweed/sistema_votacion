'use client'

import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'

/**
 * Barra de progreso de lectura: se pega al scroll con un resorte y no
 * intercepta clics. Se oculta por completo con prefers-reduced-motion.
 */
export function ScrollProgress() {
  const reducido = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const escala = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001
  })

  if (reducido) return null

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-linear-to-r from-blue-400 via-sky-300 to-blue-600"
      style={{ scaleX: escala }}
    />
  )
}

export default ScrollProgress
