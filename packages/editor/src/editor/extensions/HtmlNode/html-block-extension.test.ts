import { renderEditor } from 'jest-remirror'
import { describe, expect, test } from 'vitest'

import { buildMarkdownParser } from '@/editor/components/WysiwygEditor/delegate'
import { LineTextExtension } from '../Text/text-extension'
import { LineHtmlBlockExtension } from './html-block-extension'

const setup = () => {
  const editor = renderEditor([new LineTextExtension(), new LineHtmlBlockExtension({})])

  return {
    parser: buildMarkdownParser(editor.manager),
  }
}

describe('LineHtmlBlockExtension', () => {
  test('parses details with markdown content as one html block', () => {
    const { parser } = setup()
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

    const doc = parser.parse(input)

    expect(doc.childCount).toBe(1)
    expect(doc.firstChild?.type.name).toBe('html_block')
    expect(doc.firstChild?.textContent).toBe(input)
  })
})
