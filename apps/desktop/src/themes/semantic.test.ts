import { describe, expect, it } from 'vitest'
import {
  parseThemeDocument,
  resolveThemeTokens,
  resolveTheme,
  themeTokenNames,
  themeVariableName,
} from '@markflowy/theme/semantic'
import { builtInThemes } from '@markflowy/theme'
import {
  capricornStyle,
  copyTheme,
  desktopVariables,
  getThemeTokens,
  themeLabel,
  toAppTheme,
} from './runtime'
import { changeTheme, createThemeHistory, redoTheme, undoTheme } from './editorHistory'
const document = () =>
  parseThemeDocument({
    version: 1,
    id: 'paper',
    name: 'Paper',
    variants: [{ id: 'light', name: 'Paper Light', mode: 'light', tokens: {} }],
  })
describe('semantic themes', () => {
  it('resolves a minimal theme with derived colors and editor links', () => {
    const tokens = resolveThemeTokens('light', {
      'accent.background': '#ff0000',
      'surface.canvas': '#fffffe',
    })
    expect(Object.keys(tokens)).toHaveLength(themeTokenNames.length)
    expect(tokens['editor.background']).toBe('#fffffeff')
    expect(tokens['accent.subtle']).toBe('#ff00003d')
    expect(tokens['editor.selection.background']).toBe(tokens['accent.subtle'])
    expect(tokens['focus.ring']).toBe(tokens['accent.background'])
  })
  it('keeps hover, pressed, selection and focus independent', () => {
    const tokens = resolveThemeTokens('dark', {
      'interaction.hover': '#123456',
      'focus.ring': '#fedcba',
    })
    expect(tokens['interaction.hover']).not.toBe(tokens['interaction.pressed'])
    expect(tokens['focus.ring']).toBe('#fedcbaff')
    expect(tokens['editor.selection.background']).not.toBe(tokens['focus.ring'])
  })
  it('resolves explicit references to derived defaults without freezing them', () => {
    const tokens = resolveThemeTokens('light', {
      'accent.background': '#ff0000',
      'accent.foreground': { ref: 'accent.subtle' },
      'text.secondary': { ref: 'accent.foreground' },
    })
    expect(tokens['accent.foreground']).toBe('#ff00003d')
    expect(tokens['text.secondary']).toBe('#ff00003d')
    expect(resolveThemeTokens('dark')['accent.foreground']).toMatch(/^#[0-9a-f]{8}$/)
  })
  it('detects cycles through derived defaults and permits explicit replacements', () => {
    expect(() =>
      resolveThemeTokens('light', {
        'accent.background': { ref: 'accent.subtle' },
      }),
    ).toThrow('Circular')
    expect(() =>
      resolveThemeTokens('light', {
        'accent.background': { ref: 'accent.foreground' },
      }),
    ).toThrow('Circular')
    const tokens = resolveThemeTokens('light', {
      'accent.background': { ref: 'accent.subtle' },
      'accent.subtle': '#123456',
    })
    expect(tokens['accent.background']).toBe('#123456ff')
  })
  it('derives readable accent text from translucent colors over the canvas', () => {
    expect(
      resolveThemeTokens('light', {
        'accent.background': '#00000000',
      })['accent.foreground'],
    ).toBe('#111111ff')
    expect(
      resolveThemeTokens('light', {
        'accent.background': '#00000080',
      })['accent.foreground'],
    ).toBe('#111111ff')
    expect(
      resolveThemeTokens('light', {
        'surface.canvas': '#111111',
        'accent.background': '#ffffff10',
      })['accent.foreground'],
    ).toBe('#ffffffff')
    expect(() =>
      resolveThemeTokens('light', {
        'surface.canvas': { ref: 'accent.foreground' },
        'accent.background': '#00000000',
      }),
    ).toThrow('Circular')
  })
  it('validates font lists and CSS numbers before generating declarations', () => {
    for (const value of ['Arial /*', 'Arial !important', 'var(--font)', '"unfinished']) {
      expect(() => resolveThemeTokens('light', { 'font.ui.family': value })).toThrow()
    }
    for (const value of ['0x10', 'Infinity', '0', '-1']) {
      expect(() => resolveThemeTokens('light', { 'font.editor.lineHeight': value })).toThrow()
    }
    const tokens = resolveThemeTokens('light', {
      'font.ui.family': '"Open Sans", 苹方, system-ui',
      'font.editor.lineHeight': '1.5e0',
      'radius.control': '.5rem',
      'radius.overlay': '0',
    })
    expect(tokens['font.editor.family']).toBe('"Open Sans", 苹方, system-ui')
    expect(themeVariableName('font.editor.lineHeight')).toBe('--mf-theme-font-editor-line-height')
    expect(() =>
      parseThemeDocument({
        ...document(),
        variants: [
          {
            ...document().variants[0],
            tokens: { 'text.primary': null },
          },
        ],
      }),
    ).toThrow('invalid value')
    expect(() =>
      parseThemeDocument({
        ...document(),
        variants: [
          {
            ...document().variants[0],
            tokens: { 'text.primary': { ref: 'editor.link', extra: true } },
          },
        ],
      }),
    ).toThrow('expected a value or { ref }')
  })
  it('keeps public accent roles separate from facade hover aliases', () => {
    const tokens = resolveThemeTokens('light', {
      'accent.foreground': '#123456',
      'text.primary': '#abcdef',
    })
    const variables = desktopVariables(tokens)
    expect(variables['--mf-theme-accent-foreground']).toBe('#123456ff')
    expect(variables['--mf-primary-foreground']).toBe('var(--mf-theme-accent-foreground)')
    expect(variables['--mf-accent-foreground']).toBe('var(--mf-theme-text-primary)')
  })
  it('copies built-ins without freezing the default editor references', () => {
    for (const builtin of builtInThemes) {
      const copy = copyTheme(builtin)
      expect(copy.variants[0].tokens['editor.background']).toBeUndefined()
      const updated = resolveTheme(copy, copy.variants[0], { 'surface.canvas': '#123456' })
      expect(updated.tokens['editor.background']).toBe('#123456ff')
    }
  })
  it('derives built-in soft selection from a personal accent override', () => {
    const tokens = getThemeTokens(builtInThemes[0], { 'accent.background': '#ff0000' })
    expect(tokens['accent.subtle']).toBe('#ff00003d')
    expect(tokens['editor.selection.background']).toBe(tokens['accent.subtle'])
  })
  it('rejects missing references, wrong types, cycles and invalid input', () => {
    expect(() => resolveThemeTokens('light', { 'text.primary': { ref: 'missing' } })).toThrow(
      'unknown reference',
    )
    expect(() =>
      resolveThemeTokens('light', { 'text.primary': { ref: 'font.code.family' } }),
    ).toThrow('incompatible')
    expect(() =>
      resolveThemeTokens('light', { 'text.primary': { ref: 'editor.foreground' } }),
    ).toThrow('Circular')
    expect(() => resolveThemeTokens('light', { 'text.primary': '</style>' })).toThrow(
      'invalid value',
    )
    expect(() =>
      parseThemeDocument({
        ...document(),
        variants: [...document().variants, ...document().variants],
      }),
    ).toThrow('duplicate')
  })
  it('keeps references through JSON round trips and applies preferences last', () => {
    const doc = document()
    doc.variants[0].tokens['text.secondary'] = { ref: 'text.primary' }
    const roundtrip = parseThemeDocument(JSON.parse(JSON.stringify(doc)))
    expect(roundtrip).toEqual(doc)
    const resolved = resolveTheme(doc, doc.variants[0], { 'text.primary': '#234567' })
    expect(resolved.tokens['text.secondary']).toBe('#234567ff')
  })
  it('uses stable identity independent of display name and maps both engines', () => {
    const doc = document()
    const variant = doc.variants[0]
    const app = toAppTheme(doc, variant)
    expect(themeLabel(app)).toBe('Paper · Paper Light')
    variant.name = 'Renamed'
    expect(toAppTheme(doc, variant).name).toBe(app.name)
    expect(app.styledConstants.bgColor).toBe(app.resolved.tokens['surface.canvas'])
    expect(capricornStyle(app.resolved.tokens)['--cap-surface']).toBe(
      app.resolved.tokens['editor.background'],
    )
  })
  it('shows theme names when variants share generic Light/Dark labels', () => {
    const paper = document()
    paper.variants[0].name = 'Light'
    const forest = { ...paper, id: 'forest', name: 'Forest' }
    expect(themeLabel(toAppTheme(paper, paper.variants[0]))).toBe('Paper · Light')
    expect(themeLabel(toAppTheme(forest, forest.variants[0]))).toBe('Forest · Light')
    paper.variants[0].name = paper.name
    expect(themeLabel(toAppTheme(paper, paper.variants[0]))).toBe('Paper')
  })
  it('bridges document CSS variables while keeping standalone instances independent', () => {
    const tokens = resolveThemeTokens('light', { 'editor.background': '#123456' })
    expect(capricornStyle(tokens)['--cap-surface']).toBe('#123456ff')
    expect(capricornStyle(tokens, 'document')['--cap-surface']).toBe(
      'var(--mf-theme-editor-background, #123456ff)',
    )
    expect(capricornStyle(tokens, 'document').fontFamily).toContain(
      'var(--mf-theme-font-editor-family, ',
    )
    expect(capricornStyle(tokens)['--cap-code-token-inserted']).toBe(
      tokens['status.success.foreground'],
    )
    expect(capricornStyle(tokens)['--cap-code-token-deleted']).toBe(
      tokens['status.danger.foreground'],
    )
  })
  it('coalesces color drags while retaining undo and redo', () => {
    const original = document()
    let history = createThemeHistory(original)
    history = changeTheme(history, { ...original, name: 'First' })
    history = changeTheme(history, { ...original, name: 'Second' }, true)
    expect(history.past).toHaveLength(1)
    expect(undoTheme(history).present.name).toBe('Paper')
    expect(redoTheme(undoTheme(history)).present.name).toBe('Second')
  })
})
