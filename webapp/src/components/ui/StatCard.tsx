export function StatCard({
  label,
  value,
  subtitle,
  className = ''
}: {
  label: string
  value: string | number
  subtitle?: string
  className?: string
}) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl space-y-2 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-white">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
