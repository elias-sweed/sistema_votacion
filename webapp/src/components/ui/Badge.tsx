export function Badge({
  children,
  variant = 'default'
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'danger' | 'info'
}) {
  const variants: Record<string, string> = {
    default: 'bg-white/[0.06] text-slate-300',
    success: 'bg-emerald-400/15 text-emerald-200',
    danger: 'bg-red-500/15 text-red-200',
    info: 'bg-blue-400/15 text-blue-200'
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[variant]}`}>
      {children}
    </span>
  )
}
