import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import { darkTheme as defaultEditorDarkTheme } from 'rme'
import { describe, expect, it } from 'vitest'
import {
  alignCodeMirrorTheme,
  normalizeFontFamily,
  resolveAppThemeTokens,
} from './appThemeTokens'

describe('resolveAppThemeTokens', () => {
  it('keeps editor font preferences out of the application UI theme', () => {
    const { editorTheme, uiTheme } = resolveAppThemeTokens({
      accentColor: desktopDarkTheme.accentColor,
      fontSettings: {
        editorCodeFontFamily: 'JetBrains Mono',
        editorRootFontFamily: 'LXGW WenKai',
      },
      hasAccentColorOverride: false,
      mode: 'dark',
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
      mode: 'dark',
      theme: desktopDarkTheme,
    })

    expect(editorTheme.fontFamily).toBe(desktopDarkTheme.fontFamily)
    expect(editorTheme.codemirrorFontFamily).toBe(desktopDarkTheme.codemirrorFontFamily)
    expect(editorTheme.accentColor).toBe('#ff00aa')
    expect(editorTheme.accentColorFocused).toBe('rgba(255, 0, 170, 0.18)')
  })

  it('does not change the soft selection when an override equals the theme accent', () => {
    const { editorTheme } = resolveAppThemeTokens({
      accentColor: desktopDarkTheme.accentColor,
      fontSettings: {},
      hasAccentColorOverride: true,
      mode: 'dark',
      theme: desktopDarkTheme,
    })

    expect(editorTheme.accentColorFocused).toBe(desktopDarkTheme.accentColorFocused)
  })

  it('uses a visible light-mode soft selection for a custom accent', () => {
    const { editorTheme } = resolveAppThemeTokens({
      accentColor: '#ff00aa',
      fontSettings: {},
      hasAccentColorOverride: true,
      mode: 'light',
      theme: desktopLightTheme,
    })

    expect(editorTheme.accentColorFocused).toBe('rgba(255, 0, 170, 0.24)')
  })
})

describe('normalizeFontFamily', () => {
  it('quotes font names that contain whitespace without double quoting existing values', () => {
    expect(normalizeFontFamily('IBM Plex Sans')).toBe('"IBM Plex Sans"')
    expect(normalizeFontFamily('Inter')).toBe('Inter')
    expect(normalizeFontFamily("'Noto Sans'")).toBe("'Noto Sans'")
  })
})

describe('alignCodeMirrorTheme', () => {
  it('aligns editor chrome without replacing syntax styles or match colors', () => {
    const baseTheme = {
      ...defaultEditorDarkTheme.codemirrorTheme,
      settings: {
        ...defaultEditorDarkTheme.codemirrorTheme.settings,
        background: '#111111',
        selectionMatch: '#ffee00',
      },
    }

    const result = alignCodeMirrorTheme({
      baseTheme,
      mode: 'dark',
      theme: desktopDarkTheme,
    })

    expect(result).toMatchObject({
      settings: {
        background: '#131313',
        foreground: '#DDDDDD',
        gutterBackground: '#131313',
        gutterForeground: '#8F8F8F',
        lineHighlight: '#272727',
        selection: 'rgba(55, 148, 255, 0.18)',
        selectionMatch: '#ffee00',
      },
      styles: baseTheme.styles,
    })
  })
})
