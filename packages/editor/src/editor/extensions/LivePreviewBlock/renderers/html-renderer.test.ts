import { describe, expect, test } from 'vitest'

import { createHtmlRenderer } from './html-renderer'

describe('createHtmlRenderer', () => {
  test('renders markdown inside details html blocks', () => {
    const renderer = createHtmlRenderer({})
    const container = document.createElement('div')
    const input = [
      '<details>',
      '<summary>点击展开更多内容</summary>',
      '',
      '这里是折叠的详细内容，支持 Markdown 语法。',
      '',
      '- 隐藏的列表项 A',
      '',
      '- 隐藏的列表项 B',
      '',
      '',
      '</details>',
    ].join('\n')

    renderer.render(input, container, {} as never)

    const details = container.querySelector('details')
    const listItems = Array.from(container.querySelectorAll('li')).map((item) =>
      item.textContent?.trim(),
    )
    const formattingWhitespaceNodes = Array.from(container.querySelectorAll('*')).flatMap(
      (element) =>
        Array.from(element.childNodes).filter(
          (node) => node.nodeType === Node.TEXT_NODE && /^[\s]+$/.test(node.textContent || ''),
        ),
    )

    expect(details).not.toBeNull()
    expect(details?.querySelector('summary')?.textContent).toBe('点击展开更多内容')
    expect(details?.querySelector('p')?.textContent).toBe('这里是折叠的详细内容，支持 Markdown 语法。')
    expect(listItems).toEqual(['隐藏的列表项 A', '隐藏的列表项 B'])
    expect(formattingWhitespaceNodes).toHaveLength(0)
  })
})
