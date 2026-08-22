export const BOOT_OVERLAY_ID = 'mf-boot-overlay'
export const BOOT_SHELL_READY_EVENT = 'mf:boot-shell-ready'

let shellReadyScheduled = false

const markPerformance = (targetWindow: Window, name: string) => {
  try {
    targetWindow.performance?.mark(name)
  } catch {
    // Performance marks are diagnostic only and are unavailable in some previews/tests.
  }
}

const requestFrame = (targetWindow: Window, callback: FrameRequestCallback) => {
  if (typeof targetWindow.requestAnimationFrame === 'function') {
    return targetWindow.requestAnimationFrame(callback)
  }

  return targetWindow.setTimeout(() => callback(targetWindow.performance?.now?.() ?? 0), 0)
}

export const markBootShellReady = (
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
  targetDocument: Document | undefined = typeof document === 'undefined' ? undefined : document,
) => {
  if (!targetWindow || !targetDocument || shellReadyScheduled) return

  shellReadyScheduled = true
  markPerformance(targetWindow, 'mf:startup:shell-ready')
  targetWindow.dispatchEvent(new Event(BOOT_SHELL_READY_EVENT))
  const committedOverlay = targetDocument.getElementById(BOOT_OVERLAY_ID)
  if (committedOverlay) committedOverlay.dataset.shellReady = 'true'

  requestFrame(targetWindow, () => {
    markPerformance(targetWindow, 'mf:boot-shell-first-frame')
    requestFrame(targetWindow, () => {
      const overlay = targetDocument.getElementById(BOOT_OVERLAY_ID)
      markPerformance(targetWindow, 'mf:startup:boot-hide-start')
      if (!overlay) return

      overlay.dataset.state = 'hiding'
      overlay.setAttribute('aria-hidden', 'true')

      let removed = false
      const removeOverlay = () => {
        if (removed) return
        removed = true
        markPerformance(targetWindow, 'mf:startup:boot-hidden')
        overlay.remove()
      }
      if (targetWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        removeOverlay()
        return
      }

      overlay.addEventListener('transitionend', removeOverlay, { once: true })
      targetWindow.setTimeout(removeOverlay, 200)
    })
  })
}
