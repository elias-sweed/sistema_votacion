import { useEffect } from 'react'
import fondoWin10 from '../../assets/Fondo_win10.jpg'

export default function GradientASCIIBackground() {
  // Precargar la imagen para que no parpadee al entrar
  useEffect(() => {
    const img = new Image()
    img.src = fondoWin10
    img.decode?.().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Fondo premium: imagen de la I.E en toda la pantalla */}
      <img
        src={fondoWin10}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
        decoding="async"
        loading="eager"
      />
      {/* Capa oscura translúcida para que las letras se lean claras sobre la imagen */}
      <div className="pointer-events-none absolute inset-0 bg-[#02040a]/55" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(1,3,10,0.65)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,4,11,0.5),transparent_40%,rgba(3,4,11,0.65))]" />
      {/* Sutil brillo premium en la parte superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
    </div>
  )
}
