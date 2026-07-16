import MarkdownIt from 'markdown-it'
import { describe, expect, test } from 'vitest'
import MarkdownItMath from './markdown-it-math'

describe('MarkdownItMath', () => {
  test('converts GitHub-style math fences into math blocks', () => {
    const markdown = MarkdownIt('commonmark').use(MarkdownItMath)
    const tokens = markdown.parse('```math\nx^2 + y^2\n```', {})

    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('math_block')
    expect(tokens[0].content).toBe('x^2 + y^2\n')
  })

  test('keeps HTML fences as code', () => {
    const markdown = MarkdownIt('commonmark').use(MarkdownItMath)
    const tokens = markdown.parse('```html\n<strong>safe</strong>\n```', {})

    expect(tokens[0].type).toBe('fence')
    expect(tokens[0].info).toBe('html')
  })
})
