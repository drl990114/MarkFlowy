import { describe, expect, it } from 'vitest'
import { buildMarkdownTextFromNode } from './html'

describe('buildMarkdownTextFromNode', () => {
  it('wraps image paths containing spaces in angle brackets', () => {
    expect(
      buildMarkdownTextFromNode({
        attrs: {
          alt: 'Local image',
          src: '/Users/example/My Images/photo.png',
        },
      }),
    ).toBe('![Local image](</Users/example/My Images/photo.png>)')
  })

  it('escapes alt text and title delimiters', () => {
    expect(
      buildMarkdownTextFromNode({
        attrs: {
          alt: 'diagram [draft]',
          src: 'https://example.com/diagram.png',
          title: 'The "draft"',
        },
      }),
    ).toBe('![diagram [draft\\]](https://example.com/diagram.png "The \\"draft\\"")')
  })

  it('escapes parentheses in an unwrapped image URL', () => {
    expect(
      buildMarkdownTextFromNode({
        attrs: {
          src: 'https://example.com/image(1).png',
        },
      }),
    ).toBe('![](https://example.com/image\\(1\\).png)')
  })
})
