'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'

type Vista = 'inicio' | 'candidatos' | 'mesas' | 'padron' | 'configuracion'

type SidebarProps = {
  collapsed: boolean
  setCollapsed: (c: boolean) => void
  vista: Vista
  onNavigate: (v: Vista) => void
}

const ITEMS: Array<{
  vista: Vista
  label: string
  icon: typeof UserGroupIcon
}> = [
  { vista: 'inicio', label: 'Inicio', icon: Home01Icon },
  { vista: 'candidatos', label: 'Candidatos', icon: UserGroupIcon },
  { vista: 'mesas', label: 'Mesas', icon: Table01Icon },
  { vista: 'padron', label: 'Padrón', icon: IdCardIcon },
  { vista: 'configuracion', label: 'Configuración', icon: Settings01Icon }
]

const glyph = (icon: typeof UserGroupIcon) => <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.8} />

export function Sidebar({ collapsed, setCollapsed, vista, onNavigate }: SidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-56'
      } bg-slate-950/95 backdrop-blur-xl border-r border-white/10`}
    >
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-8 h-8 rounded-lg p-1 text-slate-400 hover:bg-white/[0.05] hover:text-white transition flex items-center justify-center"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {ITEMS.map((item) => {
          const active = vista === item.vista
          return (
            <button
              key={item.vista}
              onClick={() => onNavigate(item.vista)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                active
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-200'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center">
                <div className={`${active ? 'bg-blue-500/30' : 'bg-white/[0.05]'}`}>
                  {glyph(item.icon)}
                </div>
              </div>
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
