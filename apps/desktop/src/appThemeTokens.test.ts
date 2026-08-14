import { desktopDarkTheme } from '@markflowy/theme'
import { describe, expect, it } from 'vitest'
import { normalizeFontFamily, resolveAppThemeTokens } from './appThemeTokens'

describe('resolveAppThemeTokens', () => {
  it('keeps editor font preferences out of the application UI theme', () => {
    const { editorTheme, uiTheme } = resolveAppThemeTokens({
      accentColor: desktopDarkTheme.accentColor,
      fontSettings: {
        editorCodeFontFamily: 'JetBrains Mono',
        editorRootFontFamily: 'LXGW WenKai',
      },
      hasAccentColorOverride: false,
      theme: desktopDarkTheme,
    })

    expect(uiTheme.fontFamily).toBe(desktopDarkTheme.fontFamily)
    expect(uiTheme.codemirrorFontFamily).toBe(desktopDarkTheme.codemirrorFontFamily)
    expect(editorTheme.fontFamily).toBe('"LXGW WenKai"')
    expect(editorTheme.codemirrorFontFamily).toBe('"JetBrains Mono"')
  })

  it('preserves the theme defaults for legacy and system font settings', () => {
    const { editorTheme } = resolveAppThemeTokens({
      accentColor: '#ff00aa',
      fontSettings: {
        editorCodeFontFamily: 'Default Monospace',
        editorRootFontFamily: 'System Default',
      },
      hasAccentColorOverride: true,
      theme: desktopDarkTheme,
    })

    expect(editorTheme.fontFamily).toBe(desktopDarkTheme.fontFamily)
    expect(editorTheme.codemirrorFontFamily).toBe(desktopDarkTheme.codemirrorFontFamily)
    expect(editorTheme.accentColor).toBe('#ff00aa')
    expect(editorTheme.accentColorFocused).toBe('#ff00aa18')
  })
})

describe('normalizeFontFamily', () => {
  it('quotes font names that contain whitespace without double quoting existing values', () => {
    expect(normalizeFontFamily('IBM Plex Sans')).toBe('"IBM Plex Sans"')
    expect(normalizeFontFamily('Inter')).toBe('Inter')
    expect(normalizeFontFamily("'Noto Sans'")).toBe("'Noto Sans'")
  })
})
