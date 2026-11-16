import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Alert01Icon from '@hugeicons/core-free-icons/Alert01Icon'
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon'
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon'
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon'
import SwipeToast from './SwipeToast'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

type ToastItem = ToastOptions & { id: number }

type ToastContextValue = {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ACCENTS: Record<ToastVariant, string> = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
}

const FONDOS: Record<ToastVariant, string> = {
  success: '#052e26',
  error: '#3f0d0d',
  warning: '#3b2a06',
  info: '#0b1c38'
}

const ICONOS: Record<ToastVariant, ReactNode> = {
  success: <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.9} />,
  error: <HugeiconsIcon icon={AlertCircleIcon} size={18} strokeWidth={1.9} />,
  warning: <HugeiconsIcon icon={Alert01Icon} size={18} strokeWidth={1.9} />,
  info: <HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.9} />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const sequence = useRef(0)

  const toast = useCallback((options: ToastOptions) => {
    sequence.current += 1
    const id = sequence.current
    setItems(prev => [...prev, { id, ...options }])
  }, [])

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex flex-col items-end p-4">
        {items.map(item => {
          const variant = item.variant ?? 'info'
          return (
            <div key={item.id} className="pointer-events-auto w-[348px] max-w-[calc(100vw-32px)]">
              <SwipeToast
                inline
                title={item.title}
                description={item.description}
                icon={ICONOS[variant]}
                actionLabel={item.actionLabel}
                onAction={item.onAction}
                duration={item.duration ?? 4000}
                fuseColor={ACCENTS[variant]}
                background={FONDOS[variant]}
                color="#f8fafc"
                width={348}
                radius={12}
                onClose={() => remove(item.id)}
              />
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context.toast
}
