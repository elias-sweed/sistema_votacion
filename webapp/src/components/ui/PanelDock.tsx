'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon'
import ChartBarBigIcon from '@hugeicons/core-free-icons/ChartBarBigIcon'
import FileAddIcon from '@hugeicons/core-free-icons/FileAddIcon'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'
import Shield01Icon from '@hugeicons/core-free-icons/Shield01Icon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import Dock from './Dock'
import type { DockItemData, DockMenuItem, DockSide } from './Dock'
import { puedeVerSeccion, type RolPanel } from '../../lib/roles'

export type Vista =
  | 'inicio'
  | 'candidatos'
  | 'mesas'
  | 'padron'
  | 'resultados'
  | 'configuracion'
  | 'auditoria'
  | 'operadores'

type PanelDockProps = {
  vista: Vista
  /** Subpantalla activa, por ejemplo dentro de Padrón. */
  subvista?: string
  rol?: RolPanel | null
  onNavigate: (vista: Vista, sub?: string) => void
  position: DockSide
  onLogout: () => void
}

const ITEMS: Array<{ vista: Vista; label: string; icon: typeof UserGroupIcon }> = [
  { vista: 'inicio', label: 'Inicio', icon: Home01Icon },
  { vista: 'candidatos', label: 'Candidatos', icon: UserGroupIcon },
  { vista: 'mesas', label: 'Mesa', icon: Table01Icon },
  { vista: 'padron', label: 'Padrón', icon: IdCardIcon },
  { vista: 'resultados', label: 'Resultados', icon: ChartBarBigIcon },
  { vista: 'configuracion', label: 'Configuración', icon: Settings01Icon },
  { vista: 'auditoria', label: 'Auditoría', icon: Shield01Icon },
  { vista: 'operadores', label: 'Operadores', icon: UserAdd01Icon }
]

const glyph = (icon: typeof UserGroupIcon) => <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.8} />

export function PanelDock({ vista, subvista, rol, onNavigate, position, onLogout }: PanelDockProps) {
  // Acciones rápidas del dock, como el menú contextual de iOS: al tocar Padrón
  // se eligen las tres pantallas en las que está dividido.
  const menuPadron: DockMenuItem[] = [
    {
      label: 'Agregar manualmente',
      icon: glyph(UserAdd01Icon),
      checked: vista === 'padron' ? subvista === 'agregar' : undefined,
      onClick: () => onNavigate('padron', 'agregar')
    },
    {
      label: 'Importar desde Excel',
      icon: glyph(FileAddIcon),
      checked: vista === 'padron' ? subvista === 'excel' : undefined,
      onClick: () => onNavigate('padron', 'excel')
    },
    {
      label: 'Ver padrón cargado',
      icon: glyph(IdCardIcon),
      checked: vista === 'padron' ? subvista === 'lista' : undefined,
      onClick: () => onNavigate('padron', 'lista')
    }
  ]

  const menuConfiguracion: DockMenuItem[] = [
    {
      label: 'General',
      icon: glyph(Settings01Icon),
      checked: vista === 'configuracion' ? subvista === 'general' : undefined,
      onClick: () => onNavigate('configuracion', 'general')
    },
    {
      label: 'Seguridad',
      icon: glyph(Shield01Icon),
      checked: vista === 'configuracion' ? subvista === 'seguridad' : undefined,
      onClick: () => onNavigate('configuracion', 'seguridad')
    },
    {
      label: 'Zona peligrosa',
      icon: glyph(Alert02Icon),
      checked: vista === 'configuracion' ? subvista === 'peligro' : undefined,
      onClick: () => onNavigate('configuracion', 'peligro')
    }
  ]

  const visibles = ITEMS.filter((item) => puedeVerSeccion(rol ?? null, item.vista))

  const items: DockItemData[] = [
    ...visibles.map((item) => ({
      icon: glyph(item.icon),
      label: item.label,
      active: vista === item.vista,
      onClick: () => onNavigate(item.vista),
      ...(item.vista === 'padron' ? { menu: menuPadron, menuOnClick: true } : {}),
      ...(item.vista === 'configuracion' ? { menu: menuConfiguracion, menuOnClick: true } : {})
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
