import { describe, expect, it, vi } from 'vitest'
import { findSourceViewportHeading } from './sourceViewportHeading'

// The same line block may be shared by headings inside a folded CodeMirror
// range; line heights also vary with wrapping and block widgets.
const blocks = [
  { top: 0, bottom: 16 }, { top: 40, bottom: 76 }, { top: 40, bottom: 76 },
  { top: 100, bottom: 102 }, { top: 140, bottom: 180 }, { top: 240, bottom: 250 },
]
const headings = blocks.map((_, index) => ({ id: String(index), pos: index * 10 }))

describe('source viewport heading lookup', () => {
  it('matches document-order first-visible and preceding-section semantics at every vertical boundary', () => {
    for (let top = -25; top <= 300; top++) {
      for (const height of [-4, 0, 1, 18, 140]) {
        const bottom = top + height
        const firstVisible = blocks.findIndex((block) => block.bottom >= top && block.top <= bottom)
        const preceding = blocks.filter((block) => block.top < top).length - 1
        expect(findSourceViewportHeading(headings, top, bottom, (pos) => blocks[pos / 10]))
          .toBe(String(firstVisible === -1 ? Math.max(0, preceding) : firstVisible))
      }
    }
  })

  it('skips unavailable geometry rather than treating it as a section boundary', () => {
    const sparse = (pos: number) => {
      if (pos === 30) throw new RangeError('stale position')
      return pos === 20 ? null : blocks[pos / 10]
    }
    expect(findSourceViewportHeading(headings, 90, 103, sparse)).toBe('1')
    expect(findSourceViewportHeading(headings, 100, 145, sparse)).toBe('4')
    expect(findSourceViewportHeading(headings, 500, 600, () => null)).toBe('0')
    expect(findSourceViewportHeading([], 100, 150, sparse)).toBeNull()
  })

  it('probes logarithmically regardless of viewport position in a 20,000-heading document', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => ({ id: String(i), pos: i * 8 }))
    const read = vi.fn((pos: number) => ({ top: pos, bottom: pos + 4 }))
    for (const index of [0, 17, 10_000, many.length - 1]) {
      read.mockClear()
      expect(findSourceViewportHeading(many, index * 8, index * 8 + 20, read)).toBe(String(index))
      expect(read.mock.calls.length).toBeLessThanOrEqual(15)
    }
  })
})
