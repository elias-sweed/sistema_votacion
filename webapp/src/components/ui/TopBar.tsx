'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type TopBarProps = {
  breadcrumb: string
  onLogout: () => void
}

export function TopBar({ breadcrumb, onLogout }: TopBarProps) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 py-3 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-400" aria-hidden="true" />
        <h1 className="text-sm font-semibold text-white tracking-tight">Panel de Control</h1>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
        <span>{breadcrumb}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03]">
          <span className="text-slate-400">{email ?? 'admin'}</span>
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-slate-400 hover:bg-white/[0.05] hover:text-white transition"
        >
          <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.8} />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}
