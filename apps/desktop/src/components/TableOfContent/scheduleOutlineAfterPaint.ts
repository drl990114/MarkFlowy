/** Match Desktop's deferred startup policy without creating another work queue. */
export function scheduleOutlineAfterPaint(callback: () => void): () => void {
  let canceled = false
  let frame: number | undefined
  let idle: number | undefined
  let timer: number | undefined
  const run = () => {
    if (!canceled) callback()
  }
  frame = window.requestAnimationFrame(() => {
    if (canceled) return
    frame = window.requestAnimationFrame(() => {
      if (canceled) return
      frame = undefined
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(run, { timeout: 500 })
      } else {
        // WebKit may not provide idle callbacks. Keep the same bounded,
        // post-paint fallback as useAppSetup; this is not an idle-time metric.
        timer = window.setTimeout(run, 120)
      }
    })
  })
  return () => {
    canceled = true
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    if (idle !== undefined) window.cancelIdleCallback?.(idle)
    if (timer !== undefined) window.clearTimeout(timer)
  }
}
