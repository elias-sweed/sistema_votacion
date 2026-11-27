import { motion } from 'motion/react'
import type { Variants } from 'motion/react'

export function StatCard({
  label,
  value,
  subtitle,
  className = '',
  valueClassName = 'text-white',
  variants
}: {
  label: string
  value: string | number
  subtitle?: string
  className?: string
  valueClassName?: string
  variants?: Variants
}) {
  return (
    <motion.div
      variants={variants}
      className={`rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl space-y-2 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${valueClassName}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </motion.div>
  )
}
