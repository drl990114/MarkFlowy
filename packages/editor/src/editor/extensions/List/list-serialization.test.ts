import { describe, expect, it } from 'vitest'

import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'

function serializeMarkdown(markdown: string): string {
  const delegate = createWysiwygDelegate()

  try {
    return delegate.docToString(delegate.stringToDoc(markdown))
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
})
