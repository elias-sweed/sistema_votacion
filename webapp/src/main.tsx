import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// Logs con prefijo para encontrar fallos rápido en la consola del navegador.
window.addEventListener('error', (evento) => {
  console.error('[sistema-votacion] Error global:', evento.error ?? evento.message)
})
window.addEventListener('unhandledrejection', (evento) => {
  console.error('[sistema-votacion] Promesa no manejada:', evento.reason)
})

// El service worker solo precachea el shell (HTML, JS, CSS, fuentes e iconos).
// No se cachean consultas a Supabase ni votos: el kiosco siempre vota online.
if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </ErrorBoundary>,
)
