import { cleanup, fireEvent, render } from '@testing-library/react'
import type * as ReactMarkdownModule from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableOfContents from '../../../../../packages/interface/src/components/TableOfContents/TableOfContents'
import { HeadingTitle, renderHeadingTitle } from './HeadingTitle'

const parseTitle = vi.hoisted(() => vi.fn())
vi.mock('react-markdown', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactMarkdownModule>()
  return {
    ...actual,
    default: (props: Parameters<typeof actual.default>[0]) => {
      parseTitle(props.children)
      return <actual.default {...props} />
    },
  }
})

afterEach(cleanup)

describe('outline heading formatting', () => {
  it('renders ordinary headings literally without building a Markdown parser for each row', () => {
    const titles = [
      '第一章：编辑器（概览）', '1. Introduction', '2) 设计', '1.1、段落  A',
      'Cafe\u0301', 'Δοκιμή 2', 'Раздел 3', 'الفصل ٤', '100000000000. End',
      ...Array.from({ length: 100 }, (_, i) => `Section ${i + 1}: Content`),
    ]
    parseTitle.mockClear()
    const { container } = render(<>{titles.map((title) => (
      <span key={title}><HeadingTitle title={title} /></span>
    ))}</>)
    expect(Array.from(container.children, (child) => child.textContent)).toEqual(titles)
    expect(parseTitle).not.toHaveBeenCalled()
  })

  it('matches the previous inline Markdown output for common and mixed-script plain titles', async () => {
    const { default: Markdown } = await vi.importActual<typeof ReactMarkdownModule>('react-markdown')
    const starts = ['1. ', '3) ', '12、', '7.2 ', 'Section ', '计划 ', 'www.example.', 'مرحلة ']
    const parts = ['x', '附件', '25', '·', 'e\u0301', ' — ', 'a  b', ':', '(', ')', '!', '-', '…']
    let seed = 72
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed
    }
    const titles = Array.from({ length: 160 }, (_, i) =>
      starts[i % starts.length] + Array.from({ length: 8 }, () => parts[next() % parts.length]).join(''))
    const { container } = render(<>{titles.map((title) => (
      <div key={title}>
        <span><HeadingTitle title={title} /></span>
        <span><Markdown allowedElements={[]} unwrapDisallowed skipHtml remarkPlugins={[remarkGfm]}>
          {title.replace(/^( {0,3}\d{1,9})([.)])(?=[\t ]|$)/, '$1\\$2')}
        </Markdown></span>
      </div>
    ))}</>)
    for (const row of container.children) {
      expect(row.children[0].innerHTML).toBe(row.children[1].innerHTML)
    }
  })

  it('retains Markdown semantics for ambiguous punctuation, whitespace, escapes and HTML', () => {
    const fixtures = [
      ['line  \nbreak', 'line \nbreak'], ['  padded  ', 'padded'], ['A &amp; B', 'A & B'],
      ['Use `inline`', 'Use inline'], ['A _name_', 'A name'], ['# Title', 'Title'],
      ['![A](example.png)', 'A'], ['[label](https://example.invalid)', 'label'],
      ['a <span>word</span>', 'a word'], ['---', ''],
    ]
    parseTitle.mockClear()
    const { container } = render(<>{fixtures.map(([title]) => (
      <span key={title}><HeadingTitle title={title} /></span>
    ))}</>)
    expect(Array.from(container.children, (child) => child.textContent)).toEqual(fixtures.map(([, text]) => text))
    expect(parseTitle).toHaveBeenCalledTimes(fixtures.length)
  })

  it('renders nested inline formatting, numbered titles, and literal escapes', () => {
    const { container } = render(
      <HeadingTitle title={'1.1、**粗体与 *斜体*** `code` ~~删除~~ \\*原样\\*'} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('粗体与 斜体')
    expect(container.querySelector('strong em')?.textContent).toBe('斜体')
    expect(container.querySelector('code')?.textContent).toBe('code')
    expect(container.querySelector('del')?.textContent).toBe('删除')
    expect(container.textContent).toBe('1.1、粗体与 斜体 code 删除 *原样*')
    expect(container.querySelector('p')).toBeNull()
  })

  it.each(['1.', '2)'])('keeps an authored %s prefix alongside inline formatting', (prefix) => {
    const { container } = render(<HeadingTitle title={`${prefix} **Introduction**`} />)
    expect(container.textContent).toBe(`${prefix} Introduction`)
    expect(container.querySelector('strong')?.textContent).toBe('Introduction')
  })

  it('keeps heading links and images as text inside the outline navigation link', () => {
    const onClick = vi.fn()
    const { container, getByRole } = render(
      <TableOfContents
        compact={false}
        showChapter={false}
        renderTitle={renderHeadingTitle}
        headingsData={[{
          id: 'formatted', depth: 1, htmlNode: null, onClick,
          value: '**标题** [链接](https://example.com) ![图片](https://example.com/a.png)',
        }]}
      />,
    )
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('img')).toBeNull()
    const link = getByRole('link', { name: '标题 链接 图片' })
    expect(link.getAttribute('href')).toBe('#formatted')
    fireEvent.click(link.querySelector('strong')!)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not interpret raw HTML or create interactive elements', () => {
    const { container } = render(
      <HeadingTitle title={'<img src=x onerror=alert(1)> <button>文字</button> **结尾**'} />,
    )
    expect(container.querySelector('img,button,script')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('结尾')
  })
})
