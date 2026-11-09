import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'
import Table01Icon from '@hugeicons/core-free-icons/Table01Icon'
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { limpiarCachePanel } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import Dock, { type DockItemData } from '../../components/ui/Dock'
import CandidatosPage from '../candidatos/CandidatosPage'
import ConfiguracionPage from '../configuracion/ConfiguracionPage'
import DashboardPage from '../dashboard/DashboardPage'
import MesasPage from '../mesas/MesasPage'
import PadronPage from '../padron/PadronPage'

type Vista = 'inicio' | 'candidatos' | 'mesas' | 'padron' | 'configuracion'

const SUBTITULOS: Record<Vista, string> = {
  inicio: 'Estado general del proceso electoral.',
  candidatos: 'Gestiona los candidatos y su estado.',
  mesas: 'Administra las mesas, sus enlaces y la participación.',
  padron: 'Importa y supervisa el padrón electoral.',
  configuracion: 'Abre o cierra la elección y define los datos del centro.'
}

const glyph = (icon: typeof UserGroupIcon) => <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.8} />

const VISTA_POR_SECCION: Record<string, Vista> = {
  candidatos: 'candidatos',
  mesas: 'mesas',
  padron: 'padron',
  configuracion: 'configuracion'
}

export default function PanelPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)

  const segmento = location.pathname.split('/').filter(Boolean)[1] ?? ''
  const vista: Vista = VISTA_POR_SECCION[segmento] ?? 'inicio'
  const setVista = (next: Vista) =>
    navigate(next === 'inicio' ? '/admin' : `/admin/${next}`)

  useEffect(() => {
    if (!confirmandoSalida) return
    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cerrandoSesion) setConfirmandoSalida(false)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [confirmandoSalida, cerrandoSesion])

  async function cerrarSesion() {
    setCerrandoSesion(true)
    const { error } = await supabase.auth.signOut()
    setCerrandoSesion(false)
    setConfirmandoSalida(false)

    if (error) {
      toast({
        title: 'No se pudo cerrar sesión',
        description: error.message,
        variant: 'error',
        duration: 6000
      })
      return
    }

    limpiarCachePanel()
    toast({
      title: 'Sesión cerrada',
      description: 'Has salido del panel de administración.',
      variant: 'success',
      duration: 3500
    })
    navigate('/login', { replace: true })
  }

  const items: DockItemData[] = [
    {
      icon: glyph(Home01Icon),
      label: 'Inicio',
      active: vista === 'inicio',
      onClick: () => setVista('inicio')
    },
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
    {
      icon: glyph(Settings01Icon),
      label: 'Configuración',
      active: vista === 'configuracion',
      onClick: () => setVista('configuracion')
    },
    { separator: true },
    {
      icon: glyph(Logout01Icon),
      label: 'Cerrar sesión',
      onClick: () => setConfirmandoSalida(true)
    }
  ]

  return (
    <main className="min-h-screen text-white px-5 py-8 pb-40 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <SectionHeader
            title="Panel de Control"
            description={SUBTITULOS[vista]}
          />
        </div>

        <AdminCard>
          {vista === 'inicio' && <DashboardPage onNavigate={setVista} />}
          {vista === 'candidatos' && <CandidatosPage />}
          {vista === 'mesas' && <MesasPage />}
          {vista === 'padron' && <PadronPage />}
          {vista === 'configuracion' && <ConfiguracionPage />}
        </AdminCard>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none">
        <div className="relative h-28 max-w-5xl mx-auto pointer-events-auto">
          <Dock
            items={items}
            baseItemSize={52}
            magnification={72}
            panelHeight={70}
            accentColor="#3b82f6"
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

      {confirmandoSalida && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Cancelar cierre de sesión"
            onClick={() => !cerrandoSesion && setConfirmandoSalida(false)}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cerrar-sesion"
            aria-describedby="desc-cerrar-sesion"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/10 text-blue-200">
                <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h2 id="titulo-cerrar-sesion" className="text-base font-semibold text-white">
                  Cerrar sesión
                </h2>
                <p id="desc-cerrar-sesion" className="mt-1 text-sm text-slate-400">
                  ¿Seguro que quieres salir del panel de administración?
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmandoSalida(false)}
                disabled={cerrandoSesion}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void cerrarSesion()}
                disabled={cerrandoSesion}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cerrandoSesion ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
