import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import SwipeToast from './SwipeToast'

export type ToastVariant = 'success' | 'error' | 'info'

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
  success: '#22c55e',
  error: '#ef4444',
  info: '#38bdf8'
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
        {items.map(item => (
          <div key={item.id} className="pointer-events-auto w-[348px] max-w-[calc(100vw-32px)]">
            <SwipeToast
              inline
              title={item.title}
              description={item.description}
              actionLabel={item.actionLabel}
              onAction={item.onAction}
              duration={item.duration ?? 4000}
              fuseColor={ACCENTS[item.variant ?? 'info']}
              background="#1e293b"
              color="#f8fafc"
              width={348}
              radius={12}
              onClose={() => remove(item.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context.toast
}
