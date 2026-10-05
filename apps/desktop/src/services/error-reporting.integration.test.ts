import { afterEach, expect, it, vi } from 'vitest'
import type * as SentryModule from '@sentry/react'

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({ statusCode: 200 }) }))
vi.mock('@sentry/react', async (importOriginal) => ({
  ...await importOriginal<typeof SentryModule>(),
  makeFetchTransport: () => ({ send, flush: () => Promise.resolve(true) }),
}))

afterEach(async () => {
  const reporter = await import('@sentry/react')
  await reporter.close(0)
})

it('the installed SDK delivers only the private event through its real processing pipeline', async () => {
  const reporter = await import('@sentry/react')
  const { captureException, initializeErrorReporter, setErrorReportingEnabled } = await import('./error-reporting')
  setErrorReportingEnabled(true)
  await initializeErrorReporter({ dsn: 'https://public@example.invalid/1' })
  reporter.setUser({ email: 'private@example.com' })
  reporter.setContext('document', { path: '/Users/private/secret.md' })
  reporter.addBreadcrumb({ message: 'private document' })
  const error = new TypeError('secret document and API key')
  error.stack = 'TypeError: secret document and API key\n    at edit (http://tauri.localhost/assets/editor-AB12.js:42:5)'
  captureException(error)
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  const envelope = send.mock.calls[0][0]
  expect(envelope[1]).toHaveLength(1)
  const event = envelope[1][0][1]
  expect(event.exception.values[0].type).toBe('TypeError')
  expect(event.exception.values[0].stacktrace.frames).toEqual([
    { filename: 'app:///assets/editor-AB12.js', lineno: 42, colno: 5, in_app: true },
  ])
  expect(JSON.stringify(envelope)).not.toMatch(/secret|private@example|\/Users\/|consent_revision|document/)
  setErrorReportingEnabled(false)
  captureException(new Error('after revocation'))
  await reporter.flush(100)
  expect(send).toHaveBeenCalledOnce()
})
