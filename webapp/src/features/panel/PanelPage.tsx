import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { limpiarCachePanel } from '../../lib/panelCache'
import { useNavegarConTransicion } from '../../lib/navegacion'
import { useToast } from '../../components/ui/ToastProvider'
import { PanelDock } from '../../components/ui/PanelDock'
import type { DockSide } from '../../components/ui/Dock'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { AdminCard } from '../../components/ui/AdminCard'
import CandidatosPage from '../candidatos/CandidatosPage'
import ConfiguracionPage from '../configuracion/ConfiguracionPage'
import DashboardPage from '../dashboard/DashboardPage'
import MesasPage from '../mesas/MesasPage'
import PadronPage from '../padron/PadronPage'
import ResultadosPage from '../resultados/ResultadosPage'

type Vista = 'inicio' | 'candidatos' | 'mesas' | 'padron' | 'resultados' | 'configuracion'

const SUBTITULOS: Record<Vista, string> = {
  inicio: 'Estado general del proceso electoral.',
  candidatos: 'Gestiona los candidatos y su estado.',
  mesas: 'Un solo enlace para toda la votación.',
  padron: 'Agrega una persona, importa el Excel o revisa el padrón cargado.',
  resultados: 'Sigue el conteo de votos y la participación en vivo.',
  configuracion: 'Estado de la elección, seguridad y zona peligrosa.'
}

const VISTA_POR_SECCION: Record<string, Vista> = {
  candidatos: 'candidatos',
  mesas: 'mesas',
  padron: 'padron',
  resultados: 'resultados',
  configuracion: 'configuracion'
}

const BREADCRUMB: Record<Vista, string> = {
  inicio: 'Panel > Inicio',
  candidatos: 'Panel > Candidatos',
  mesas: 'Panel > Mesa principal',
  padron: 'Panel > Padrón',
  resultados: 'Panel > Resultados',
  configuracion: 'Panel > Configuración'
}

const POSICIONES_DOCK: DockSide[] = ['bottom', 'top', 'left', 'right']
const CLAVE_POSICION_DOCK = 'dock-posicion'

const PADDING_DOCK: Record<DockSide, string> = {
  bottom: 'px-5 pb-28 pt-5 sm:px-8',
  top: 'px-5 pb-5 pt-24 sm:px-8',
  left: 'py-5 pl-24 pr-5 sm:pl-28',
  right: 'py-5 pr-24 pl-5 sm:pr-28'
}

export default function PanelPage() {
  const location = useLocation()
  const navigate = useNavegarConTransicion()
  const toast = useToast()
  const [posicionDock, setPosicionDock] = useState<DockSide>(() => {
    const guardada = localStorage.getItem(CLAVE_POSICION_DOCK) as DockSide | null
    return guardada && POSICIONES_DOCK.includes(guardada) ? guardada : 'bottom'
  })

  useEffect(() => {
    localStorage.setItem(CLAVE_POSICION_DOCK, posicionDock)
  }, [posicionDock])

  const segmento = location.pathname.split('/').filter(Boolean)[1] ?? ''
  const subsegmento = location.pathname.split('/').filter(Boolean)[2] ?? ''
  const vista: Vista = VISTA_POR_SECCION[segmento] ?? 'inicio'

  const setVista = (next: Vista, sub?: string) => {
    const base = next === 'inicio' ? '/admin' : `/admin/${next}`
    navigate(sub ? `${base}/${sub}` : base)
  }

  useEffect(() => {
    const atajos: Record<string, Vista> = {
      '1': 'inicio',
      '2': 'candidatos',
      '3': 'mesas',
      '4': 'padron',
      '5': 'configuracion',
      '6': 'resultados'
    }

    const alPresionar = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const escribiendo = target !== null && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )

      // Los atajos no deben interferir mientras se escribe ni con un modal abierto.
      if (escribiendo) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return

      const destino = atajos[event.key]
      if (destino) {
        event.preventDefault()
        navigate(destino === 'inicio' ? '/admin' : `/admin/${destino}`)
        return
      }

      if (event.key === '/') {
        const buscador = document.querySelector<HTMLInputElement>('[data-busqueda-padron]')
        if (buscador) {
          event.preventDefault()
          buscador.focus()
          buscador.select()
        }
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [navigate])

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

  return (
    <div className="min-h-screen text-white">
      <PanelDock
        vista={vista}
        subvista={subsegmento}
        onNavigate={setVista}
        position={posicionDock}
        onLogout={cerrarSesion}
      />

      <main data-dock={posicionDock} className={`min-h-screen ${PADDING_DOCK[posicionDock]}`}>
        <div className="max-w-6xl mx-auto mt-6 space-y-6">
          <SectionHeader
            title={vista === 'inicio' ? 'Panel de Control' : BREADCRUMB[vista]}
            description={SUBTITULOS[vista]}
          />

          <AdminCard className="seccion-entrada" key={vista}>
            {vista === 'inicio' && <DashboardPage onNavigate={setVista} />}
            {vista === 'candidatos' && <CandidatosPage />}
            {vista === 'mesas' && <MesasPage />}
            {vista === 'padron' && <PadronPage />}
            {vista === 'resultados' && <ResultadosPage onNavigate={setVista} />}
            {vista === 'configuracion' && (
              <ConfiguracionPage
                posicionDock={posicionDock}
                onPosicionDockChange={setPosicionDock}
              />
            )}
          </AdminCard>
        </div>
      </main>
    </div>
  )
}
