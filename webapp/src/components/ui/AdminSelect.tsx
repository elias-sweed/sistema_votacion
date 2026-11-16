import { useEffect, useId, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon'

export type AdminSelectOption = {
  value: string
  label: string
}

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: AdminSelectOption[]
  /** Texto que se muestra cuando no hay valor seleccionado. */
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * Select custom con estilos dark-mode, navegación por teclado y cierre al
 * hacer clic fuera. Reemplaza a los `<select>` y `<datalist>` nativos del panel.
 */
export function AdminSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  ariaLabel
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(-1)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const listaId = useId()

  const opciones = placeholder !== undefined
    ? [{ value: '', label: placeholder }, ...options]
    : options
  const seleccion = opciones.find((opcion) => opcion.value === value) ?? null

  function abrir() {
    if (disabled) return
    const indice = opciones.findIndex((opcion) => opcion.value === value)
    setResaltado(indice >= 0 ? indice : 0)
    setAbierto(true)
  }

  function cerrar(devolverFoco = false) {
    setAbierto(false)
    setResaltado(-1)
    if (devolverFoco) botonRef.current?.focus()
  }

  function seleccionar(opcion: AdminSelectOption) {
    onChange(opcion.value)
    cerrar(true)
  }

  useEffect(() => {
    if (!abierto) return
    const alTocarFuera = (event: PointerEvent) => {
      if (!contenedorRef.current?.contains(event.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', alTocarFuera)
    return () => document.removeEventListener('pointerdown', alTocarFuera)
  }, [abierto])

  function alPresionarTecla(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!abierto) abrir()
        else setResaltado((indice) => Math.min(opciones.length - 1, indice + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!abierto) abrir()
        else setResaltado((indice) => Math.max(0, indice - 1))
        break
      case 'Home':
        if (abierto) {
          event.preventDefault()
          setResaltado(0)
        }
        break
      case 'End':
        if (abierto) {
          event.preventDefault()
          setResaltado(opciones.length - 1)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!abierto) {
          abrir()
        } else {
          const opcion = opciones[resaltado]
          if (opcion) seleccionar(opcion)
        }
        break
      case 'Escape':
        if (abierto) {
          event.preventDefault()
          event.stopPropagation()
          cerrar(true)
        }
        break
      case 'Tab':
        if (abierto) cerrar()
        break
      default:
        break
    }
  }

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <button
        ref={botonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-controls={listaId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={alPresionarTecla}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-left text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${seleccion && seleccion.value !== '' ? 'text-white' : 'text-slate-500'}`}>
          {seleccion?.label ?? placeholder ?? 'Seleccionar'}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={1.8}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        >
          {opciones.map((opcion, indice) => {
            const activo = opcion.value === value
            const enfocado = indice === resaltado
            return (
              <li
                key={opcion.value || `vacio-${indice}`}
                role="option"
                aria-selected={activo}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setResaltado(indice)}
                onClick={() => seleccionar(opcion)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm transition ${
                  enfocado ? 'bg-white/[0.08] text-white' : 'text-slate-300'
                } ${activo ? 'font-semibold text-blue-200' : ''}`}
              >
                {opcion.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
