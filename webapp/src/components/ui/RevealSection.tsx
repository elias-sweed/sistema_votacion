'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'

type RevealSectionProps = HTMLMotionProps<'section'> & {
  delay?: number
}

/**
 * Entrada estilo Framer/Apple: fade + elevación + escala muy ligera con
 * resorte. Solo transform/opacity y una sola vez por sección.
 */
export function RevealSection({ children, className = '', delay = 0, ...props }: RevealSectionProps) {
  const reducido = useReducedMotion()

  return (
    <motion.section
      {...props}
      className={className}
      initial={reducido ? false : { opacity: 0, y: 30, scale: 0.985 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.1, margin: '0px 0px -6% 0px' }}
      transition={
        reducido
          ? undefined
          : { type: 'spring', stiffness: 120, damping: 22, mass: 0.85, delay }
      }
    >
      {children}
    </motion.section>
  )
}

export default RevealSection
