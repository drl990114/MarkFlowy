import { initializeErrorReporter } from '@/services/error-reporting'
import { BOOT_SHELL_READY_EVENT } from './boot'

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
}

let sentryInitializationScheduled = false

export const initSentryAfterShell = (
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
) => {
  if (!dsn || !targetWindow || sentryInitializationScheduled) return

  const scheduleInitialization = () => {
    if (sentryInitializationScheduled) return
    sentryInitializationScheduled = true

    const initialize = () => {
      void initializeErrorReporter({ dsn, integrations: [] }).catch(() => undefined)
    }
    const idleWindow = targetWindow as WindowWithIdleCallback

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(initialize, { timeout: 2_000 })
    } else {
      targetWindow.setTimeout(initialize, 2_000)
    }
  }

  targetWindow.addEventListener(BOOT_SHELL_READY_EVENT, scheduleInitialization, { once: true })
}
