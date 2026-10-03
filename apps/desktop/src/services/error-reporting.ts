import type * as ErrorReporterModule from '@sentry/react'
import { privateErrorEvent } from './error-reporting-privacy'

type ErrorReporter = typeof ErrorReporterModule
type ErrorReporterOptions = NonNullable<Parameters<ErrorReporter['init']>[0]>

let errorReporterPromise: Promise<ErrorReporter> | undefined
let initializedReporterPromise: Promise<ErrorReporter | undefined> | undefined
let reportingEnabled = false
let consentRevision = 0
const pendingExceptions: unknown[] = []
const MAX_PENDING_EXCEPTIONS = 20
const CONSENT_TAG = 'markflowy_consent_revision'

const reportException = (reporter: ErrorReporter, error: unknown) => reporter.captureException(error, {
  tags: { [CONSENT_TAG]: String(consentRevision) },
})

const loadErrorReporter = (): Promise<ErrorReporter> => {
  if (!errorReporterPromise) {
    errorReporterPromise = import('@sentry/react').catch((error) => {
      errorReporterPromise = undefined
      throw error
    })
  }

  return errorReporterPromise
}

export const setErrorReportingEnabled = (enabled: boolean) => {
  if (reportingEnabled === enabled) return
  reportingEnabled = enabled
  consentRevision++
  if (!enabled) pendingExceptions.splice(0)
}

export const initializeErrorReporter = (
  options: ErrorReporterOptions,
): Promise<ErrorReporter | undefined> => {
  if (!reportingEnabled) return Promise.resolve(undefined)
  if (!initializedReporterPromise) {
    initializedReporterPromise = loadErrorReporter()
      .then((reporter) => {
        if (!reportingEnabled) {
          initializedReporterPromise = undefined
          return undefined
        }
        reporter.init({
          ...options,
          defaultIntegrations: false,
          integrations: [],
          sendDefaultPii: false,
          sendClientReports: false,
          maxBreadcrumbs: 0,
          tracesSampleRate: 0,
          tracePropagationTargets: [],
          beforeSend: (event) => reportingEnabled && event.tags?.[CONSENT_TAG] === String(consentRevision)
            ? { ...privateErrorEvent(event), tags: { [CONSENT_TAG]: String(consentRevision) } }
            : null,
          transport: (transportOptions) => {
            const transport = reporter.makeFetchTransport(transportOptions)
            return {
              send: (envelope) => {
                if (!reportingEnabled) return Promise.resolve({})
                const eventId = envelope[0].event_id
                if (typeof eventId !== 'string' || !/^[a-f0-9]{32}$/.test(eventId)) return Promise.resolve({})
                const events: [{ type: 'event' }, ErrorReporterModule.ErrorEvent][] = []
                for (const [header, payload] of envelope[1]) {
                  if (header.type !== 'event' || !payload || typeof payload !== 'object') continue
                  const event = payload as ErrorReporterModule.ErrorEvent
                  if (event.tags?.[CONSENT_TAG] !== String(consentRevision)) continue
                  events.push([{ type: 'event' }, privateErrorEvent(event)])
                }
                if (!events.length) return Promise.resolve({})
                return transport.send([{
                  event_id: eventId,
                  sent_at: new Date().toISOString(),
                }, events])
              },
              flush: (timeout) => reportingEnabled ? transport.flush(timeout) : Promise.resolve(true),
            }
          },
        })
        pendingExceptions.splice(0).forEach((error) => reportException(reporter, error))
        return reporter
      })
      .catch((error) => {
        initializedReporterPromise = undefined
        throw error
      })
  }

  return initializedReporterPromise
}

export const captureException = (error: unknown) => {
  if (!reportingEnabled) return
  const revision = consentRevision
  if (!initializedReporterPromise) {
    if (pendingExceptions.length === MAX_PENDING_EXCEPTIONS) pendingExceptions.shift()
    pendingExceptions.push(error)
    return
  }

  void initializedReporterPromise
    .then((reporter) => {
      if (reporter && reportingEnabled && consentRevision === revision) reportException(reporter, error)
    })
    .catch(() => undefined)
}
