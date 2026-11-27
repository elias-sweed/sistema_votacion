import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

export function AdminButton({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled = false,
  ...rest
}: {
  variant?: Variant
  size?: Size
  children: ReactNode
  className?: string
  disabled?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm'
  }
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] hover:brightness-110',
    secondary: 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]',
    danger: 'border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
  }
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${sizeClasses[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
