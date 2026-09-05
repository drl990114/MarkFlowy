import type { CapricornHeading, CapricornRuntimeSession } from './capricornRuntimeAdapter'

interface ViewportController {
  view: { getPath: (key: string) => readonly number[] | null | undefined }
}

export function getCapricornActiveHeadingId(
  session: CapricornRuntimeSession,
  container: HTMLElement,
  headings: readonly CapricornHeading[],
  scrollEl: HTMLElement,
): string | null {
  if (!headings.length || !container.isConnected) return null
  const documentNode = container.querySelector<HTMLElement>(
    '[data-cap-content] [data-cap-editable][data-cap-key]',
  )
  if (!documentNode) return null
  const viewportTop = scrollEl.getBoundingClientRect().top + 16
  let anchorKey: string | null = null
  for (const child of documentNode.children) {
    const key = child.getAttribute('data-cap-key')
    if (!key) continue // The two virtual spacers have no document identity.
    anchorKey = key
    if (child.getBoundingClientRect().bottom >= viewportTop) break
  }
  if (!anchorKey || !session.query) return null

  // The pinned 0.1.17 runtime forwards query callbacks to Controller.query,
  // though its legacy declaration only lists query names. Isolate that bridge
  // here until the release exposes a typed viewport API. getPath uses the
  // existing model index: no serialization, document scan or offscreen mount.
  const query = session.query as unknown as <Result>(
    read: (controller: ViewportController) => Result,
  ) => Result
  return query.call(session, (controller) => {
    const anchorIndex = controller.view.getPath(anchorKey!)?.[0]
    if (anchorIndex === undefined) return null
    let start = 0
    let end = headings.length
    while (start < end) {
      const middle = (start + end) >>> 1
      const index = controller.view.getPath(headings[middle].id)?.[0]
      // An outline notification can be deferred beyond a structural edit.
      // Wait for the new snapshot instead of highlighting a removed heading.
      if (index === undefined) return null
      if (index <= anchorIndex) start = middle + 1
      else end = middle
    }
    return headings[Math.max(0, start - 1)]?.id ?? null
  }) as string | null
}
