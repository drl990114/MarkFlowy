import type { ChangeDesc } from '@codemirror/state'
import type { ResumePoint, ResumeSelection } from '@/stores/editorResumeStore'
import type { CapricornRuntimeSession } from './capricornRuntimeAdapter'

interface MarkdownLeaf {
  text: string
  marks?: Record<string, unknown>[]
}
interface MarkdownNode {
  klass?: string
  type?: string
  data?: Record<string, unknown>
  nodes?: MarkdownNode[]
  leaves?: MarkdownLeaf[]
}
interface ModelPoint {
  key: string
  offset?: number
  edge?: 'before' | 'after'
}
interface ModelDocument {
  getPath: (key: string) => number[] | null
  toJSON: () => MarkdownNode
}
interface MappingController {
  value: {
    document: ModelDocument
    selection: { anchor: ModelPoint; focus: ModelPoint } | null
  }
  serializer: {
    valueToMarkdown: (value: unknown) => Promise<string>
    markdownToValue: (markdown: string) => Promise<{ document: ModelDocument }>
  }
}

export interface MarkdownSelection {
  markdown: string
  /** UTF-16 offsets in markdown, before any CodeMirror newline normalization. */
  anchor: number
  head: number
}

const generatedIdentities = new Set(['groupId', 'htmlPairId', 'itemId', 'pairId'])
let markerSequence = 0
function markerFor(markdown: string) {
  let marker: string
  do marker = `\uE000mf${++markerSequence}\uE001`
  while (markdown.includes(marker))
  return marker
}
function query<T>(session: CapricornRuntimeSession, read: (controller: MappingController) => T) {
  const run = session.query as unknown as
    | ((read: (controller: MappingController) => T) => T)
    | undefined
  return run?.call(session, read)
}
function nodeAt(root: MarkdownNode, path: number[]) {
  let node: MarkdownNode | undefined = root
  for (const index of path) node = node?.nodes?.[index]
  return node
}
function markedDocument(document: MarkdownNode, point: ResumePoint, marker: string) {
  const clone = JSON.parse(JSON.stringify(document)) as MarkdownNode
  const node = nodeAt(clone, point.path)
  if (!node) return undefined
  if (typeof point.offset === 'number' && node.leaves) {
    let remaining = point.offset
    for (const leaf of node.leaves) {
      if (remaining <= leaf.text.length) {
        leaf.text = leaf.text.slice(0, remaining) + marker + leaf.text.slice(remaining)
        return clone
      }
      remaining -= leaf.text.length
    }
  } else if (point.edge && node.klass === 'inline') {
    const parent = nodeAt(clone, point.path.slice(0, -1))
    parent?.nodes?.splice(point.path.at(-1)! + (point.edge === 'after' ? 1 : 0), 0, {
      klass: 'text', leaves: [{ text: marker, marks: [] }],
    })
    return clone
  }
  return undefined
}
function markerOffset(serialized: string, marker: string, markdown: string) {
  const offset = serialized.indexOf(marker)
  return offset >= 0 && serialized.lastIndexOf(marker) === offset &&
    serialized.slice(0, offset) + serialized.slice(offset + marker.length) === markdown
    ? offset
    : undefined
}

interface TextLocation { path: number[]; offset: number }
interface NormalizedDocument {
  signature: string
  texts: Map<string, number[]>
  emptyTexts: Map<string, number[]>
  marker?: { path: string; offset: number; empty?: boolean }
  markerCount: number
}

/** Compare parser semantics, retaining identity relationships but not generated IDs.
 * Empty Text anchors are normalized by the runtime around inline nodes. */
