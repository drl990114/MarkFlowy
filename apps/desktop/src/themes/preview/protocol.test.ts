import { describe, expect, it } from 'vitest'
import {
  PREVIEW_CHANNEL,
  isPreviewMessage,
  matchesPreviewOrigin,
  previewTargetOrigin,
} from './protocol'

describe('theme preview message boundary', () => {
  it('rejects messages from other preview sessions or channels', () => {
    expect(
      isPreviewMessage({ channel: PREVIEW_CHANNEL, session: 'one', type: 'ready' }, 'one'),
    ).toBe(true)
    expect(
      isPreviewMessage({ channel: PREVIEW_CHANNEL, session: 'two', type: 'ready' }, 'one'),
    ).toBe(false)
    expect(isPreviewMessage({ channel: 'unrelated', session: 'one', type: 'ready' }, 'one')).toBe(
      false,
    )
    expect(
      isPreviewMessage({ channel: PREVIEW_CHANNEL, session: 'one', type: 'unexpected' }, 'one'),
    ).toBe(false)
  })
  it('requires the exact origin for the browser and supports Tauri protocol origins', () => {
    const browser = new URL('http://localhost:3000/theme-preview.html')
    expect(matchesPreviewOrigin('http://localhost:3000', browser)).toBe(true)
    expect(matchesPreviewOrigin('https://example.com', browser)).toBe(false)
    expect(matchesPreviewOrigin('null', browser)).toBe(false)
    const tauri = new URL('tauri://localhost/theme-preview.html')
    expect(matchesPreviewOrigin('null', tauri)).toBe(true)
    expect(matchesPreviewOrigin('tauri://localhost', tauri)).toBe(true)
    expect(matchesPreviewOrigin('tauri://other', tauri)).toBe(false)
    expect(previewTargetOrigin(browser)).toBe('http://localhost:3000')
  })
})
