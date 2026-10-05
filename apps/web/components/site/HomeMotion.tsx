import { useInView, useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const MotionContext = createContext({ running: false })

/** Shared visibility and reduced-motion preferences for the homepage's ambient motion. */
export default function HomeMotion({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion()
  const [pageVisible, setPageVisible] = useState(true)
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  const running = pageVisible && !reduced
  return (
    <MotionContext.Provider value={{ running }}>
      <main id='main-content' className='mf-home' data-motion-running={running}>
        {children}
      </main>
    </MotionContext.Provider>
  )
}

export function useSceneMotion() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.15 })
  const motion = useContext(MotionContext)
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
