import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sentryCaptureException, sentryInit, transportSend } = vi.hoisted(() => ({
  sentryCaptureException: vi.fn(),
  sentryInit: vi.fn(),
  transportSend: vi.fn().mockResolvedValue({}),
}))

vi.mock('@sentry/react', () => ({
  captureException: sentryCaptureException,
  init: sentryInit,
  makeFetchTransport: () => ({ send: transportSend, flush: vi.fn().mockResolvedValue(true) }),
}))

describe('deferred Sentry initialization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.resetModules()
    sentryCaptureException.mockReset()
    sentryInit.mockReset()
    transportSend.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(window, 'requestIdleCallback')
    vi.restoreAllMocks()
  })

  it('loads Sentry only after editor readiness reaches an idle slot', async () => {
    let idleCallback: IdleRequestCallback | undefined
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback
      return 1
    })
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    })
    const { markStartupInteractive } = await import('./interactive')
    const { syncErrorReportingPreference } = await import('./sentry')

    syncErrorReportingPreference(true, 'https://public@example.invalid/1', window)
    expect(requestIdleCallback).not.toHaveBeenCalled()
    expect(sentryInit).not.toHaveBeenCalled()

    markStartupInteractive('editable')
    await vi.advanceTimersByTimeAsync(32)
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2_000 })
    expect(sentryInit).not.toHaveBeenCalled()

    vi.useRealTimers()
    idleCallback?.({ didTimeout: false, timeRemaining: () => 16 })
    await vi.waitFor(() => {
      expect(sentryInit).toHaveBeenCalledWith(expect.objectContaining({
        dsn: 'https://public@example.invalid/1',
        integrations: [],
        defaultIntegrations: false,
        sendDefaultPii: false,
        sendClientReports: false,
        maxBreadcrumbs: 0,
        tracesSampleRate: 0,
        tracePropagationTargets: [],
      }))
    })
  })

  it('discards errors before consent and only queues errors after opting in', async () => {
    let idleCallback: IdleRequestCallback | undefined
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        idleCallback = callback
        return 1
      },
    })
    const earlyError = new Error('after consent, before editor ready')
    const { captureException } = await import('@/services/error-reporting')
    const { markStartupInteractive } = await import('./interactive')
    const { syncErrorReportingPreference } = await import('./sentry')

    captureException(new Error('before consent'))
    syncErrorReportingPreference(true, 'https://public@example.invalid/1', window)
    captureException(earlyError)
    expect(sentryCaptureException).not.toHaveBeenCalled()
    markStartupInteractive('editable')
    await vi.advanceTimersByTimeAsync(32)
    vi.useRealTimers()
    idleCallback?.({ didTimeout: false, timeRemaining: () => 16 })

    await vi.waitFor(() => {
      expect(sentryCaptureException).toHaveBeenCalledWith(earlyError, {
        tags: { markflowy_consent_revision: '1' },
      })
    })
    expect(sentryCaptureException).toHaveBeenCalledTimes(1)
  })

  it('does not load the SDK by default or without a DSN', async () => {
    const { syncErrorReportingPreference } = await import('./sentry')
    const { markStartupInteractive } = await import('./interactive')
    const { captureException } = await import('@/services/error-reporting')
    syncErrorReportingPreference(false, 'https://public@example.invalid/1', window)
    markStartupInteractive('empty')
    captureException(new Error('private document text'))
    await vi.advanceTimersByTimeAsync(100)
    syncErrorReportingPreference(true, '', window)
    await vi.advanceTimersByTimeAsync(100)
    expect(sentryInit).not.toHaveBeenCalled()
    expect(sentryCaptureException).not.toHaveBeenCalled()
  })

  it('cancels deferred initialization and drops its queue when consent is revoked', async () => {
    const { syncErrorReportingPreference } = await import('./sentry')
    const { markStartupInteractive } = await import('./interactive')
    const { captureException } = await import('@/services/error-reporting')
    syncErrorReportingPreference(true, 'https://public@example.invalid/1', window)
    captureException(new Error('must not survive revocation'))
    syncErrorReportingPreference(false, 'https://public@example.invalid/1', window)
    markStartupInteractive('empty')
    await vi.advanceTimersByTimeAsync(100)
    expect(sentryInit).not.toHaveBeenCalled()
    syncErrorReportingPreference(true, 'https://public@example.invalid/1', window)
    await vi.advanceTimersByTimeAsync(100)
    expect(sentryInit).toHaveBeenCalledOnce()
    expect(sentryCaptureException).not.toHaveBeenCalled()
  })

  it('stops capture and transport immediately, including events already being processed', async () => {
    const { setErrorReportingEnabled, initializeErrorReporter, captureException } = await import('@/services/error-reporting')
    setErrorReportingEnabled(true)
    await initializeErrorReporter({ dsn: 'https://public@example.invalid/1' })
    const options = sentryInit.mock.calls[0][0]
    const transport = options.transport({})
    const event = { tags: { markflowy_consent_revision: '1' }, exception: { values: [{ type: 'TypeError', value: 'private content' }] } }
    const safe = options.beforeSend(event)
    expect(JSON.stringify(safe)).not.toContain('private content')
    await transport.send([{ event_id: 'a'.repeat(32), trace: { private: 'context' } }, [
      [{ type: 'event' }, safe], [{ type: 'attachment' }, 'private file'], [{ type: 'session' }, {}],
    ]])
    expect(transportSend).toHaveBeenCalledTimes(1)
    expect(transportSend.mock.calls[0][0][1]).toHaveLength(1)
    expect(transportSend.mock.calls[0][0][0]).not.toHaveProperty('trace')
    expect(transportSend.mock.calls[0][0][1][0][1]).not.toHaveProperty('tags')
    captureException(new Error('queued promise'))
    setErrorReportingEnabled(false)
    expect(options.beforeSend(event)).toBeNull()
    await transport.send([{ event_id: 'a'.repeat(32) }, [[{ type: 'event' }, safe]]])
    await Promise.resolve()
    expect(transportSend).toHaveBeenCalledTimes(1)
    expect(sentryCaptureException).not.toHaveBeenCalled()
    setErrorReportingEnabled(true)
    expect(options.beforeSend(event)).toBeNull()
    await transport.send([{ event_id: 'a'.repeat(32) }, [[{ type: 'event' }, safe]]])
    expect(transportSend).toHaveBeenCalledTimes(1)
  })
})
