import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableOfContents from '../../../../../packages/interface/src/components/TableOfContents/TableOfContents'
import { HeadingTitle, renderHeadingTitle } from './HeadingTitle'

afterEach(cleanup)

describe('outline heading formatting', () => {
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
