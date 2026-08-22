import { describe, expect, it } from 'vitest'
import type { Node } from '@rme-sdk/sdk/pm/model'

import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'

function serializeMarkdown(markdown: string): string {
  const delegate = createWysiwygDelegate()

  try {
    return delegate.docToString(delegate.stringToDoc(markdown))
  } finally {
    delegate.manager.destroy()
  }
}

function parseMarkdown(markdown: string): Node {
  const delegate = createWysiwygDelegate()

  try {
    return delegate.stringToDoc(markdown)
  } finally {
    delegate.manager.destroy()
  }
}

describe('list markdown serialization', () => {
  it.each([
    {
      name: 'bullet lists',
      markdown: '- Item 1\n- Item 2\n- Item 3',
    },
    {
      name: 'ordered lists',
      markdown: '1. Item 1\n2. Item 2\n3. Item 3',
    },
    {
      name: 'task lists',
      markdown: '- [ ] Item 1\n- [x] Item 2\n- [ ] Item 3',
    },
  ])('keeps $name tight', ({ markdown }) => {
    expect(serializeMarkdown(markdown)).toBe(markdown)
  })

  it('preserves blank lines around a tight list', () => {
    const markdown = 'Before\n\n- Item 1\n- Item 2\n\nAfter'

    expect(serializeMarkdown(markdown)).toBe(markdown)
  })

  it('keeps the issue 1194 ordered hierarchy in a real nested list tree', () => {
    const markdown = [
      '1. list item 1',
      '    1. nested item 1',
      '        - third level',
      '2. list item 2',
    ].join('\n')
    const doc = parseMarkdown(markdown)

    expect(doc.toJSON()).toMatchObject({
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph' },
                {
                  type: 'orderedList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph' }, { type: 'bulletList' }],
                    },
                  ],
                },
              ],
            },
            { type: 'listItem' },
          ],
        },
      ],
    })
    expect(serializeMarkdown(markdown)).toBe(markdown)
  })

  it('supports mixed bullet and task items in one container', () => {
    const markdown = '- normal\n- [ ] todo\n- [x] done'
    const list = parseMarkdown(markdown).firstChild!

    expect(list.type.name).toBe('bulletList')
    expect(
      Array.from({ length: list.childCount }, (_, index) => list.child(index).attrs.checked),
    ).toEqual([null, false, true])
    expect(serializeMarkdown(markdown)).toBe(markdown)
  })

  it('preserves ordered task items and normalizes the checkbox marker', () => {
    const markdown = '9. [X] done\n10. normal'
    const list = parseMarkdown(markdown).firstChild!

    expect(list.type.name).toBe('orderedList')
    expect(list.attrs.order).toBe(9)
    expect(list.firstChild?.attrs.checked).toBe(true)
    expect(serializeMarkdown(markdown)).toBe('9. [x] done\n10. normal')
  })

  it('uses marker-aware continuation indentation across 9, 10, and 100', () => {
    const markdown = ['9. nine', '10. ten', '11. eleven'].join('\n')
    const hundred = ['100. hundred', '', '     continuation', '101. next'].join('\n')
    const normalizedHundred = ['100. hundred', '', '     continuation', '', '101. next'].join('\n')

    expect(serializeMarkdown(markdown)).toBe(markdown)
    expect(serializeMarkdown(hundred)).toBe(normalizedHundred)
  })

  it('preserves tight and loose list semantics', () => {
    const tight = parseMarkdown('- one\n- two').firstChild!
    const looseMarkdown = '- one\n\n- two'
    const loose = parseMarkdown(looseMarkdown).firstChild!

    expect(tight.attrs.tight).toBe(true)
    expect(loose.attrs.tight).toBe(false)
    expect(serializeMarkdown(looseMarkdown)).toBe(looseMarkdown)
  })

  it('keeps heading, blockquote, and indented code blocks inside a list item', () => {
    const markdown = ['- # Heading', '', '    > Quote', '', '      const value = 1'].join('\n')
    const item = parseMarkdown(markdown).firstChild!.firstChild!

    expect(
      Array.from({ length: item.childCount }, (_, index) => item.child(index).type.name),
    ).toEqual(['heading', 'blockquote', 'codeMirror'])
    expect(serializeMarkdown(markdown)).toBe(
      ['- # Heading', '', '    > Quote', '', '        const value = 1', ''].join('\n'),
    )
  })

  it('keeps adjacent lists of different kinds separate', () => {
    const markdown = '- bullet\n\n1. ordered'
    const doc = parseMarkdown(markdown)

    expect(
      Array.from({ length: doc.childCount }, (_, index) => doc.child(index).type.name),
    ).toEqual(['bulletList', 'orderedList'])
    expect(serializeMarkdown(markdown)).toBe(markdown)
  })
})

describe('four-space root list compatibility', () => {
  it.each([
    ['bullet', '    - one\n    - two', '- one\n- two'],
    ['ordered', '    3. three\n    4. four', '3. three\n4. four'],
    ['task', '    - [ ] todo\n    - [x] done', '- [ ] todo\n- [x] done'],
  ])('normalizes an indented %s list to a root list', (_name, markdown, expected) => {
    expect(parseMarkdown(markdown).firstChild?.type.name).not.toBe('codeMirror')
    expect(serializeMarkdown(markdown)).toBe(expected)
  })

  it.each([
    ['mixed list and code', '    - looks like a list\n    const value = 1'],
    ['eight spaces', '        - keep as code'],
    ['tab indentation', '\t- keep as code'],
    ['fenced code', '```\n- keep as code\n```'],
  ])('keeps %s as code', (_name, markdown) => {
    expect(parseMarkdown(markdown).firstChild?.type.name).toBe('codeMirror')
  })
})
