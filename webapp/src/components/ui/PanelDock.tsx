'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import ChartBarBigIcon from '@hugeicons/core-free-icons/ChartBarBigIcon'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import Dock from './Dock'
import type { DockItemData, DockSide } from './Dock'

export type Vista = 'inicio' | 'candidatos' | 'mesas' | 'padron' | 'resultados' | 'configuracion'

type PanelDockProps = {
  vista: Vista
  onNavigate: (vista: Vista) => void
  position: DockSide
  onLogout: () => void
}

const ITEMS: Array<{ vista: Vista; label: string; icon: typeof UserGroupIcon }> = [
  { vista: 'inicio', label: 'Inicio', icon: Home01Icon },
  { vista: 'candidatos', label: 'Candidatos', icon: UserGroupIcon },
  { vista: 'mesas', label: 'Mesas', icon: Table01Icon },
  { vista: 'padron', label: 'Padrón', icon: IdCardIcon },
  { vista: 'resultados', label: 'Resultados', icon: ChartBarBigIcon },
  { vista: 'configuracion', label: 'Configuración', icon: Settings01Icon }
]

const glyph = (icon: typeof UserGroupIcon) => <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.8} />

export function PanelDock({ vista, onNavigate, position, onLogout }: PanelDockProps) {
  const items: DockItemData[] = [
    ...ITEMS.map((item) => ({
      icon: glyph(item.icon),
      label: item.label,
      active: vista === item.vista,
      onClick: () => onNavigate(item.vista)
    })),
    { separator: true },
    { icon: glyph(Logout01Icon), label: 'Cerrar sesión', onClick: onLogout }
  ]

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <Dock
        className="pointer-events-auto"
        items={items}
        position={position}
        theme="dark"
        baseItemSize={50}
        magnification={70}
        panelHeight={68}
        accentColor="#0a84ff"
        badgeColor="#ff453a"
        distance={200}
        gap={10}
        roundness={0.5}
        bounce
        autoHide={false}
        tiles
        showLabels
        showIndicators
        showBadges
      />
    </div>
  )
}

export default PanelDock
