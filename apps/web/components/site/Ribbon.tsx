import { useEffect, useId, useRef } from 'react'
import type { WaveRenderer } from './waveRenderer'

export default function Ribbon() {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const root = ref.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    let renderer: WaveRenderer | null = null
    let disposed = false
    let loading = false
    let visible = false
    let frame = 0
    let time = 0
    let previous = 0
    let lastDraw = 0
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    const header = root.closest('.mf-site')?.querySelector('.mf-site-header')
    const home = root.closest('.mf-home')
    const canRun = () =>
      visible &&
      !document.hidden &&
      !media.matches &&
      home?.getAttribute('data-motion-running') !== 'false' &&
      header?.getAttribute('data-open') !== 'true'
    const draw = (now: number) => {
      if (disposed || !renderer || !canRun()) {
        frame = 0
        return
      }
      if (previous) time += Math.min(now - previous, 64)
      previous = now
      // Follow the display on desktop. Keep the remainder on touch devices so
      // throttling cannot accumulate a long frame every few draws.
      const interval = 1000 / 30
      const elapsed = now - lastDraw
      if (!coarsePointer.matches || elapsed >= interval) {
        renderer.draw(time)
        lastDraw = coarsePointer.matches ? now - (elapsed % interval) : now
      }
      frame = requestAnimationFrame(draw)
    }
    const update = () => {
      const running = canRun() && !!renderer
      root.dataset.running = String(running)
      if (running && !frame) {
        previous = 0
        frame = requestAnimationFrame(draw)
      } else if (!running && frame) {
        cancelAnimationFrame(frame)
        frame = 0
        previous = 0
      }
    }
    const load = async () => {
      if (renderer || loading || disposed) return
      loading = true
      try {
        const { createWaveRenderer } = await import('./waveRenderer')
        if (disposed) return
        renderer = createWaveRenderer(canvas)
        if (renderer) {
          renderer.draw(time)
          root.dataset.ready = 'true'
          update()
        }
      } catch {
        // The server-rendered illustration remains visible if WebGL is unavailable.
      } finally {
        loading = false
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) void load()
      update()
    })
    const resize = new ResizeObserver(() => {
      renderer?.resize()
      renderer?.draw(time)
    })
    const navigation = new MutationObserver(update)
    observer.observe(root)
    resize.observe(canvas)
    if (header) navigation.observe(header, { attributes: true, attributeFilter: ['data-open'] })
    if (home)
      navigation.observe(home, { attributes: true, attributeFilter: ['data-motion-running'] })
    media.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      renderer?.dispose()
      renderer = null
      root.dataset.ready = 'false'
      root.dataset.running = 'false'
    }
    const onContextRestored = () => {
      if (visible) void load()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      navigation.disconnect()
      media.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      renderer?.dispose()
    }
  }, [])
  return (
    <div ref={ref} className='mf-hero-ribbon' aria-hidden='true'>
      <svg viewBox='0 0 1400 800' preserveAspectRatio='xMidYMid slice' focusable='false'>
        <defs>
          <linearGradient id={`${id}-silk`} x1='0' y1='0' x2='1' y2='.6'>
            <stop stopColor='var(--mf-wave-light)' />
            <stop offset='.4' stopColor='var(--seal)' />
            <stop offset='.75' stopColor='var(--mf-wave-accent)' />
            <stop offset='1' stopColor='var(--mf-wave-light)' />
          </linearGradient>
        </defs>
        <path
          d='M80 -200 C190 260 580 265 1010 740 L1290 960 C1100 190 1450 -110 600 -240 Z'
          fill={`url(#${id}-silk)`}
          opacity='.5'
        />
      </svg>
      <canvas ref={canvasRef} />
    </div>
  )
}
