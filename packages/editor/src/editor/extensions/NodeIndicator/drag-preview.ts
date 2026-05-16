import { isHTMLElement } from '@ocavue/utils'
import { EditorView, Fragment, Slice } from '@rme-sdk/pm'
import { NodeSelection } from '@rme-sdk/pm/state'
import { NodeIndicatorState } from '.'
import { getBoxElement } from '../../utils/get-box-element'
import { setDragPreview } from './set-drag-preview'

export function createDraggingPreview(
  view: EditorView,
  hoverState: NodeIndicatorState,
  event: React.DragEvent<HTMLDivElement>,
): void {
  if (!event.dataTransfer) {
    return
  }

  const { pos } = hoverState

  if (pos == null) {
    return
  }

  const element = view.nodeDOM(pos)
  if (!element || !isHTMLElement(element)) {
    return
  }

  const boxElement = getBoxElement(element)
  if (!boxElement || !isHTMLElement(boxElement)) {
    return
  }

  event.dataTransfer.clearData()
  event.dataTransfer.setData('text/html', boxElement.outerHTML)
  event.dataTransfer.effectAllowed = 'copyMove'
  setDragPreview(event, boxElement)

  return
}

export function setViewDragging(view: EditorView, hoverState: any): void {
  const { node, pos } = hoverState

  const dragging = {
    slice: new Slice(Fragment.from(node), 0, 0),
    move: true,
    node: NodeSelection.create(view.state.doc, pos),
  }

  view.dragging = dragging
}
