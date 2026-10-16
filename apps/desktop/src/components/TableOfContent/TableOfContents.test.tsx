import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { TableOfContents as BuiltTableOfContents } from '@markflowy/interface'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableOfContents, {
  type TableOfContentsRef,
} from '../../../../../packages/interface/src/components/TableOfContents/TableOfContents'
import {
  HeadingTree,
  type IHeadingData,
  TraverseResult,
} from '../../../../../packages/interface/src/components/TableOfContents/HeadingTree'

const heading = (depth: number, index: number): IHeadingData => ({
  depth,
  id: `heading-${index}`,
  value: `Heading ${index}`,
  htmlNode: null,
})

// Matches the user's 2 MB document topology: 1 H1, 9,912 H2 and 9,911 H3.
const largeHeadings = [heading(1, 0)]
for (let index = 0; index < 9912; index += 1) {
  largeHeadings.push(heading(2, largeHeadings.length))
  if (index < 9911) largeHeadings.push(heading(3, largeHeadings.length))
}

function mockOutlineLayout(rowHeight = 28) {
  const viewportHeight = 140
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'NAV' ? viewportHeight : rowHeight
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'NAV' ? viewportHeight : rowHeight
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    const virtualHeight = Number.parseFloat(this.querySelector('ul')?.style.height ?? '')
    return Number.isFinite(virtualHeight) ? virtualHeight : this.querySelectorAll('li').length * rowHeight
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName !== 'LI') return new DOMRect(0, 0, 240, viewportHeight)
    const nav = this.closest('nav')!
    const index = Number(this.getAttribute('aria-posinset')) - 1
    const virtualTop = this.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]
    const top = virtualTop === undefined ? index * rowHeight : Number(virtualTop)
    const height = Number.parseFloat(this.style.height) || rowHeight
    return new DOMRect(0, top - nav.scrollTop, 240, height)
  })
  const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(function (
    this: HTMLElement,
    options?: ScrollToOptions | number,
    y?: number,
  ) {
    const top = typeof options === 'number' ? y : options?.top
    if (top === undefined) return
    this.scrollTop = Math.max(0, Math.min(top, this.scrollHeight - this.clientHeight))
  })
  return { scrollTo, viewportHeight }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TableOfContents virtualization', () => {
  it.each([50, 51, 500])('preserves list semantics and current location for %i headings', (count) => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(280)
    const headings = Array.from({ length: count }, (_, index) => heading(1, index))
    const view = render(<TableOfContents headingsData={headings} activeId='heading-1' compact={false} />)
    const rows = Array.from(view.container.querySelectorAll('li'))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(50)
    rows.forEach((row) => {
      expect(row.parentElement?.tagName).toBe('UL')
      expect(row.getAttribute('aria-setsize')).toBe(String(count))
      expect(Number(row.getAttribute('aria-posinset'))).toBeGreaterThan(0)
    })
    expect(view.container.querySelectorAll('[aria-current="location"]')).toHaveLength(1)
    expect(view.container.querySelector('[aria-current="location"]')?.getAttribute('href')).toBe('#heading-1')
    view.rerender(<TableOfContents headingsData={headings} activeId='heading-2' compact={false} />)
    expect(view.container.querySelectorAll('[aria-current="location"]')).toHaveLength(1)
    expect(view.container.querySelector('[aria-current="location"]')?.getAttribute('href')).toBe('#heading-2')
  })

  it.each([
    ['source', TableOfContents],
    ['workspace artifact', BuiltTableOfContents],
  ] as const)(
    'mounts the scroll container before measuring and bounds 19,824 heading rows (%s)',
    (_, Component) => {
      const measuredElements = new Set<HTMLElement>()
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        measuredElements.add(this)
        return 280
      })
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240)

      const ref = createRef<TableOfContentsRef>()
      const { container } = render(<Component ref={ref} headingsData={largeHeadings} />)
      const nav = container.querySelector('nav')!
      expect(container.querySelectorAll('li').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('li').length).toBeLessThan(50)
      expect(measuredElements.has(nav)).toBe(true)

      act(() => {
        nav.scrollTop = (largeHeadings.length - 10) * 28
        fireEvent.scroll(nav)
      })
      expect(
        container.querySelector(`a[href="#heading-${largeHeadings.length - 1}"]`),
      ).not.toBeNull()
      expect(container.querySelectorAll('li').length).toBeLessThan(50)

      act(() => ref.current!.refreshByHeadings({ newHeadings: largeHeadings.slice(0, 3) }))
      expect(container.querySelectorAll('li')).toHaveLength(3)
    },
  )
})

