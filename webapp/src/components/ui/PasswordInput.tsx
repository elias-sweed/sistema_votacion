import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon'
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Clase adicional para el contenedor relativo. */
  wrapperClassName?: string
}

/** Input de contraseña con botón para mostrar u ocultar el valor. */
export function PasswordInput({ className = '', wrapperClassName = '', ...rest }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: '2.75rem', ...rest.style }}
      />
      <button
        type="button"
        onClick={() => setVisible((valor) => !valor)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-white"
      >
        <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
