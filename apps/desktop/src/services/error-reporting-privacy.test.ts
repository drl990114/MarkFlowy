import type { ErrorEvent } from '@sentry/react'
import { describe, expect, it } from 'vitest'
import { privateErrorEvent } from './error-reporting-privacy'

describe('private error reports', () => {
  it('retains bundled code coordinates while discarding every user-supplied context', () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: 'a'.repeat(32), timestamp: 123,
      message: 'secret document text',
      user: { email: 'private@example.com' },
      request: { url: 'https://private.example.com', headers: { Authorization: 'Bearer secret-token' } },
      extra: { markdown: '# private document' },
      contexts: { file: { path: '/Users/private/notes.md' } },
      breadcrumbs: [{ message: 'opened private document' }],
      tags: { apiKey: 'secret-key' },
      transaction: '/Users/private/notes.md',
      exception: { values: [{
        type: 'TypeError', value: 'secret-token',
        stacktrace: { frames: [
          { filename: '/Users/private/notes.md', lineno: 1 },
          { filename: 'https://private.example.com/document.js', lineno: 2 },
          { filename: 'http://tauri.localhost/assets/editor-Ab12.js?token=secret', lineno: 10, colno: 25,
            function: 'privateName', vars: { content: 'private text' }, pre_context: ['private source'] },
        ] },
      }] },
    }
    const result = privateErrorEvent(event)
    expect(result.exception?.values?.[0]).toEqual({
      type: 'TypeError', value: 'Error details omitted for privacy',
      stacktrace: { frames: [{ filename: 'app:///assets/editor-Ab12.js', lineno: 10, colno: 25, in_app: true }] },
    })
    expect(Object.keys(result).sort()).toEqual(['event_id', 'exception', 'level', 'platform', 'timestamp', 'type'])
    expect(JSON.stringify(result)).not.toMatch(/secret|private@example|\/Users\/|privateName|private text/)
    expect(event.exception?.values?.[0].value).toBe('secret-token')
    expect(privateErrorEvent(result)).toEqual(result)
  })

  it('allows only built-in error types and packaged application scripts', () => {
    for (const filename of ['file:///Users/me/index.js', 'asset://localhost/notes.js', 'https://other.test/assets/index.js', '/assets/note.md']) {
      const result = privateErrorEvent({ type: undefined, exception: { values: [{ type: 'SecretDocumentError', stacktrace: { frames: [{ filename }] } }] } })
      expect(result.exception?.values?.[0].type).toBe('Error')
      expect(result.exception?.values?.[0].stacktrace?.frames).toEqual([])
    }
    const result = privateErrorEvent({ type: undefined, exception: { values: [{ stacktrace: { frames: [
      { filename: 'tauri://localhost/assets/main.js', lineno: 4 },
      { filename: 'https://tauri.localhost/assets/main.js', lineno: 5 },
    ] } }] } })
    expect(result.exception?.values?.[0].stacktrace?.frames).toHaveLength(2)
  })
})
