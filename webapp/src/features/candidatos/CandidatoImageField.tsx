'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import ImageAdd01Icon from '@hugeicons/core-free-icons/ImageAdd01Icon'
import ImageUpload01Icon from '@hugeicons/core-free-icons/ImageUpload01Icon'
import FlipCard from '../../components/ui/FlipCard'

type Variante = 'completo' | 'control' | 'preview'

type Props = {
  foto: string | null
  nombre: string
  nombreArchivo: string | null
  onImagen: (file: File) => void | Promise<void>
  onQuitar: () => void
  ariaLabelInput?: string
  etiquetaPreview?: string
  variante?: Variante
}

export default function CandidatoImageField({
  foto,
  nombre,
  nombreArchivo,
  onImagen,
  onQuitar,
  ariaLabelInput = 'Seleccionar fotografía del candidato',
  etiquetaPreview = 'Vista previa de la tarjeta',
  variante = 'completo'
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)

  async function alSeleccionar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await onImagen(file)
  }

  async function alSoltar(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await onImagen(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void alSeleccionar(e)}
        className="sr-only"
        aria-label={ariaLabelInput}
      />

      {variante !== 'preview' && (foto ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="truncate text-sm font-medium text-white">{nombreArchivo ?? 'Imagen del candidato'}</p>
          <p className="mt-1 text-xs text-slate-500">Optimizada automáticamente · 640 px · WebP</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            const siguiente = e.relatedTarget as Node | null
            if (!siguiente || !e.currentTarget.contains(siguiente)) setArrastrando(false)
          }}
          onDrop={(e) => void alSoltar(e)}
          className={`group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition ${
            arrastrando
              ? 'border-blue-400/70 bg-blue-500/10'
              : 'border-white/15 bg-black/20 hover:border-blue-300/40 hover:bg-white/[0.04]'
          }`}
        >
          <span className={`grid h-12 w-12 place-items-center rounded-2xl border transition ${
            arrastrando
              ? 'border-blue-400/40 bg-blue-500/20 text-blue-200'
              : 'border-white/10 bg-white/[0.05] text-slate-300 group-hover:text-blue-200'
          }`}>
            <HugeiconsIcon icon={ImageUpload01Icon} size={22} strokeWidth={1.7} />
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-medium text-white">
              {arrastrando ? 'Suelta la imagen aquí' : 'Arrastra tu imagen aquí'}
            </span>
            <span className="block text-xs text-slate-500">o selecciona un archivo desde tu equipo</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-200 transition group-hover:bg-white/[0.1]">
            <HugeiconsIcon icon={ImageAdd01Icon} size={15} strokeWidth={1.8} />
            Seleccionar imagen
          </span>
          <span className="text-[11px] text-slate-500">JPG, PNG o WebP · máx. 5 MB</span>
        </button>
      ))}

      {variante !== 'control' && foto && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              {etiquetaPreview}
            </span>
            <span className="text-xs text-slate-500">Foto por delante · datos por detrás</span>
          </div>

          <FlipCard
            front={
              <img
                src={foto}
                alt="Fotografía del candidato"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            }
            back={
              <div className="flex h-full flex-col justify-between bg-linear-to-br from-blue-500/90 via-blue-800/90 to-[#050a1a] p-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/80">
                    Así se verá en la papeleta
                  </p>
                  <h4 className="mt-3 text-2xl font-bold leading-tight text-white">
                    {nombre.trim() || 'Nombre del candidato'}
                  </h4>
                  <p className="mt-3 text-sm text-blue-100/80">Tarjeta del candidato</p>
                </div>
                <p className="text-xs text-blue-100/60">Toca para volver a la foto</p>
              </div>
            }
            axis="y"
            flipOnClick
            draggable
            dragDistance={0}
            tilt
            tiltMax={12}
            glare
            glareOpacity={0.22}
            hoverScale={1.03}
            perspective={1100}
            stiffness={170}
            damping={20}
            width={300}
            height={400}
            radius={22}
            background="#27272a"
            color="#f5f5f5"
            shadow
            shadowColor="#000000"
            shadowOpacity={0.45}
            ariaLabel="Vista previa de la tarjeta del candidato: toca para girar"
          />

          <p className="text-center text-[11px] text-slate-500">Toca o arrastra la tarjeta para girarla</p>

          <div className="flex w-full flex-col items-center gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12]"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={onQuitar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
            >
              <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
              Quitar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
