import LightRays from './LightRays'

export default function LightRaysBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#030303]" aria-hidden="true">
      <LightRays
        raysOrigin="top-center"
        raysColor="#e8c47a"
        raysSpeed={0.45}
        lightSpread={0.85}
        rayLength={2.6}
        rayDensity={0.85}
        raySharpness={0.42}
        glow={0.55}
        haze={0.4}
        atmosphere={0.85}
        intensity={0.85}
        fadeDistance={1.15}
        saturation={1.1}
        noiseAmount={0.04}
        distortion={0.12}
        followMouse
        mouseInfluence={0.12}
        cursorShadow
        clickPulse
        intro
        lightMode={false}
        opacity={0.9}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.10),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.72)_100%)]" />
    </div>
  )
}
