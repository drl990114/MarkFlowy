import { tagHighlighter, tags, type Tag } from '@lezer/highlight'
import { codeMirrorSyntaxStyles, resolveThemeTokens } from '@markflowy/theme/semantic'
import { describe, expect, it } from 'vitest'

const tokens = resolveThemeTokens('light', {
  'syntax.function': '#123456',
  'syntax.variable': '#654321',
  'syntax.attribute': '#345678',
  'editor.foreground': '#abcdef',
  'editor.link': '#fedcba',
})
const styles = codeMirrorSyntaxStyles(tokens)
const highlighter = tagHighlighter(
  styles.map(({ tag }, index) => ({ tag, class: String(index) })),
)
function styleFor(tag: Tag) {
  const matched = highlighter.style([tag])
  return matched === null ? undefined : styles[Number(matched)]
}

describe('semantic syntax roles', () => {
  it('keeps ordinary declarations separate from functions and method names', () => {
    expect(styleFor(tags.definition(tags.variableName))?.color).toBe(tokens['syntax.variable'])
    expect(styleFor(tags.function(tags.variableName))?.color).toBe(tokens['syntax.function'])
    expect(styleFor(tags.definition(tags.function(tags.variableName)))?.color).toBe(
      tokens['syntax.function'],
    )
    expect(styleFor(tags.function(tags.propertyName))?.color).toBe(tokens['syntax.function'])
    expect(styleFor(tags.attributeName)?.color).toBe(tokens['syntax.attribute'])
  })

  it('preserves Markdown source formatting while using editor colors', () => {
    for (const tag of [tags.heading, tags.heading1, tags.strong])
      expect(styleFor(tag)).toMatchObject({ color: tokens['editor.foreground'], fontWeight: 'bold' })
    expect(styleFor(tags.emphasis)).toMatchObject({ fontStyle: 'italic' })
    expect(styleFor(tags.strikethrough)).toMatchObject({ textDecoration: 'line-through' })
    for (const tag of [tags.link, tags.url])
      expect(styleFor(tag)).toMatchObject({
        color: tokens['editor.link'],
        textDecoration: 'underline',
      })
  })
})