describe('TableOfContents active heading visibility', () => {
  it.each([50, 51, 500])('reveals an offscreen current heading among %i rows', async (count) => {
    const { viewportHeight } = mockOutlineLayout()
    const headings = Array.from({ length: count }, (_, index) => heading(1, index))
    const view = render(<TableOfContents headingsData={headings} activeId='heading-1' compact={false} />)
    const nav = view.container.querySelector('nav')!
    view.rerender(
      <TableOfContents headingsData={headings} activeId={`heading-${count - 1}`} compact={false} />,
    )
    // Native programmatic scrolling delivers its event after the React effect.
    act(() => fireEvent.scroll(nav))
    await waitFor(() => {
      const active = nav.querySelector('[aria-current="location"]')!
      expect(active?.getAttribute('href')).toBe(`#heading-${count - 1}`)
      const rect = active.closest('li')!.getBoundingClientRect()
      expect(rect.top).toBeGreaterThanOrEqual(0)
      expect(rect.bottom).toBeLessThanOrEqual(viewportHeight)
    })
    expect(nav.scrollTop).toBe(count * 28 - viewportHeight)
    if (count > 50) expect(nav.querySelectorAll('li').length).toBeLessThan(50)
  })

  it.each([50, 51, 500])('leaves visible headings and later manual browsing alone with %i rows', async (count) => {
    const { scrollTo } = mockOutlineLayout()
    const headings = Array.from({ length: count }, (_, index) => heading(1, index))
    const view = render(<TableOfContents headingsData={headings} activeId='heading-1' compact={false} />)
    const nav = view.container.querySelector('nav')!
    scrollTo.mockClear()
    view.rerender(<TableOfContents headingsData={headings} activeId='heading-2' compact={false} />)
    expect(nav.scrollTop).toBe(0)
    expect(scrollTo).not.toHaveBeenCalled()

    view.rerender(
      <TableOfContents headingsData={headings} activeId={`heading-${count - 1}`} compact={false} />,
    )
    act(() => fireEvent.scroll(nav))
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(nav.scrollTop).toBeGreaterThan(560)
    scrollTo.mockClear()
    act(() => {
      nav.scrollTop = 560
      fireEvent.scroll(nav)
    })
    view.rerender(
      <TableOfContents
        headingsData={headings.map((item) => ({ ...item, value: `Renamed ${item.value}` }))}
        activeId={`heading-${count - 1}`}
        compact={false}
      />,
    )
    expect(nav.scrollTop).toBe(560)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not retry a virtual reveal over an immediate manual scroll', async () => {
    const { scrollTo } = mockOutlineLayout()
    const headings = Array.from({ length: 500 }, (_, index) => heading(1, index))
    const view = render(<TableOfContents headingsData={headings} activeId='heading-1' />)
    const nav = view.container.querySelector('nav')!
    view.rerender(<TableOfContents headingsData={headings} activeId='heading-499' />)
    expect(nav.scrollTop).toBe(13860)
    act(() => fireEvent.scroll(nav))
    scrollTo.mockClear()
    // The user scrolls before the virtualizer's next animation frame.
    act(() => {
      nav.scrollTop = 0
      fireEvent.scroll(nav)
    })
    await act(async () => {
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
    })
    expect(nav.scrollTop).toBe(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('reveals a visible sibling using its position after the previous branch collapses', async () => {
    const { viewportHeight } = mockOutlineLayout()
    const headings = [heading(1, 0), heading(2, 1)]
    for (let index = 2; index <= 61; index += 1) headings.push(heading(3, index))
    for (let index = 62; index <= 122; index += 1) headings.push(heading(2, index))
    const view = render(
      <TableOfContents headingsData={headings} activeId='heading-61' autoExpand compact={false} />,
    )
    const nav = view.container.querySelector('nav')!
    act(() => fireEvent.scroll(nav))
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(nav.scrollTop).toBeGreaterThan(140)
    view.rerender(
      <TableOfContents headingsData={headings} activeId='heading-62' autoExpand compact={false} />,
    )
    act(() => fireEvent.scroll(nav))
    const active = nav.querySelector('[aria-current="location"]')
    expect(active?.getAttribute('href')).toBe('#heading-62')
    const row = active!.closest('li')!
    expect(row.getAttribute('aria-posinset')).toBe('3')
    expect(row.getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
    expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewportHeight)
  })

  it('waits for imperative headings and collapsed parents, using compact rows without repeated jumps', () => {
    const { viewportHeight, scrollTo } = mockOutlineLayout(16)
    const headings = [heading(1, 0)]
    for (let index = 1; index <= 60; index += 2) {
      headings.push(heading(2, index), heading(3, index + 1))
    }
    const ref = createRef<TableOfContentsRef>()
    const view = render(
      <TableOfContents ref={ref} activeId='heading-60' autoExpand compact variant='editor' />,
    )
    act(() => ref.current!.refreshByHeadings({ newHeadings: headings }))
    const nav = view.container.querySelector('nav')!
    const active = nav.querySelector('[aria-current="location"]')!
    expect(active?.getAttribute('href')).toBe('#heading-60')
    expect(nav.querySelectorAll('li').length).toBeLessThan(50)
    const rect = active.closest('li')!.getBoundingClientRect()
    expect(rect.top).toBeGreaterThanOrEqual(0)
    expect(rect.bottom).toBeLessThanOrEqual(viewportHeight)
    expect(nav.scrollTop).toBeGreaterThan(0)

    act(() => {
      nav.scrollTop = 0
      fireEvent.scroll(nav)
    })
    scrollTo.mockClear()
    act(() => ref.current!.refreshByHeadings({ newHeadings: headings.map((item) => ({ ...item })) }))
    expect(nav.scrollTop).toBe(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('also reveals headings selected by the uncontrolled document scroll path', () => {
    const { viewportHeight } = mockOutlineLayout()
    const documentContainer = document.createElement('div')
    const headings = Array.from({ length: 20 }, (_, index) => {
      const node = document.createElement('h1')
      Object.defineProperty(node, 'offsetTop', { value: index * 100 })
      documentContainer.append(node)
      return { ...heading(1, index), htmlNode: node }
    })
    const view = render(
      <TableOfContents
        headingsData={headings}
        containerEl={documentContainer}
        scrollEl={documentContainer}
        compact={false}
      />,
    )
    act(() => {
      documentContainer.scrollTop = 1900
      fireEvent.scroll(documentContainer)
    })
    const nav = view.container.querySelector('nav')!
    const active = nav.querySelector('[aria-current="location"]')!
    expect(active?.getAttribute('href')).toBe('#heading-19')
    expect(active.closest('li')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewportHeight)
    expect(nav.scrollTop).toBeGreaterThan(0)
  })
})

describe('HeadingTree numbering', () => {
  it('preserves skipped levels, mixed sibling depths and explicit numbering', () => {
    const inputs = [2, 4, 3, 4, 2, 5, 4].map(heading)
    inputs[4].chapter = 'IV'
    const tree = new HeadingTree(inputs)
    const entries: { chapter: string; depth: number; parent: number }[] = []
    tree.traverseInPreorder((node) => {
      entries.push({ chapter: node.chapter, depth: node.depth, parent: node.parent!.key })
      return TraverseResult.Continue
    })
    expect(entries).toEqual([
      { chapter: '1', depth: 0, parent: -1 },
      { chapter: '1.0.1', depth: 2, parent: 0 },
      { chapter: '1.1', depth: 1, parent: 0 },
      { chapter: '1.1.1', depth: 2, parent: 2 },
      { chapter: 'IV', depth: 0, parent: -1 },
      { chapter: 'IV.0.0.1', depth: 3, parent: 4 },
      { chapter: 'IV.0.1', depth: 2, parent: 4 },
    ])
  })

  it('retains all nodes and final sibling numbers in the large document shape', () => {
    const tree = new HeadingTree(largeHeadings)
    let count = 0
    let lastChapter = ''
    tree.traverseInPreorder((node) => {
      count += 1
      lastChapter = node.chapter
      return TraverseResult.Continue
    })
    expect(count).toBe(19824)
    expect(lastChapter).toBe('1.9912')
    expect(new HeadingTree([]).getRoot()?.children).toEqual([])
  })
})
