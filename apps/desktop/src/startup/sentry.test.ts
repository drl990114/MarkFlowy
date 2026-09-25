import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sentryCaptureException, sentryInit } = vi.hoisted(() => ({
  sentryCaptureException: vi.fn(),
  sentryInit: vi.fn(),
}))

vi.mock('@sentry/react', () => ({ captureException: sentryCaptureException, init: sentryInit }))

describe('deferred Sentry initialization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.resetModules()
    sentryCaptureException.mockReset()
    sentryInit.mockReset()
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
    const { initSentryAfterInteractive } = await import('./sentry')

    initSentryAfterInteractive('https://public@example.invalid/1', window)
    expect(requestIdleCallback).not.toHaveBeenCalled()
    expect(sentryInit).not.toHaveBeenCalled()

    markStartupInteractive('editable')
    await vi.advanceTimersByTimeAsync(32)
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2_000 })
    expect(sentryInit).not.toHaveBeenCalled()

    vi.useRealTimers()
    idleCallback?.({ didTimeout: false, timeRemaining: () => 16 })
    await vi.waitFor(() => {
      expect(sentryInit).toHaveBeenCalledWith({
        dsn: 'https://public@example.invalid/1',
        integrations: [],
      })
    })
  })

  it('flushes an early exception only after deferred initialization completes', async () => {
    let idleCallback: IdleRequestCallback | undefined
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        idleCallback = callback
        return 1
      },
    })
    const earlyError = new Error('before editor ready')
    const { captureException } = await import('@/services/error-reporting')
    const { markStartupInteractive } = await import('./interactive')
    const { initSentryAfterInteractive } = await import('./sentry')

    captureException(earlyError)
    expect(sentryCaptureException).not.toHaveBeenCalled()
    initSentryAfterInteractive('https://public@example.invalid/1', window)
    markStartupInteractive('editable')
    await vi.advanceTimersByTimeAsync(32)
    vi.useRealTimers()
    idleCallback?.({ didTimeout: false, timeRemaining: () => 16 })

    await vi.waitFor(() => {
      expect(sentryCaptureException).toHaveBeenCalledWith(earlyError)
    })
  })
})
