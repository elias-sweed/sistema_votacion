'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon'
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon'
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon'

export type AdminModalTone = 'danger' | 'primary' | 'success' | 'warning'

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
  children?: ReactNode
  /** Etiqueta del botón de acción primaria */
  confirmLabel?: string
  /** Etiqueta del botón de cancelar */
  cancelLabel?: string
  /** Si la acción está en proceso (deshabilita ambos botones) */
  loading?: boolean
  /** Variante del botón de acción: 'danger' | 'primary' */
  confirmVariant?: 'danger' | 'primary'
  /** Tono del icono circular semántico. */
  tone?: AdminModalTone
  /** Callback al hacer clic en el botón de acción */
  onConfirm: () => void
  /** id para aria-labelledby */
  modalId?: string
  /** Clases adicionales para el contenedor (por ejemplo, un ancho mayor). */
  className?: string
  /** Si se indica, el botón de confirmación envía ese formulario. */
  confirmFormId?: string
}

const TONOS: Record<AdminModalTone, { icono: typeof AlertCircleIcon; clase: string }> = {
  danger: { icono: AlertCircleIcon, clase: 'border-red-400/40 bg-red-500/10 text-red-200' },
  primary: { icono: InformationCircleIcon, clase: 'border-blue-400/40 bg-blue-500/10 text-blue-200' },
  success: { icono: CheckmarkCircle02Icon, clase: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' },
  warning: { icono: AlertCircleIcon, clase: 'border-amber-400/40 bg-amber-500/10 text-amber-200' }
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
  tone = confirmVariant === 'danger' ? 'danger' : 'primary',
  onConfirm,
  modalId = 'admin-modal',
  className = '',
  confirmFormId
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  const handleClose = useCallback(() => {
    // Restaurar foco al elemento anterior antes de desmontar
    if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus()
      previouslyFocusedElement.current = null
    }
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => {
    if (loading) return
    handleClose()
  }, [handleClose, loading])

  // Abrir: guardar foco, abrir modal, poner foco en el contenedor.
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
        requestClose()
      }
    }

    container.addEventListener('keydown', handleTab)
    document.addEventListener('keydown', handleEsc)

    return () => {
      container.removeEventListener('keydown', handleTab)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, requestClose])

  if (!open) return null

  const tono = TONOS[tone]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Cerrar modal"
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalId}
        aria-describedby={description ? `${modalId}-desc` : undefined}
        className={`relative w-full ${className || 'max-w-sm'} rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] animate-modal-in`}
        style={{
          animation: 'modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full border ${tono.clase}`}>
            <HugeiconsIcon icon={tono.icono} size={20} strokeWidth={1.8} />
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
            onClick={requestClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type={confirmFormId ? 'submit' : 'button'}
            form={confirmFormId}
            autoFocus={!children}
            onClick={confirmFormId ? undefined : (e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
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
