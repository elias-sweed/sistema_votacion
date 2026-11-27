import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Lienzo de fondo animado. El canvas es puramente decorativo:
 * no escucha eventos de puntero y nunca intercepta clics ni taps.
 */

export type BackgroundCanvasProps = {
  scene: string
  colors?: Record<string, string>
  className?: string
  children?: ReactNode
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

// Helpers disponibles para el shader de `scene`, tal como en el ejemplo:
// fitted(frag), fbm(p, octaves), glow(color, intensity) y uTime / uResolution.
const SHADER_HELPERS = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * valueNoise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec2 fitted(vec2 frag) {
  vec2 uv = frag / uResolution;
  vec2 p = uv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  p.x *= aspect;
  return p;
}

vec4 glow(vec3 color, float intensity) {
  float alpha = clamp(intensity, 0.0, 1.0);
  return vec4(color * alpha, alpha);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[BackgroundCanvas] Error al compilar el shader:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function resolveColor(value: string): [number, number, number] {
  let color = value.trim()
  const cssVariable = color.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*?))?\)$/)
  if (cssVariable) {
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariable[1])
      .trim()
    color = computed || cssVariable[2]?.trim() || '#3b82f6'
  }

  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return [0.23, 0.51, 0.96]
  probe.fillStyle = '#000000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

export function BackgroundCanvas({
  scene,
  colors = {},
  className = '',
  children
}: BackgroundCanvasProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorsKey = JSON.stringify(colors)

  useEffect(() => {
    const layer = layerRef.current
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    })
    if (!layer || !canvas || !gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const supportsHighp = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0
    const helpers = supportsHighp
      ? SHADER_HELPERS
      : SHADER_HELPERS.replace('precision highp float;', 'precision mediump float;')
    const fragment = compile(
      gl,
      gl.FRAGMENT_SHADER,
      `${helpers}\n${scene}\nvoid main() {\n  gl_FragColor = clamp(scene(gl_FragCoord.xy), 0.0, 1.0);\n}`
    )
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[BackgroundCanvas] Error al enlazar el shader:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const timeLocation = gl.getUniformLocation(program, 'uTime')
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution')
    Object.entries(JSON.parse(colorsKey) as Record<string, string>).forEach(([name, value]) => {
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform3fv(location, resolveColor(value))
    })

    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let raf = 0
    let last = 0
    let elapsed = 0

    const resize = () => {
      const rect = layer.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, 1.25)
      const width = Math.max(1, Math.round(rect.width * scale))
      const height = Math.max(1, Math.round(rect.height * scale))
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      gl.uniform2f(resolutionLocation, width, height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const frame = (now: number) => {
      raf = 0
      if (document.hidden) return
      if (last) elapsed += Math.min((now - last) / 1000, 0.05)
      last = now
      gl.uniform1f(timeLocation, elapsed)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduceMotion) raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (raf || document.hidden) return
      last = 0
      raf = requestAnimationFrame(frame)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else {
        start()
      }
    }

    const observer = new ResizeObserver(() => {
      resize()
      if (reduceMotion) {
        gl.uniform1f(timeLocation, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    })
    observer.observe(layer)
    document.addEventListener('visibilitychange', onVisibility)
    resize()
    if (reduceMotion) {
      gl.uniform1f(timeLocation, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else {
      start()
    }

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [scene, colorsKey])

  const canvasLayer = (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${children ? '' : className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
    </div>
  )

  if (!children) return canvasLayer

  return (
    <div className={`relative ${className}`}>
      {canvasLayer}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default BackgroundCanvas
