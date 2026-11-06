import { describe, expect, it } from 'vitest'
import { builtInThemes, tokyoNightTheme } from '@markflowy/theme'
import { codeMirrorSyntaxStyles, parseThemeDocument } from '@markflowy/theme/semantic'
import { tags } from '@lezer/highlight'
import { capricornStyle, copyTheme, getThemeTokens, toAppTheme } from './runtime'

describe('Tokyo Night theme integration', () => {
  it('carries its built-in palette and syntax through both editor bridges', () => {
    expect(builtInThemes.filter((theme) => theme.name === 'Tokyo Night')).toEqual([tokyoNightTheme])
    const tokens = getThemeTokens(tokyoNightTheme)
    expect(tokens['surface.canvas']).toBe('#1a1b26ff')
    expect(tokens['chrome.sidebar.background']).toBe('#16161eff')
    // Upstream syntax and surfaces remain exact; UI foreground/focus mappings
    // use brighter upstream swatches for MarkFlowy's denser controls.
    expect(tokens).toMatchObject({
      'text.primary': '#a9b1d6ff',
      'text.secondary': '#787c99ff',
      'editor.foreground': '#a9b1d6ff',
      'accent.background': '#3d59a1dd',
      'accent.foreground': '#ffffffff',
      'border.default': '#101014ff',
      'focus.ring': '#6183bbff',
      'chrome.tab.activeBackground': '#16161eff',
      'scrollbar.thumb': '#868bc415',
      'editor.link': '#6183bbff',
      'syntax.comment': '#51597dff',
      'syntax.attribute': '#bb9af7ff',
      'syntax.meta': '#73dacaff',
    })
    expect(capricornStyle(tokens)).toMatchObject({
      '--cap-surface': tokens['surface.canvas'],
      '--cap-code-token-keyword': '#bb9af7ff',
      '--cap-code-token-string': '#9ece6aff',
      '--cap-code-token-title': '#7aa2f7ff',
      '--cap-code-selection': '#515c7e4d',
      '--cap-selection-foreground': tokens['editor.foreground'],
    })
    const styles = codeMirrorSyntaxStyles(tokens)
    expect(styles.find((style) => Array.isArray(style.tag) && style.tag.includes(tags.keyword)))
      .toMatchObject({ color: '#bb9af7ff' })
    expect(styles.find((style) => Array.isArray(style.tag) && style.tag.includes(tags.string)))
      .toMatchObject({ color: '#9ece6aff' })
  })

  it('keeps all colors and live references when copied and imported as JSON', () => {
    const copy = copyTheme(tokyoNightTheme)
    const imported = parseThemeDocument(JSON.parse(JSON.stringify(copy)))
    expect(getThemeTokens(toAppTheme(imported, imported.variants[0])))
      .toEqual(getThemeTokens(tokyoNightTheme))
    const variant = copy.variants[0]
    variant.tokens['surface.canvas'] = '#123456'
    variant.tokens['editor.foreground'] = '#ffffff'
    expect(getThemeTokens(toAppTheme(copy, variant))).toMatchObject({
      'editor.background': '#123456ff',
      'editor.selection.foreground': '#ffffffff',
    })
    const reference = variant.tokens['editor.selection.foreground']
    if (typeof reference !== 'object') throw new Error('Expected a live selection reference')
    reference.ref = 'accent.foreground'
    expect(getThemeTokens(tokyoNightTheme)['editor.selection.foreground']).toBe('#a9b1d6ff')
  })

  it('applies personal colors and typography after the built-in palette', () => {
    const tokens = getThemeTokens(tokyoNightTheme, {
      'accent.background': '#ff0000',
      'font.code.family': 'Monaco, monospace',
      'font.editor.size': '20px',
    })
    expect(tokens).toMatchObject({
      'accent.background': '#ff0000ff',
      'accent.subtle': '#ff00002e',
      'accent.foreground': '#111111ff',
      'font.code.family': 'Monaco, monospace',
      'font.editor.size': '20px',
      'syntax.keyword': '#bb9af7ff',
      'editor.selection.foreground': '#a9b1d6ff',
    })
  })
})
