interface Heading {
  id: string
  pos: number
}

type LineBlock = { top: number; bottom: number }

/** CodeMirror line blocks and mapped heading positions are in document order.
 * Folded headings can share a block. Keep the *first* visible heading, or the
 * preceding section if the viewport contains only body text.
 */
export function findSourceViewportHeading(
  headings: readonly Heading[],
  viewportTop: number,
  viewportBottom: number,
  blockAt: (position: number) => LineBlock | null,
): string | null {
  if (!headings.length) return null

  const read = (index: number) => {
    try {
      return blockAt(headings[index].pos)
    } catch {
      return null
    }
  }
  let before = headings[0].id
  if (viewportTop <= viewportBottom) {
    let visible: string | null = null
    let low = 0
    let high = headings.length
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2)
      const block = read(mid)
      if (!block) break
      if (block.bottom < viewportTop) {
        before = headings[mid].id
        low = mid + 1
      } else {
        visible = block.top <= viewportBottom ? headings[mid].id : null
        high = mid
      }
    }
    if (low === high) return visible ?? before
  }

  // Stale geometry or a collapsed scroll surface does not establish a search
  // boundary. Use the original skip-on-error behavior for this frame only.
  before = headings[0].id
  for (let index = 0; index < headings.length; index++) {
    const block = read(index)
    if (!block) continue
    if (block.bottom >= viewportTop && block.top <= viewportBottom) return headings[index].id
    if (block.top >= viewportTop) break
    before = headings[index].id
  }
  return before
}
