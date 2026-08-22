import { isHTMLElement } from '@ocavue/utils'
import { PlainExtension } from '@rme-sdk/sdk/core'
import type { CreateExtensionPlugin, EditorView, ResolvedPos } from '@rme-sdk/sdk/core'
import { NodeSelection, TextSelection, type EditorState } from '@rme-sdk/sdk/pm/state'
import type { Transaction } from '@rme-sdk/sdk/pm/state'
import type { Slice } from '@rme-sdk/sdk/pm/model'
import { buildGetTarget } from './drop-target'
import type { GetTarget } from './drop-target'
import { findBlockByCoords, findBlockInteractionRect, findFirstLineRect } from './node-target'
import type { NodeIndicatorState, ViewDragging } from './types'

const EMPTY_NODE_INDICATOR_STATE: NodeIndicatorState = {
  node: null,
  pos: null,
  rect: null,
  interactionRect: null,
}

export class NodeIndicatorExtension extends PlainExtension {
  private nodeIndicatorState = EMPTY_NODE_INDICATOR_STATE
  private readonly nodeIndicatorStateListeners = new Set<() => void>()

  get name() {
    return 'nodeIndicator' as const
  }

  readonly getNodeIndicatorState = (): NodeIndicatorState => this.nodeIndicatorState

  readonly subscribeToNodeIndicatorState = (listener: () => void): (() => void) => {
    this.nodeIndicatorStateListeners.add(listener)
    return () => this.nodeIndicatorStateListeners.delete(listener)
  }

  clearNodeIndicatorState = (): void => {
    this.setNodeIndicatorState(EMPTY_NODE_INDICATOR_STATE)
  }

  private setNodeIndicatorState(nextState: NodeIndicatorState): void {
    if (
      this.nodeIndicatorState.node === nextState.node &&
      this.nodeIndicatorState.pos === nextState.pos &&
      this.nodeIndicatorState.rect === nextState.rect &&
      this.nodeIndicatorState.interactionRect === nextState.interactionRect
    ) {
      return
    }

    this.nodeIndicatorState = nextState
    this.nodeIndicatorStateListeners.forEach((listener) => listener())
  }

  createPlugin(): CreateExtensionPlugin {
    let getTarget: GetTarget | undefined
    let pointerMoveFrame: number | undefined
    let latestPointerMove: PointerEvent | undefined

    const cancelScheduledPointerMove = () => {
      if (pointerMoveFrame !== undefined) {
        cancelAnimationFrame(pointerMoveFrame)
        pointerMoveFrame = undefined
      }
      latestPointerMove = undefined
    }

    return {
      view: (view) => {
        getTarget = buildGetTarget(view)
        return {
          update: (updatedView: EditorView, previousState: EditorState) => {
            if (!updatedView.state.doc.eq(previousState.doc)) {
              this.clearNodeIndicatorState()
            }
          },
          destroy: () => {
            cancelScheduledPointerMove()
            this.clearNodeIndicatorState()
            getTarget = undefined
          },
        }
      },
      props: {
        handleDrop: (view, event, slice, move): boolean => {
          if (!getTarget) {
            return false
          }

          const target = getTarget([event.clientX, event.clientY], event)

          if (!target) {
            return false
          }

          event.preventDefault()
          const insertPos = target[0]

          const tr = createBlockDropTransaction(view, slice, move, insertPos)
          if (!tr) return false
          view.focus()
          view.dispatch(tr.setMeta('uiEvent', 'drop'))
          return true
        },
        handleDOMEvents: {
          pointerout: (view, event) => {
            const relatedTarget = (event as PointerEvent).relatedTarget as Node | null
            if (relatedTarget && view.dom.contains(relatedTarget)) {
              return false
            }
            if (relatedTarget && relatedTarget instanceof HTMLElement) {
              const blockHandler = relatedTarget.closest('.rme-block-handler')
              if (blockHandler) {
                return false
              }
            }
            cancelScheduledPointerMove()
            this.clearNodeIndicatorState()
            return false
          },
          pointermove: (view, event) => {
            latestPointerMove = event as PointerEvent
            if (pointerMoveFrame !== undefined) return false

            pointerMoveFrame = requestAnimationFrame(() => {
              pointerMoveFrame = undefined
              const latestEvent = latestPointerMove
              latestPointerMove = undefined
              if (latestEvent) {
                this.setNodeIndicatorState(
                  getNodeIndicatorStateAtPointer(
                    view,
                    latestEvent,
                    this.getNodeIndicatorState(),
                  ),
                )
              }
            })
            return false
          },
        },
      },
    }
  }
}

