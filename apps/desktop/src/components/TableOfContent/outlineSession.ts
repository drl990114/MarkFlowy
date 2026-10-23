import { MapMode, type ChangeDesc, type Text } from '@codemirror/state'
import type { IHeadingData } from '@markflowy/interface'
import type { MfCodemirrorView } from 'rme'
import { subscribeSourceOutline } from './outlineTracking'

export interface OutlineSnapshot {
  collapsedIds: ReadonlySet<string>
  headingCount: number
}

/** View-only state follows the live editor and never writes into Markdown. */
export class OutlineSession {
  private snapshot: OutlineSnapshot = { collapsedIds: new Set(), headingCount: 0 }
  private listeners = new Set<() => void>()
  private positions = new Map<string, number>()
  private sourceDocument?: Text
  private sourceChanges: ChangeDesc | null = null
  private branchIds = new Set<string>()
  private unsubscribeSource?: () => void
  private unsubscribeLifetime?: () => void

  constructor(
    readonly fileId: string,
    readonly mode: string,
    private readonly source?: MfCodemirrorView,
  ) {
    // Keep the small position mapping alive while the panel is hidden, so edits
    // made before it reopens cannot move a fold to an unrelated source heading.
    if (source) {
      this.unsubscribeSource = subscribeSourceOutline(source, (update) => {
        if (!update.docChanged) return
        this.sourceChanges = this.sourceChanges?.composeDesc(update.changes.desc) ?? update.changes.desc
      })
    }
  }

  getSnapshot = (): OutlineSnapshot => this.snapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(collapsedIds: ReadonlySet<string>, headingCount = this.snapshot.headingCount) {
    const previous = this.snapshot
    if (
      headingCount === previous.headingCount &&
      collapsedIds.size === previous.collapsedIds.size &&
      [...collapsedIds].every((id) => previous.collapsedIds.has(id))
    ) return
    this.snapshot = { collapsedIds, headingCount }
    this.listeners.forEach((listener) => listener())
  }

  refresh(headings: readonly IHeadingData[], sourcePositions?: ReadonlyMap<string, number>) {
    this.branchIds = new Set(
      headings.filter((heading, index) => (headings[index + 1]?.depth ?? 0) > heading.depth)
        .map((heading) => heading.id),
    )
    let collapsed = this.snapshot.collapsedIds
    if (sourcePositions) {
      const idsByPosition = new Map([...sourcePositions].map(([id, pos]) => [pos, id]))
      const document = this.source?.cm.state?.doc
      const mapPosition = (pos: number) => this.sourceChanges
        ? this.sourceChanges.mapPos(pos, 1, MapMode.TrackAfter) : pos
      const resolveHeading = (pos: number | null, contentAnchor = false) => {
        if (pos === null) return undefined
        if (!document) return idsByPosition.get(pos)
        const line = document.lineAt(pos)
        const prefix = /^( {0,3})(#{1,6})(?:[\t ]+|$)/.exec(line.text)
        if (!prefix) return undefined
        const markerStart = line.from + prefix[1].length
        // A surviving marker must remain in the marker run. The content fallback
        // must still start the title, not land inside a different heading's text.
        const ownsAnchor = contentAnchor ? pos === line.from + prefix[0].length
          : pos >= markerStart && pos < markerStart + prefix[2].length
        return ownsAnchor ? idsByPosition.get(markerStart) ?? idsByPosition.get(line.from) : undefined
      }
      collapsed = new Set([...collapsed].flatMap((id) => {
        const previousPos = this.positions.get(id)
        if (previousPos === undefined) return []
        const previousLine = this.sourceDocument?.lineAt(previousPos)
        const previousPrefix = previousLine ? /^( {0,3})#{1,6}[\t ]+/.exec(previousLine.text) : null
        const markerStart = previousLine && previousPrefix ? previousLine.from + previousPrefix[1].length : previousPos
        const marker = mapPosition(markerStart)
        let nextId = resolveHeading(marker)
        if (marker === null && previousLine) {
          const content = previousPrefix ? previousLine.from + previousPrefix[0].length : previousLine.to
          // Removing the first # changes the level without replacing the title.
          // A whole-line replacement deletes both anchors and drops the fold.
          if (content < previousLine.to) nextId = resolveHeading(mapPosition(content), true)
        }
        return nextId ? [nextId] : []
      }))
      this.positions = new Map(sourcePositions)
      this.sourceDocument = document
      this.sourceChanges = null
    }
    this.publish(new Set([...collapsed].filter((id) => this.branchIds.has(id))), headings.length)
  }

  setCollapsedIds = (ids: ReadonlySet<string>) => {
    this.publish(new Set([...ids].filter((id) => this.branchIds.has(id))))
  }

  watchLifetime(subscribe: (listener: () => void) => () => void, isCurrent: () => boolean, onInvalidated: () => void) {
    if (this.unsubscribeLifetime) return
    this.unsubscribeLifetime = subscribe(() => {
      if (!isCurrent()) onInvalidated()
    })
  }

  dispose() {
    this.unsubscribeSource?.()
    this.unsubscribeSource = undefined
    this.unsubscribeLifetime?.()
    this.unsubscribeLifetime = undefined
    this.listeners.clear()
  }
}

const sessions = new WeakMap<object, OutlineSession>()

export function releaseOutlineSession(owner: object) {
  sessions.get(owner)?.dispose()
  sessions.delete(owner)
}

export function getOutlineSession(
  owner: object,
  fileId: string,
  mode: string,
  source?: MfCodemirrorView,
): OutlineSession {
  let session = sessions.get(owner)
  if (!session || session.fileId !== fileId || session.mode !== mode) {
    session?.dispose()
    session = new OutlineSession(fileId, mode, source)
    sessions.set(owner, session)
  }
  return session
}
