import { describe, expect, it } from 'vitest'
import { darkTheme, lightTheme } from '../theme'
import { resolveCodeMirrorTheme } from './resolve-code-mirror-theme'

describe('resolveCodeMirrorTheme', () => {
  it('uses an explicit theme instead of treating it as a dark-mode flag', () => {
    const customTheme = {
      ...lightTheme.codemirrorTheme,
      settings: {
        ...lightTheme.codemirrorTheme.settings,
        background: '#abcdef',
      },
    }

    expect(resolveCodeMirrorTheme('light', customTheme)).toBe(customTheme)
    expect(resolveCodeMirrorTheme('dark')).toBe(darkTheme.codemirrorTheme)
  })
})
