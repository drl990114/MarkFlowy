import type * as ErrorReporterModule from '@sentry/react'

type ErrorReporter = typeof ErrorReporterModule
type ErrorReporterOptions = Parameters<ErrorReporter['init']>[0]

let errorReporterPromise: Promise<ErrorReporter> | undefined
let initializedReporterPromise: Promise<ErrorReporter> | undefined
const pendingExceptions: unknown[] = []
const MAX_PENDING_EXCEPTIONS = 20

export const loadErrorReporter = (): Promise<ErrorReporter> => {
  if (!errorReporterPromise) {
    errorReporterPromise = import('@sentry/react').catch((error) => {
      errorReporterPromise = undefined
      throw error
    })
  }

  return errorReporterPromise
}

export const initializeErrorReporter = (
  options: ErrorReporterOptions,
): Promise<ErrorReporter> => {
  if (!initializedReporterPromise) {
    initializedReporterPromise = loadErrorReporter()
      .then((reporter) => {
        reporter.init(options)
        pendingExceptions.splice(0).forEach((error) => reporter.captureException(error))
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
  if (!initializedReporterPromise) {
    if (pendingExceptions.length === MAX_PENDING_EXCEPTIONS) pendingExceptions.shift()
    pendingExceptions.push(error)
    return
  }

  void initializedReporterPromise
    .then((reporter) => reporter.captureException(error))
    .catch(() => undefined)
}