export function createBlockDropTransaction(
  view: EditorView,
  slice: Slice,
  move: boolean,
  insertPos: number,
): Transaction | null {
  const tr = view.state.tr

  if (move) {
    const { node } = (view.dragging as ViewDragging | null) || {}
    if (node) node.replace(tr)
    else tr.deleteSelection()
  }

  const pos = tr.mapping.map(insertPos)
  const isNode = slice.openStart === 0 && slice.openEnd === 0 && slice.content.childCount === 1
  const beforeInsert = tr.doc
  if (isNode) tr.replaceRangeWith(pos, pos, slice.content.firstChild!)
  else tr.replaceRange(pos, pos, slice)
  if (tr.doc.eq(beforeInsert)) return null

  const $pos = tr.doc.resolve(pos)
  if (
    isNode &&
    NodeSelection.isSelectable(slice.content.firstChild!) &&
    $pos.nodeAfter &&
    $pos.nodeAfter.sameMarkup(slice.content.firstChild!)
  ) {
    tr.setSelection(new NodeSelection($pos))
  } else {
    let end = tr.mapping.map(insertPos)
    tr.mapping.maps[tr.mapping.maps.length - 1]?.forEach(
      (_from, _to, _newFrom, newTo) => (end = newTo),
    )
    tr.setSelection(selectionBetween(view, $pos, tr.doc.resolve(end)))
  }

  return tr
}

function selectionBetween(
  view: EditorView,
  $anchor: ResolvedPos,
  $head: ResolvedPos,
  bias?: number,
) {
  return (
    view.someProp('createSelectionBetween', (f) => f(view, $anchor, $head)) ||
    TextSelection.between($anchor, $head, bias)
  )
}

function getNodeIndicatorStateAtPointer(
  view: EditorView,
  event: PointerEvent,
  currentState: NodeIndicatorState,
): NodeIndicatorState {
  const { x, y } = event

  const block = findBlockByCoords(view, x, y)

  if (!block) {
    return EMPTY_NODE_INDICATOR_STATE
  }

  const { node, pos } = block
  const element = view.nodeDOM(pos)
  if (!element || !isHTMLElement(element)) {
    return EMPTY_NODE_INDICATOR_STATE
  }

  let newNode = node
  let newPos = pos
  const $pos = view.state.doc.resolve(pos)

  if ($pos.depth > 0 && $pos.index($pos.depth) === 0) {
    const parentPos = $pos.before($pos.depth)
    const parentNode = $pos.parent
    newNode = parentNode
    newPos = parentPos
  }

  if (
    currentState.pos === newPos &&
    currentState.node &&
    newNode.type === currentState.node.type
  ) {
    return currentState
  }

  const newElement = view.nodeDOM(newPos)
  if (!newElement || !isHTMLElement(newElement)) {
    return currentState
  }

  let rect
  if ($pos.depth > 0 && $pos.index($pos.depth) === 0) {
    const parentElement = view.nodeDOM($pos.before($pos.depth))
    rect = findFirstLineRect(parentElement, newElement)
  } else {
    rect = findFirstLineRect(undefined, newElement)
  }

  return {
    node: newNode,
    pos: newPos,
    rect: rect || null,
    interactionRect: findBlockInteractionRect(newElement) || rect || null,
  }
}

export type { NodeIndicatorPluginOptions, NodeIndicatorState } from './types'
