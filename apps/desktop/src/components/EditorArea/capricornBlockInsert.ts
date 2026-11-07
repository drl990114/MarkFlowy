import type { CapricornRuntimeSession } from './capricornRuntimeAdapter'
import { createCapricornResumeApi } from './capricornResume'

interface BlockNode {
  key: string
  type?: string
  data: Record<string, unknown>
  nodes: BlockNode[]
  merge: (properties: { nodes: BlockNode[] }) => BlockNode
}
interface InsertController {
  value: { document: BlockNode; selection: unknown }
  serializer: { markdownToValue: (markdown: string) => Promise<{ document: BlockNode }> }
}

function query<T>(session: CapricornRuntimeSession, read: (controller: InsertController) => T) {
  const run = session.query as unknown as (read: (controller: InsertController) => T) => T
  return run.call(session, read)
}

export function canInsertCapricornBlock(session: CapricornRuntimeSession): boolean {
  if (!session.query || !session.execute || session.getUiState().readOnly) return false
  const selection = createCapricornResumeApi(session).capture()
  // Tables have nested cells, while supported Markdown blocks are flat.
  return selection?.kind === 'capricorn' &&
    selection.anchor.path.length === 2 && selection.focus.path.length === 2
}

/** Compatibility bridge for 0.5.13: its single-node insert merges source into a
 * paragraph. Structural paragraph boundaries make insertFragment preserve the
 * parsed block and split the surrounding paragraph, in a single undo step. */
export function createCapricornBlockInsertApi(
  session: CapricornRuntimeSession,
  container: HTMLElement,
  isActive: () => boolean,
) {
  if (!session.query || !session.execute) return undefined
  const resume = createCapricornResumeApi(session)
  return async (kind: 'code' | 'math', source: string, isCurrent: () => boolean) => {
    if (!isActive() || !isCurrent() || !canInsertCapricornBlock(session)) return false
    const before = query(session, (controller) => controller.value)
    const parse = query(session, (controller) =>
      controller.serializer.markdownToValue.bind(controller.serializer),
    )
    let fenceLength = 3
    for (const match of source.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1)
    const fence = kind === 'math' ? '$$' : '`'.repeat(fenceLength)
    const [block, blank] = await Promise.all([
      parse(`${fence}\n${source}\n${fence}`),
      parse(''),
    ])
    if (!isActive() || !isCurrent() || session.getUiState().readOnly) return false
    const current = query(session, (controller) => controller.value)
    if (current.document !== before.document || current.selection !== before.selection) return false
    const type = `${kind}-block`
    if (!block.document.nodes.length || block.document.nodes.some((node) => node.type !== type))
      return false
    const group = block.document.nodes[0].data.groupId
    // A selected $$ delimiter must not silently turn the source into two formulas.
    if (typeof group !== 'string' || block.document.nodes.some((node) => node.data.groupId !== group))
      return false
    const fragment = block.document.merge({
      nodes: [...blank.document.nodes, ...block.document.nodes, ...blank.document.nodes],
    })
    session.execute!('insertFragment', fragment)
    const inserted = query(session, (controller) => controller.value.document)
    const index = inserted.nodes.findIndex((node) => node.data.groupId === group)
    if (index < 0) return false
    resume.restore({
      kind: 'capricorn',
      anchor: { path: [index, 0], offset: 0 },
      focus: { path: [index, 0], offset: 0 },
    })
    session.focus()
    if (kind === 'math') {
      // Reuse the runtime's source-edit control: it owns lazy CodeMirror and
      // focus. Rendering can complete after the first animation frame.
      let frame = 0
      const stop = () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
        clearTimeout(timeout)
      }
      const activate = () => {
        frame = 0
        if (!isActive() || !container.isConnected || session.getUiState().readOnly) return stop()
        const focused = container.ownerDocument.activeElement
        if (focused !== container.ownerDocument.body &&
          focused?.getAttribute('data-cap-dockey') !== inserted.key) return stop()
        const activeSelection = resume.capture()
        if (query(session, (controller) => controller.value.document) !== inserted ||
          activeSelection?.kind !== 'capricorn' || activeSelection.focus.path[0] !== index) return stop()
        const button = container.querySelector(`[data-cap-key="${inserted.nodes[index].key}"]`)
          ?.querySelector<HTMLButtonElement>(
            '.capricorn-live-preview-action[aria-controls][aria-expanded="false"]',
          )
        if (button) {
          stop()
          button.click()
        }
      }
      const schedule = () => { if (!frame) frame = requestAnimationFrame(activate) }
      const observer = new MutationObserver(schedule)
      const timeout = setTimeout(stop, 2000)
      observer.observe(container, { childList: true, subtree: true })
      schedule()
    }
    return true
  }
}
