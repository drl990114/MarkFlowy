import type { EditorView, ProsemirrorNode } from '@rme-sdk/sdk/pm'

const clipboardEventTypes = new Set(['copy', 'cut'])

/**
 * Let ProseMirror serialize clipboard data when its selection crosses this
 * nested editor's boundary. Local CodeMirror selections still handle their
 * own clipboard events.
 */
export function shouldStopNodeViewEvent(
  event: Event,
  view: EditorView,
  getPos: () => number,
  node: ProsemirrorNode,
): boolean {
  if (!clipboardEventTypes.has(event.type)) {
    return true
  }

  const nodeStart = getPos()
  const nodeEnd = nodeStart + node.nodeSize
  const { from, to } = view.state.selection

  return from > nodeStart && to < nodeEnd
}
