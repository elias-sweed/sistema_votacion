import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import { supabase } from '../../lib/supabase'
import Dock, { type DockItemData } from '../../components/ui/Dock'
import MaskedHeading from '../../components/ui/MaskedHeading'
import CandidatosPage from '../candidatos/CandidatosPage'
import MesasPage from '../mesas/MesasPage'
import PadronPage from '../padron/PadronPage'

type Vista = 'candidatos' | 'mesas' | 'padron'

const glyph = (icon: typeof UserGroupIcon) => <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.8} />

export default function PanelPage() {
  const [vista, setVista] = useState<Vista>('candidatos')

  const items: DockItemData[] = [
    {
      icon: glyph(UserGroupIcon),
      label: 'Candidatos',
      active: vista === 'candidatos',
      onClick: () => setVista('candidatos')
    },
    {
      icon: glyph(Table01Icon),
      label: 'Mesas',
      active: vista === 'mesas',
      onClick: () => setVista('mesas')
    },
    {
      icon: glyph(IdCardIcon),
      label: 'Padrón',
      active: vista === 'padron',
      onClick: () => setVista('padron')
    },
    { separator: true },
    {
      icon: glyph(Logout01Icon),
      label: 'Cerrar sesión',
      onClick: () => supabase.auth.signOut()
    }
  ]

  return (
    <main className="min-h-screen text-white px-5 py-8 pb-40 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <MaskedHeading
            tag="h1"
            text="Panel de Control"
            mediaType="mesh"
            fillScale={1.25}
            parallax={26}
            reveal="scale"
            trigger="mount"
            duration={1.1}
            stagger={0.09}
            drift={18}
            align="left"
            brightness={1.15}
            saturation={1.2}
            weight={800}
            tracking={-0.04}
            lineHeight={1}
            textScale={0.075}
          />
          <p className="mt-2 text-sm text-slate-400">Gestiona candidatos, mesas y padrón electoral.</p>
        </div>

        {vista === 'candidatos' && <CandidatosPage />}
        {vista === 'mesas' && <MesasPage />}
        {vista === 'padron' && <PadronPage />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none">
        <div className="relative h-28 max-w-5xl mx-auto pointer-events-auto">
          <Dock
            items={items}
            baseItemSize={52}
            magnification={72}
            panelHeight={70}
            accentColor="#e8c47a"
            badgeColor="#ef4444"
            position="bottom"
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
      </div>
    </main>
  )
}
