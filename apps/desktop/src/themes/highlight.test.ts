import Color from 'color'
import { builtInThemes } from '@markflowy/theme'
import { parseThemeDocument, themeVariables } from '@markflowy/theme/semantic'
import { describe, expect, it } from 'vitest'
import { rmeEditorTokens } from './editorTokens'
import { capricornStyle, getThemeTokens, toAppTheme } from './runtime'

describe('document highlight colors', () => {
  it.each(builtInThemes)('keeps marked text distinct and readable in $name', (theme) => {
    const tokens = getThemeTokens(theme)
    const background = Color(tokens['editor.highlight.background'])
    const foreground = Color(tokens['editor.highlight.foreground'])
    expect(background.alpha()).toBe(1)
    expect(foreground.contrast(background)).toBeGreaterThanOrEqual(7)
    expect(background.contrast(Color(tokens['editor.background']))).toBeGreaterThanOrEqual(1.4)
  })

  it('keeps highlights independent from personal accent and selection colors', () => {
    for (const theme of builtInThemes) {
      const original = getThemeTokens(theme)
      const modified = getThemeTokens(theme, {
        'accent.background': '#cc33ee',
        'editor.selection.background': '#112233',
      })
      expect(modified['editor.highlight.background']).toBe(original['editor.highlight.background'])
      expect(modified['editor.highlight.foreground']).toBe(original['editor.highlight.foreground'])
    }
  })

  it('round-trips personal highlight colors and maps both editor engines', () => {
    const document = parseThemeDocument(JSON.parse(JSON.stringify({
      version: 1,
      id: 'personal-highlights',
      name: 'Personal highlights',
      variants: [{
        id: 'dark',
        name: 'Dark',
        mode: 'dark',
        tokens: {
          'editor.highlight.background': '#88ccff',
          'editor.highlight.foreground': '#112233',
        },
      }],
    })))
    const tokens = getThemeTokens(toAppTheme(document, document.variants[0]))
    expect(rmeEditorTokens(tokens)).toMatchObject({
      markBgColor: '#88ccffff',
      markFontColor: '#112233ff',
    })
    expect(capricornStyle(tokens)).toMatchObject({
      '--cap-highlight-background': '#88ccffff',
      '--cap-highlight-foreground': '#112233ff',
    })
    expect(capricornStyle(tokens, 'document')).toMatchObject({
      '--cap-highlight-background': 'var(--mf-theme-editor-highlight-background, #88ccffff)',
      '--cap-highlight-foreground': 'var(--mf-theme-editor-highlight-foreground, #112233ff)',
    })
    expect(themeVariables(tokens)).toMatchObject({
      '--mf-theme-editor-highlight-background': '#88ccffff',
      '--mf-theme-editor-highlight-foreground': '#112233ff',
    })
  })
})
