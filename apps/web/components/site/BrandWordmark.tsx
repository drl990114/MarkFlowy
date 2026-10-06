import { motion, useInView } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// Keep the handwritten strokes and flowing highlight from the previous homepage.
const strokes = [
  {
    id: 'f-stem',
    d: 'M11 56 C13 55 16 55 18 56 M16 56 C19 44 20 29 24 16 M18 17 C26 12 38 12 45 16',
    width: 2.55,
  },
  { id: 'f-crossbar', d: 'M19 34 C26 31 34 32 40 34', width: 2.1 },
  {
    id: 'l',
    d: 'M45 49 C49 39 51 26 54 16 C55 12 59 12 59 16 C59 25 54 37 51 43 C49 48 51 52 55 52 C58 52 60 49 62 45',
    width: 2.5,
  },
  {
    id: 'o',
    d: 'M64 41 C65 32 70 27 77 28 C84 29 86 37 83 44 C80 51 73 54 67 50 C63 47 62 43 64 41 Z',
    width: 2.55,
  },
  {
    id: 'w',
    d: 'M88 30 C89 40 88 50 93 52 C98 53 101 41 102 30 C102 40 103 51 108 52 C114 53 117 40 119 29',
    width: 2.5,
  },
  {
    id: 'y',
    d: 'M122 30 C123 41 124 50 129 52 C134 53 138 40 140 29 C138 43 136 55 131 61 C128 65 123 65 122 62 C121 58 126 55 136 53',
    width: 2.5,
  },
] as const

const replayInterval = 8000
const widthScale = 1.3

export default function BrandWordmark({ paused = false }: { paused?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const [reduced, setReduced] = useState<boolean | null>(null)
  const [pageVisible, setPageVisible] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const playing = inView && pageVisible && reduced === false && !paused
  const replay = useCallback(() => {
    if (playing) setReplayKey((key) => key + 1)
  }, [playing])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setPageVisible(!document.hidden)
      setReduced(preference.matches)
    }
    update()
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      preference.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    setHasStarted(true)
    const timer = window.setTimeout(replay, replayInterval)
    return () => window.clearTimeout(timer)
  }, [playing, replay, replayKey])

  return (
    <motion.span ref={ref} className='mf-site-wordmark' aria-hidden='true' onHoverStart={replay}>
      <span>Mark</span>
      <svg
        className='mf-site-wordmark-flowy'
        data-static={!playing && (reduced === true || hasStarted || paused)}
        viewBox='4 4 141 68'
        shapeRendering='geometricPrecision'
        focusable='false'
      >
        <g
          className='mf-site-wordmark-static'
          fill='none'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          {strokes.map((stroke) => (
            <path key={stroke.id} d={stroke.d} strokeWidth={stroke.width * widthScale} />
          ))}
        </g>
        {playing && (
          <g key={replayKey} className='mf-site-wordmark-animation'>
            <g fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
              {strokes.map((stroke, index) => (
                <motion.path
                  key={stroke.id}
                  d={stroke.d}
                  strokeWidth={stroke.width * widthScale}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: {
                      duration: 1.05,
                      delay: 0.16 + index * 0.08,
                      ease: [0.77, 0, 0.175, 1],
                    },
                    opacity: { duration: 0.06, delay: 0.16 + index * 0.08 },
                  }}
                />
              ))}
            </g>
            <g
              className='mf-site-wordmark-highlight'
              fill='none'
              stroke='var(--seal)'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              {strokes.map((stroke, index) => (
                <motion.path
                  key={stroke.id}
                  d={stroke.d}
                  strokeWidth={stroke.width * widthScale * 1.08}
                  initial={{ pathLength: 0.16, pathOffset: 0, opacity: 0 }}
                  animate={{ pathLength: 0.16, pathOffset: 0.84, opacity: [0, 0.95, 0] }}
                  transition={{
                    pathOffset: {
                      duration: 1.05,
                      delay: 0.16 + index * 0.08,
                      ease: [0.77, 0, 0.175, 1],
                    },
                    opacity: {
                      duration: 1.05,
                      delay: 0.16 + index * 0.08,
                      times: [0, 0.18, 1],
                      ease: 'easeOut',
                    },
                  }}
                />
              ))}
            </g>
          </g>
        )}
      </svg>
      <noscript>
        <style>{'.mf-site .mf-site-wordmark-static { opacity: 1; }'}</style>
      </noscript>
    </motion.span>
  )
}
