import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Evita la pantalla negra cuando una vista falla al renderizar.
 * Deja el error completo en consola (con el stack de componentes) para poder
 * localizarlo rápido, y muestra un mensaje legible con opción de recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[sistema-votacion] Error al renderizar:', error)
    console.error('[sistema-votacion] Stack de componentes:', info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-400/30 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-lg font-bold text-white">Algo falló en esta pantalla</h1>
          <p className="mt-2 text-sm text-slate-300">
            El error quedó registrado en la consola del navegador con el prefijo{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-red-200">[sistema-votacion]</code>.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-red-200">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:brightness-110"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/admin')}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Ir al panel
            </button>
          </div>
        </div>
      </main>
    )
  }
}
