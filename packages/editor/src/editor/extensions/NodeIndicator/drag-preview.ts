import { isHTMLElement } from '@ocavue/utils'
import { createListItemDragSlice, isListItemNode } from '@rme-sdk/sdk/extensions/list'
import { Fragment, Slice } from '@rme-sdk/sdk/pm/model'
import { NodeSelection } from '@rme-sdk/sdk/pm/state'
import type { EditorView } from '@rme-sdk/sdk/pm/view'
import type { NodeIndicatorState, ViewDragging } from './types'
import { getBoxElement } from '../../utils/get-box-element'
import { setDragPreview } from './set-drag-preview'

export function startViewDragging(
  view: EditorView,
  hoverState: NodeIndicatorState,
  event: React.DragEvent<HTMLDivElement>,
): void {
  const { node, pos } = hoverState
  if (!node || pos == null) {
    return
  }

  const sourceSlice = isListItemNode(node)
    ? createListItemDragSlice(view.state.doc, pos)
    : new Slice(Fragment.from(node), 0, 0)
  if (!sourceSlice) return

  const { dom, text, slice } = view.serializeForClipboard(sourceSlice)

  if (event.dataTransfer) {
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/html', dom.innerHTML)
    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.effectAllowed = 'copyMove'

    const element = view.nodeDOM(pos)
    if (element && isHTMLElement(element)) {
      const boxElement = getBoxElement(element)
      if (boxElement && isHTMLElement(boxElement)) {
        setDragPreview(event, boxElement)
      }
    }
  }

  const dragging: ViewDragging = {
    slice,
    move: true,
    node: NodeSelection.create(view.state.doc, pos),
  }

  view.dragging = dragging
}

export function clearViewDragging(view: EditorView): void {
  const dragging = view.dragging
  if (!dragging) return

  window.setTimeout(() => {
    if (view.dragging === dragging) {
      view.dragging = null
    }
  }, 50)
}