function normalizeDocument(root: MarkdownNode, marker?: string): NormalizedDocument {
  const identities = new Map<string, number>()
  const texts = new Map<string, number[]>()
  const emptyTexts = new Map<string, number[]>()
  const result: NormalizedDocument = { signature: '', texts, emptyTexts, markerCount: 0 }
  const data = (value: unknown, property = ''): unknown => {
    if (typeof value === 'string' && generatedIdentities.has(property)) {
      if (!identities.has(value)) identities.set(value, identities.size)
      return identities.get(value)
    }
    // Visible source can also be mirrored in metadata, such as an autolink href
    // or inline math source. Only leaf text contributes a selectable location.
    if (typeof value === 'string' && marker) return value.split(marker).join('')
    if (Array.isArray(value)) return value.map((entry) => data(entry))
    if (value && typeof value === 'object') {
      let record = value
      // The codec retains exact link spelling and offsets relative to that spelling.
      // Removing our marker from text must also remove its shift in that provenance.
      if (property === 'linkSource' && marker && 'raw' in value && typeof value.raw === 'string') {
        const raw = value.raw
        record = Object.fromEntries(Object.entries(value).map(([key, entry]) => {
          if ((key === 'raw' || key === 'label') && typeof entry === 'string') {
            return [key, entry.split(marker).join('')]
          }
          if (['labelEnd', 'destinationStart', 'destinationEnd'].includes(key) && typeof entry === 'number') {
            return [key, entry - (raw.slice(0, entry).split(marker).length - 1) * marker.length]
          }
          return [key, entry]
        }))
      }
      return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, data(entry, key)]))
    }
    return value
  }
  const textContent = (node: MarkdownNode) =>
    node.leaves?.map((leaf) => marker ? leaf.text.split(marker).join('') : leaf.text).join('')
  const visit = (node: MarkdownNode, path: number[], normalizedPath: number[], emptyKey?: string): unknown => {
    const pathKey = normalizedPath.join('.')
    const nodeData = { ...node.data }
    delete nodeData.searchSource
    delete nodeData.sourceLine
    if (nodeData.markdown && typeof nodeData.markdown === 'object') {
      nodeData.markdown = { ...nodeData.markdown, newline: '\n' }
    }
    let offset = 0
    const leaves: { text: string; marks: unknown }[] = []
    for (const leaf of node.leaves ?? []) {
      const index = marker ? leaf.text.indexOf(marker) : -1
      if (index >= 0 && marker) {
        result.markerCount += leaf.text.split(marker).length - 1
        result.marker = { path: emptyKey ?? pathKey, offset: offset + index, empty: emptyKey !== undefined }
      }
      const text = marker ? leaf.text.split(marker).join('') : leaf.text
      offset += text.length
      if (!text) continue
      const marks = data(leaf.marks ?? [])
      const previous = leaves.at(-1)
      if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) previous.text += text
      else leaves.push({ text, marks })
    }
    if (node.leaves && emptyKey === undefined) texts.set(pathKey, path)
    const children: unknown[] = []
    for (const [index, child] of (node.nodes ?? []).entries()) {
      const childPath = [...path, index]
      const normalizedChild = [...normalizedPath, children.length]
      if (child.leaves && textContent(child) === '') {
        const key = `${pathKey}:${children.length}`
        if (!emptyTexts.has(key)) emptyTexts.set(key, childPath)
        visit(child, childPath, normalizedChild, key)
      } else children.push(visit(child, childPath, normalizedChild))
    }
    return [node.klass, node.type, data(nodeData), node.leaves ? leaves : null, children]
  }
  result.signature = JSON.stringify(visit(root, [], []))
  return result
}

function resolvedLocation(parsed: NormalizedDocument, current: NormalizedDocument): TextLocation | undefined {
  const marker = parsed.marker
  if (parsed.markerCount !== 1 || !marker || parsed.signature !== current.signature) return undefined
  const path = (marker.empty ? current.emptyTexts : current.texts).get(marker.path)
  return path ? { path, offset: marker.offset } : undefined
}

/** Probe only nearby syntax boundaries. Each attempt uses the runtime's parser;
 * never guess a caret by searching for another occurrence of visible text. */
function candidateOffsets(markdown: string, offset: number) {
  const offsets = [offset]
  for (let distance = 1; distance <= 4; distance += 1) offsets.push(offset + distance, offset - distance)
  return offsets.filter((candidate) => {
    if (candidate < 0 || candidate > markdown.length) return false
    const previous = markdown.charCodeAt(candidate - 1)
    const next = markdown.charCodeAt(candidate)
    return !(previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF)
  })
}

