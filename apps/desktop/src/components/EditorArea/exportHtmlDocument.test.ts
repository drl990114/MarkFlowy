import { afterEach, expect, it } from 'vitest'
import { exportHtmlDocument } from './exportHtmlDocument'

afterEach(() => {
  document.head.querySelectorAll('style[data-styled]').forEach((style) => style.remove())
})

it('exports without styled tags, escapes metadata, and preserves literal document content', () => {
  const content = '<pre>const text = "a\\"b"</pre>'
  const html = exportHtmlDocument(content, null, '<notes & "quotes">')
  expect(html).toContain(content)
  expect(html).toContain('&lt;notes &amp; &quot;quotes&quot;&gt;')
  expect(html).not.toContain('undefined')
})

it('collects every styled tag instead of relying on the first tag', () => {
  for (const css of ['.one{color:red}', '.two{color:blue}']) {
    const style = document.createElement('style')
    style.dataset.styled = 'active'
    style.textContent = css
    document.head.append(style)
  }
  const html = exportHtmlDocument('<p>Hello</p>', null, 'Notes')
  expect(html).toContain('.one{color:red}')
  expect(html).toContain('.two{color:blue}')
})
