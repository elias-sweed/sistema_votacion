'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type Props = {
  /** Si el modal está abierto */
  open: boolean
  /** Callback al cerrar (Escape, clic en overlay o botón cancelar) */
  onClose: () => void
  /** Título del modal */
  title: string
  /** Descripción opcional debajo del título */
  description?: ReactNode
  /** Contenido principal del modal */
  children: ReactNode
  /** Etiqueta del botón de acción primaria */
  confirmLabel?: string
  /** Etiqueta del botón de cancelar */
  cancelLabel?: string
  /** Si la acción está en proceso (deshabilita ambos botones) */
  loading?: boolean
  /** Variante del botón de acción: 'danger' | 'primary' */
  confirmVariant?: 'danger' | 'primary'
  /** Callback al hacer clic en el botón de acción */
  onConfirm: () => void
  /** id para aria-labelledby */
  modalId?: string
}

export function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  loading = false,
  confirmVariant = 'primary',
  onConfirm,
  modalId = 'admin-modal'
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  const handleClose = useCallback(() => {
    // Restaurar foco al elemento anterior antes de desmontar
    if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus()
      previouslyFocusedElement.current = null
    }
    onClose()
  }, [onClose])

  // Abrir: guardar foco, abrir modal, poner foco en botón confirmar
  useEffect(() => {
    if (!open) return

    const active = document.activeElement as HTMLElement | null
    previouslyFocusedElement.current = active ?? document.body

    // Evitar scroll detrás del modal
    document.body.style.overflow = 'hidden'

    containerRef.current?.focus()

    return () => {
      document.body.style.overflow = ''
      // Restaurar foco al cerrar
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus()
        previouslyFocusedElement.current = null
      }
    }
  }, [open])

  // Trap de foco dentro del modal mientras está abierto
  useEffect(() => {
    if (!open || !containerRef.current) return

    const container = containerRef.current
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last || document.activeElement === container) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    container.addEventListener('keydown', handleTab)
    document.addEventListener('keydown', handleEsc)

    return () => {
      container.removeEventListener('keydown', handleTab)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, handleClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Cerrar modal"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalId}
        aria-describedby={`${modalId}-desc`}
        className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] animate-modal-in"
        style={{
          animation: 'modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 text-red-200">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h2 id={modalId} className="text-base font-semibold text-white">
              {title}
            </h2>
            {description && (
              <p id={`${modalId}-desc`} className="mt-1 text-sm text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">{children}</div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className={`flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            ref={confirmBtnRef}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600'
                : 'bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)]'
            }`}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
