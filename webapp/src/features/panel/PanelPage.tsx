import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { limpiarCachePanel } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { Sidebar } from '../../components/ui/Sidebar'
import { TopBar } from '../../components/ui/TopBar'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
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

const VISTA_POR_SECCION: Record<string, Vista> = {
  candidatos: 'candidatos',
  mesas: 'mesas',
  padron: 'padron',
  configuracion: 'configuracion'
}

const BREADCRUMB: Record<Vista, string> = {
  inicio: 'Panel > Inicio',
  candidatos: 'Panel > Candidatos',
  mesas: 'Panel > Mesas',
  padron: 'Panel > Padrón',
  configuracion: 'Panel > Configuración'
}

export default function PanelPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState(false)
  const [vistaAnterior, setVistaAnterior] = useState<Vista | null>(null)

  const segmento = location.pathname.split('/').filter(Boolean)[1] ?? ''
  const vista: Vista = VISTA_POR_SECCION[segmento] ?? 'inicio'

  useEffect(() => {
    setVistaAnterior(vista)
  }, [vista])

  const setVista = (next: Vista) => {
    navigate(next === 'inicio' ? '/admin' : `/admin/${next}`)
  }

  useEffect(() => {
    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCollapsed(false)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut()
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

  const mismoVista = vistaAnterior === vista

  return (
    <div className="min-h-screen text-white relative">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        vista={vista}
        onNavigate={setVista}
      />

      <main className={`transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'} min-h-screen px-5 py-4 sm:px-8`}>
        <TopBar breadcrumb={BREADCRUMB[vista]} onLogout={cerrarSesion} />

        <div className="max-w-6xl mx-auto mt-6 space-y-6">
          <SectionHeader
            title={vista === 'inicio' ? 'Panel de Control' : BREADCRUMB[vista]}
            description={vista === 'inicio' ? SUBTITULOS[vista] : SUBTITULOS[vista]}
          />

          <AdminCard className={mismoVista ? 'seccion-entrada' : 'seccion-entrada'} key={vista}>
            {vista === 'inicio' && <DashboardPage onNavigate={setVista} />}
            {vista === 'candidatos' && <CandidatosPage />}
            {vista === 'mesas' && <MesasPage />}
            {vista === 'padron' && <PadronPage />}
            {vista === 'configuracion' && <ConfiguracionPage />}
          </AdminCard>
        </div>
      </main>
    </div>
  )
}
