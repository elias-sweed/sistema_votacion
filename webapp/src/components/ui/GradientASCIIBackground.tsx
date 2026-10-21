import GradientASCII from './GradientASCII'

export default function GradientASCIIBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#03040b]" aria-hidden="true">
      <GradientASCII
        colors={['#1e3fd8', '#0b1f5e', '#a5d8ff', '#38bdf8']}
        shape="horizon"
        characters=" =+xX0S8#@"
        cellSize={18}
        density={0.8}
        glyphOpacity={0.8}
        glow={0.22}
        depthOfField={0}
        flicker={0.2}
        softness={0.5}
        scale={1}
        flow={0.5}
        speed={1}
        gradientOpacity={0.82}
        grain={0.08}
        variation={0}
        mouseInteraction
        scrambleRadius={0.1}
        clickEffect="wave"
        intro
        lightMode={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(1,3,10,0.72)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,4,11,0.45),transparent_38%,rgba(3,4,11,0.55))]" />
    </div>
  )
}
