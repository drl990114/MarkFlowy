import { initializeErrorReporter } from '@/services/error-reporting'
import { afterStartupInteractive } from './interactive'

let sentryInitializationScheduled = false

export const initSentryAfterInteractive = (
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
) => {
  if (!dsn || !targetWindow || sentryInitializationScheduled) return
  sentryInitializationScheduled = true
  afterStartupInteractive(() => {
    void initializeErrorReporter({ dsn, integrations: [] }).catch(() => undefined)
  }, { targetWindow })
}
