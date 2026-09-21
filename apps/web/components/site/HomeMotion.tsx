import { useInView, useReducedMotion } from 'motion/react'
import { useTranslation } from 'next-i18next'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const MotionContext = createContext({
  running: false,
  paused: false,
  reduced: false,
  toggle: () => {},
})

/** One visibility subscription and pause control for the homepage's ambient motion. */
export default function HomeMotion({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion()
  const [paused, setPaused] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  const running = pageVisible && !paused && !reduced
  return (
    <MotionContext.Provider
      value={{ running, paused, reduced, toggle: () => setPaused((value) => !value) }}
    >
      <main id='main-content' className='mf-home' data-motion-running={running}>
        {children}
      </main>
    </MotionContext.Provider>
  )
}

export const useHomeMotion = () => useContext(MotionContext)

export function useSceneMotion() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.15 })
  const motion = useHomeMotion()
  return { ref, inView, running: inView && motion.running }
}

export function MotionScene({ children, className }: { children: ReactNode; className: string }) {
  const { ref, running } = useSceneMotion()
  return (
    <div ref={ref} className={className} data-running={running}>
      {children}
    </div>
  )
}

export function MotionControl() {
  const { t } = useTranslation()
  const { paused, reduced, toggle } = useHomeMotion()
  if (reduced) return null
  return (
    <button type='button' className='mf-motion-control' onClick={toggle} aria-pressed={paused}>
      <i className={paused ? 'ri-play-mini-fill' : 'ri-pause-mini-line'} aria-hidden='true' />
      {t(paused ? 'site.motion.resume' : 'site.motion.pause')}
    </button>
  )
}
