export const BOOT_OVERLAY_ID = 'mf-boot-overlay'
export const BOOT_SHELL_READY_EVENT = 'mf:boot-shell-ready'

export const syncStartupProgress = (indicator: HTMLElement) => {
  const bootIndicator = indicator.ownerDocument.querySelector<HTMLElement>(
    `#${BOOT_OVERLAY_ID} .mf-startup-indicator`,
  )
  if (!bootIndicator?.getAnimations || !indicator.getAnimations) return

  // Preserve both the moving segment and delayed label across the HTML → React handoff.
  // Match the target too: the bar reveal and label reveal share a keyframe name.
  const sourceAnimations = bootIndicator.getAnimations({ subtree: true })
  const targetAnimations = indicator.getAnimations({ subtree: true })
  for (const target of targetAnimations) {
    if (!('animationName' in target)) continue
    const targetElement = (target.effect as KeyframeEffect | null)?.target
    const source = sourceAnimations.find((animation) => {
      const sourceElement = (animation.effect as KeyframeEffect | null)?.target
      return (
        'animationName' in animation &&
        animation.animationName === target.animationName &&
        sourceElement instanceof Element &&
        targetElement instanceof Element &&
        sourceElement.className === targetElement.className
      )
    })
    if (source?.currentTime != null) target.currentTime = source.currentTime
  }
}

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
