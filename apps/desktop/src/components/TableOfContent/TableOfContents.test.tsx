import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TableOfContents virtualization', () => {
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
