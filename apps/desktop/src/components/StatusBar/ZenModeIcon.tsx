import { cn } from '@/lib/cn'
import { useEffect, useRef } from 'react'

const HOVER_ROTATION_DURATION_MS = 2200
const HOVER_START_PLAYBACK_RATE = 0.35
export const HOVER_PLAYBACK_RATE = 1
const ACCELERATION_DURATION_MS = 180
const ZEN_TRIAD_ARM_PATH =
  'M10 2.45C12.72 2.45 15.12 3.83 16.45 6.1C16.78 6.66 16.6 7.37 16.04 7.7C14.8 8.42 13.6 8.97 12.45 9.73C12.1 9.96 11.66 9.75 11.62 9.34'

export function interpolateRotationRate(from: number, to: number, progress: number): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  const easedProgress = 1 - (1 - clampedProgress) ** 3
  return from + (to - from) * easedProgress
}

export function syncZenIconRotation(
  animation: Pick<Animation, 'pause' | 'play'>,
  rotating: boolean,
): void {
  if (rotating) {
    animation.play()
  } else {
    animation.pause()
  }
}

interface ZenModeIconProps {
  className?: string
  rotating: boolean
}

export function ZenModeIcon(props: ZenModeIconProps) {
  const { className, rotating } = props
  const rotorRef = useRef<SVGGElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const rateFrameRef = useRef<number | null>(null)
  const rotatingRef = useRef(rotating)
  rotatingRef.current = rotating

  useEffect(() => {
    const rotor = rotorRef.current
    if (!rotor || typeof rotor.animate !== 'function') return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const configureAnimation = () => {
      if (rateFrameRef.current !== null) {
        window.cancelAnimationFrame(rateFrameRef.current)
        rateFrameRef.current = null
      }
      animationRef.current?.cancel()
      animationRef.current = null

      if (motionQuery.matches) return

      const animation = rotor.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        {
          duration: HOVER_ROTATION_DURATION_MS,
          iterations: Infinity,
          easing: 'linear',
        },
      )
      animation.playbackRate = HOVER_START_PLAYBACK_RATE
      animationRef.current = animation
      syncZenIconRotation(animation, rotatingRef.current)
    }

    configureAnimation()
    motionQuery.addEventListener('change', configureAnimation)

    return () => {
      motionQuery.removeEventListener('change', configureAnimation)
      animationRef.current?.cancel()
      animationRef.current = null
    }
  }, [])

  useEffect(() => {
    const animation = animationRef.current
    if (!animation) return

    if (rateFrameRef.current !== null) {
      window.cancelAnimationFrame(rateFrameRef.current)
    }

    if (!rotating) {
      syncZenIconRotation(animation, false)
      return
    }

    animation.playbackRate = HOVER_START_PLAYBACK_RATE
    syncZenIconRotation(animation, true)

    const startedAt = performance.now()
    const updateRate = (now: number) => {
      const progress = Math.min((now - startedAt) / ACCELERATION_DURATION_MS, 1)
      animation.updatePlaybackRate(
        interpolateRotationRate(
          HOVER_START_PLAYBACK_RATE,
          HOVER_PLAYBACK_RATE,
          progress,
        ),
      )

      if (progress < 1) {
        rateFrameRef.current = window.requestAnimationFrame(updateRate)
      } else {
        rateFrameRef.current = null
      }
    }

    rateFrameRef.current = window.requestAnimationFrame(updateRate)
    return () => {
      if (rateFrameRef.current !== null) {
        window.cancelAnimationFrame(rateFrameRef.current)
        rateFrameRef.current = null
      }
    }
  }, [rotating])

  return (
    <svg
      aria-hidden='true'
      className={cn('size-4', className)}
      data-mf-zen-mode-icon=''
      fill='none'
      focusable='false'
      viewBox='0 0 20 20'
    >
      <g
        className={cn(
          'origin-center motion-reduce:transition-transform motion-reduce:duration-200',
          rotating && 'motion-reduce:rotate-45',
        )}
        data-mf-zen-mode-triad=''
        data-mf-zen-mode-icon-rotor=''
        fill='none'
        ref={rotorRef}
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.35'
        style={{ transformBox: 'view-box', transformOrigin: 'center' }}
      >
        <path d={ZEN_TRIAD_ARM_PATH} />
        <path d={ZEN_TRIAD_ARM_PATH} transform='rotate(120 10 10)' />
        <path d={ZEN_TRIAD_ARM_PATH} transform='rotate(240 10 10)' />
      </g>
      <circle
        cx='10'
        cy='10'
        data-mf-zen-mode-still-point=''
        fill='currentColor'
        r='0.68'
      />
    </svg>
  )
}
