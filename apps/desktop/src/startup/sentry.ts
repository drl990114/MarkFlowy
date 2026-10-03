import { initializeErrorReporter, setErrorReportingEnabled } from '@/services/error-reporting'
import { afterStartupInteractive } from './interactive'

let cancelScheduledInitialization: (() => void) | undefined

export const syncErrorReportingPreference = (
  enabled: boolean,
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
) => {
  cancelScheduledInitialization?.()
  cancelScheduledInitialization = undefined
  setErrorReportingEnabled(enabled && Boolean(dsn) && Boolean(targetWindow))
  if (!enabled || !dsn || !targetWindow) return
  cancelScheduledInitialization = afterStartupInteractive(() => {
    cancelScheduledInitialization = undefined
    void initializeErrorReporter({ dsn, integrations: [] }).catch(() => undefined)
  }, { targetWindow })
}
