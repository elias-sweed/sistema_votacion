import { useEffect, useRef, useState } from 'react'
import Galaxy from './Galaxy'

const IDLE_MS = 5000

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointermove',
  'pointerdown',
  'pointerup',
  'keydown',
  'wheel',
  'touchstart',
  'scroll'
]

export default function GalaxyBackground() {
  const [idle, setIdle] = useState(false)
  const [cycle, setCycle] = useState(0)
  const idleRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const arm = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        idleRef.current = true
        setCycle(c => c + 1)
        setIdle(true)
      }, IDLE_MS)
    }

    const onActivity = () => {
      if (idleRef.current) {
        idleRef.current = false
        setIdle(false)
      }
      arm()
    }

    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, onActivity, { passive: true }))
    arm()

    return () => {
      clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, onActivity))
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-slate-950" aria-hidden="true">
      {idle && (
        <Galaxy
          key={cycle}
          className="absolute inset-0 h-full w-full"
          density={1}
          glowIntensity={0.3}
          flareIntensity={1}
          starSpeed={0.5}
          mouseInteraction={false}
          mouseRepulsion={false}
          clickWarp={false}
          starColors={[]}
          hueShift={140}
          saturation={0}
          starSize={1}
          twinkleIntensity={0.3}
          speed={1}
          rotationSpeed={0.1}
          layers={4}
          direction="forward"
          repulsionStrength={2}
          intro
          lightMode={false}
        />
      )}
    </div>
  )
}