/** Map through isolated snapshots with the installed runtime's exact Markdown codec. */
export function createCapricornMarkdownSelectionApi(
  session: CapricornRuntimeSession,
  getMarkdown: () => string = () => session.getMarkdown(),
) {
  const snapshot = () => query(session, (controller) => ({
    document: controller.value.document,
    selection: controller.value.selection,
    json: controller.value.document.toJSON(),
    serialize: (value: unknown) => controller.serializer.valueToMarkdown(value),
    parse: (markdown: string) => controller.serializer.markdownToValue(markdown),
  }))
  const isCurrent = (saved: NonNullable<ReturnType<typeof snapshot>>) =>
    query(session, ({ value }) => value.document === saved.document && value.selection === saved.selection) === true

  return {
    async capture(): Promise<MarkdownSelection | undefined> {
      try {
        const saved = snapshot()
        if (!saved?.selection) return undefined
        // The host preserves original formatting until an edit. The codec may
        // serialize equivalent Markdown differently (for example list indentation).
        const markdown = getMarkdown()
        const serialized = session.getMarkdown()
        const isCurrentSource = () => isCurrent(saved) && getMarkdown() === markdown
        let sourceOffsets: ((offset: number) => Iterable<number>) | undefined
        let signature: string | undefined
        if (markdown !== serialized) {
          const [{ diff }, { ChangeSet, Text }] = await Promise.all([
            import('@codemirror/merge'), import('@codemirror/state'),
          ])
          if (!isCurrentSource()) return undefined
          const describeChanges = (before: string, after: string) => ChangeSet.of(
            diff(before, after, { scanLimit: 2000, timeout: 100 }).map((change) => ({
              from: change.fromA, to: change.toA, insert: after.slice(change.fromB, change.toB),
            })),
            before.length,
            // Offsets refer to raw UTF-16 strings, including both CRLF characters.
            '\n',
          ).desc
          const serializedLines = Text.of(serialized.split('\n'))
          const sourceLines = Text.of(markdown.split('\n'))
          let changes: ChangeDesc | undefined
          sourceOffsets = function* (offset) {
            // Indentation changes keep line numbers stable. Try the local diff
            // first so thousands of list items do not exhaust the global budget.
            // These are only candidates; the codec below still validates them.
            if (serializedLines.lines === sourceLines.lines) {
              const line = serializedLines.lineAt(offset)
              const sourceLine = sourceLines.line(line.number)
              const local = describeChanges(line.text, sourceLine.text)
              yield sourceLine.from + local.mapPos(offset - line.from, -1)
              yield sourceLine.from + local.mapPos(offset - line.from, 1)
            }
            if (!isCurrentSource()) return
            changes ??= describeChanges(serialized, markdown)
            yield changes.mapPos(offset, -1)
            yield changes.mapPos(offset, 1)
          }
          signature = normalizeDocument(saved.json).signature
        }
        const capturePoint = async (point: ModelPoint) => {
          if (!isCurrentSource()) return undefined
          const path = saved.document.getPath(point.key)
          if (!path) return undefined
          const marker = markerFor(markdown + serialized)
          const clone = markedDocument(saved.json, { path, offset: point.offset, edge: point.edge }, marker)
          if (!clone) return undefined
          const marked = await saved.serialize(clone)
          const offset = markerOffset(marked, marker, serialized)
          if (offset === undefined || !sourceOffsets) return offset

          // A diff only proposes positions. Reparse each candidate to verify the
          // same document and exact marked serialization, including repeated text
          // and inline atom boundaries, without mutating the live session.
          const tried = new Set<number>()
          for (const candidate of sourceOffsets(offset)) {
            if (!isCurrentSource()) return undefined
            if (tried.has(candidate)) continue
            tried.add(candidate)
            const value = await saved.parse(markdown.slice(0, candidate) + marker + markdown.slice(candidate))
            if (normalizeDocument(value.document.toJSON(), marker).signature === signature &&
              (await saved.serialize(value)).replace(/\r\n/g, '\n') === marked.replace(/\r\n/g, '\n')) return candidate
          }
          return undefined
        }
        const anchor = await capturePoint(saved.selection.anchor)
        const samePoint = saved.selection.anchor.key === saved.selection.focus.key &&
          saved.selection.anchor.offset === saved.selection.focus.offset &&
          saved.selection.anchor.edge === saved.selection.focus.edge
        const head = samePoint ? anchor : await capturePoint(saved.selection.focus)
        return isCurrentSource() && anchor !== undefined && head !== undefined ? { markdown, anchor, head } : undefined
      } catch {
        return undefined
      }
    },
    async resolve(markdown: string, selection: { anchor: number; head: number }): Promise<ResumeSelection | undefined> {
      try {
        if (![selection.anchor, selection.head].every((offset) => Number.isInteger(offset) && offset >= 0 && offset <= markdown.length)) return undefined
        const saved = snapshot()
        if (!saved) return undefined
        const current = normalizeDocument(saved.json)
        const serialized = session.getMarkdown()
        const resolvePoint = async (offset: number) => {
          for (const candidate of candidateOffsets(markdown, offset)) {
            if (!isCurrent(saved)) return undefined
            const marker = markerFor(markdown)
            const value = await saved.parse(markdown.slice(0, candidate) + marker + markdown.slice(candidate))
            const location = resolvedLocation(normalizeDocument(value.document.toJSON(), marker), current)
            if (location && markerOffset((await saved.serialize(value)).replace(/\r\n/g, '\n'), marker, serialized.replace(/\r\n/g, '\n')) !== undefined) return location
          }
          return undefined
        }
        const anchor = await resolvePoint(selection.anchor)
        const focus = selection.anchor === selection.head ? anchor : await resolvePoint(selection.head)
        return isCurrent(saved) && anchor && focus ? { kind: 'capricorn', anchor, focus } : undefined
      } catch {
        return undefined
      }
    },
  }
}
