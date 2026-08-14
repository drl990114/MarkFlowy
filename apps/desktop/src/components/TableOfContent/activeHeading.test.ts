import { describe, expect, it } from 'vitest'
import { isTableOfContentsHeadingActive } from '../../../../../packages/interface/src/components/TableOfContents/activeHeading'

describe('isTableOfContentsHeadingActive', () => {
  it('uses the explicit active id when available', () => {
    expect(
      isTableOfContentsHeadingActive({
        activeId: 'heading-2',
        activeNodeKey: 0,
        firstHeadingKey: 0,
        headingId: 'heading-2',
        headingKey: 2,
      }),
    ).toBe(true)
  })

  it('falls back to one active node instead of highlighting every heading', () => {
    expect(
      [0, 1, 2].map((headingKey) =>
        isTableOfContentsHeadingActive({
          firstHeadingKey: 0,
          headingId: `heading-${headingKey}`,
          headingKey,
        }),
      ),
    ).toEqual([true, false, false])
  })
})
