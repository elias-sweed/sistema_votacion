import { useLayoutEffect, useRef } from 'react'
import MaskedHeading from '../../components/ui/MaskedHeading'
import videoTitulo from '../../assets/TituloVid/playa.mp4'

type Props = {
  titulo: string
  centro?: string | null
  logoUrl?: string | null
}

type LineaProps = {
  texto: string
  maxPx: number
}

/**
 * El nombre de la I.E. va debajo del título enmascarado. Se mide con la misma
 * fuente del kiosco y se reduce hasta que quepa en una sola línea, sin cortes.
 */
function LineaAjustada({ texto, maxPx }: LineaProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const elemento = ref.current
    const contenedor = elemento?.parentElement
    if (!elemento || !contenedor || !texto) return

    const contexto = document.createElement('canvas').getContext('2d')
    const ajustar = () => {
      const disponible = contenedor.clientWidth
      if (!disponible || !contexto) return

      const estilo = window.getComputedStyle(elemento)
      contexto.font = `${estilo.fontWeight} ${maxPx}px ${estilo.fontFamily}`
      const ancho = contexto.measureText(texto).width
      const tamano = ancho > disponible ? Math.max(8, Math.floor((maxPx * disponible) / ancho)) : maxPx
      elemento.style.fontSize = `${tamano}px`
      elemento.style.whiteSpace = 'nowrap'
    }

    ajustar()
    const observer = new ResizeObserver(ajustar)
    observer.observe(contenedor)
    if (document.fonts) void document.fonts.ready.then(ajustar).catch(() => {})

    return () => observer.disconnect()
  }, [texto, maxPx])

  return (
    <span ref={ref} className="block whitespace-nowrap" style={{ fontSize: `${maxPx}px` }}>
      {texto}
    </span>
  )
}

export default function KioskHeader({ titulo, centro, logoUrl }: Props) {
  return (
    <header className="relative mb-4 flex shrink-0 items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl sm:mb-5 sm:gap-6 sm:px-8 sm:py-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(56,189,248,0.16),transparent_60%)]"
      />

      <div className="relative min-w-0 flex-1">
        <MaskedHeading
          text={titulo}
          tag="h1"
          mediaType="video"
          src={videoTitulo}
          fillScale={1.25}
          parallax={26}
          reveal="scale"
          trigger="view"
          spotlight={false}
          outline={false}
          duration={1.1}
          stagger={0.09}
          drift={18}
          hoverZoom={0}
          align="center"
          brightness={1}
          saturation={1}
          grayscale={false}
          outlineWidth={1}
          weight={700}
          tracking={-0.03}
          lineHeight={1.06}
          textScale={0.115}
          singleLine
          className="font-display text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.9)]"
        />

        {centro && (
          <p className="mt-2 w-full text-center font-display font-bold leading-none text-sky-100/95 drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            <LineaAjustada texto={centro} maxPx={44} />
          </p>
        )}
      </div>

      {logoUrl && (
        <img
          src={logoUrl}
          alt={`Logo de ${centro || 'la institución educativa'}`}
          referrerPolicy="no-referrer"
          className="relative h-16 w-16 shrink-0 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.9)] sm:h-20 sm:w-20 lg:h-24 lg:w-24"
        />
      )}
    </header>
  )
}
