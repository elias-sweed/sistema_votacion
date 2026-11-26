import BackgroundCanvas from './BackgroundCanvas'
import fondo from '../../assets/fondo.jpg'

// Mismo fondo en todas las rutas: panel, login, kiosco y pantallas de error.
const SCENE = /* glsl */ `
uniform vec3 uTint;
vec4 scene(vec2 frag) {
  vec2 p = fitted(frag);
  float bands = fbm(vec2(p.x * 1.4 + uTime * 0.05, p.y * 3.0), 4);
  return glow(uTint, smoothstep(-0.2, 0.7, bands) * 0.8);
}
`

const COLORS = { uTint: 'var(--primary)' }

export function FondoGlobal() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <img
        src={fondo}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-30"
        decoding="async"
        loading="eager"
      />
      <BackgroundCanvas className="absolute inset-0" colors={COLORS} scene={SCENE} />
      <div className="absolute inset-0 bg-[#02040a]/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(1,3,10,0.7)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,4,11,0.45),transparent_40%,rgba(3,4,11,0.6))]" />
    </div>
  )
}

export default FondoGlobal
