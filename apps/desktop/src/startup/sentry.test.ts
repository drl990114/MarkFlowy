import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sentryCaptureException, sentryInit } = vi.hoisted(() => ({
  sentryCaptureException: vi.fn(),
  sentryInit: vi.fn(),
}))

vi.mock('@sentry/react', () => ({ captureException: sentryCaptureException, init: sentryInit }))

describe('deferred Sentry initialization', () => {
  beforeEach(() => {
    vi.resetModules()
    sentryCaptureException.mockReset()
    sentryInit.mockReset()
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'requestIdleCallback')
    vi.restoreAllMocks()
  })

  it('loads Sentry only after the shell-ready event reaches an idle slot', async () => {
    let idleCallback: IdleRequestCallback | undefined
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback
      return 1
    })
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    })
    const { BOOT_SHELL_READY_EVENT } = await import('./boot')
    const { initSentryAfterShell } = await import('./sentry')

    initSentryAfterShell('https://public@example.invalid/1', window)
    expect(requestIdleCallback).not.toHaveBeenCalled()
    expect(sentryInit).not.toHaveBeenCalled()

    window.dispatchEvent(new Event(BOOT_SHELL_READY_EVENT))
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2_000 })
    expect(sentryInit).not.toHaveBeenCalled()

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
    const earlyError = new Error('before shell idle')
    const { captureException } = await import('@/services/error-reporting')
    const { BOOT_SHELL_READY_EVENT } = await import('./boot')
    const { initSentryAfterShell } = await import('./sentry')

    captureException(earlyError)
    expect(sentryCaptureException).not.toHaveBeenCalled()
    initSentryAfterShell('https://public@example.invalid/1', window)
    window.dispatchEvent(new Event(BOOT_SHELL_READY_EVENT))
    idleCallback?.({ didTimeout: false, timeRemaining: () => 16 })

    await vi.waitFor(() => {
      expect(sentryCaptureException).toHaveBeenCalledWith(earlyError)
    })
  })
})
