import type { MfTheme } from '@markflowy/theme'

export const STALE_STARTUP_THEME_TIMEOUT_MS = 1000

const FALLBACK_TRANSITION_ATTRIBUTE = 'data-mf-startup-theme-fallback'
const FALLBACK_TRANSITION_STYLE_ATTRIBUTE = 'data-mf-startup-theme-transition-guard'

export const discardStaleStartupTheme = (
  themes: MfTheme[],
  syntheticTheme: MfTheme,
): MfTheme[] | undefined => {
  if (!themes.includes(syntheticTheme)) return undefined

  return themes.filter((theme) => theme !== syntheticTheme)
}

type ScheduleFrame = (callback: FrameRequestCallback) => number

const getDefaultScheduleFrame = (): ScheduleFrame | undefined => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return undefined
  }

  return window.requestAnimationFrame.bind(window)
}

export const runWithoutThemeTransitions = (
  apply: () => void,
  targetDocument: Document | undefined =
    typeof document === 'undefined' ? undefined : document,
  scheduleFrame: ScheduleFrame | undefined = getDefaultScheduleFrame(),
) => {
  if (!targetDocument) {
    apply()
    return
  }

  const root = targetDocument.documentElement
  const guard = targetDocument.createElement('style')
  guard.setAttribute(FALLBACK_TRANSITION_STYLE_ATTRIBUTE, '')
  guard.textContent = `
    :root[${FALLBACK_TRANSITION_ATTRIBUTE}],
    :root[${FALLBACK_TRANSITION_ATTRIBUTE}] *,
    :root[${FALLBACK_TRANSITION_ATTRIBUTE}] *::before,
    :root[${FALLBACK_TRANSITION_ATTRIBUTE}] *::after {
      transition: none !important;
    }
  `

  const cleanup = () => {
    root.removeAttribute(FALLBACK_TRANSITION_ATTRIBUTE)
    guard.remove()
  }

  targetDocument.head.appendChild(guard)
  root.setAttribute(FALLBACK_TRANSITION_ATTRIBUTE, '')

  try {
    apply()
  } catch (error) {
    cleanup()
    throw error
  }

  if (!scheduleFrame) {
    setTimeout(cleanup, 0)
    return
  }

  scheduleFrame(() => scheduleFrame(cleanup))
}

interface StaleStartupThemeFallbackOptions {
  fallback: () => MfTheme | undefined
  onFallback: (staleTheme: MfTheme) => void
  timeoutMs?: number
}

export const scheduleStaleStartupThemeFallback = ({
  fallback,
  onFallback,
  timeoutMs = STALE_STARTUP_THEME_TIMEOUT_MS,
}: StaleStartupThemeFallbackOptions) => {
  const timeout = setTimeout(() => {
    const staleTheme = fallback()
    if (staleTheme) onFallback(staleTheme)
  }, timeoutMs)

  return () => clearTimeout(timeout)
}
