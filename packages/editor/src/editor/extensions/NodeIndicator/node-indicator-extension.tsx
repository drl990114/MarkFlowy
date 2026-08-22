import { isHTMLElement } from '@ocavue/utils'
import { PlainExtension } from '@rme-sdk/sdk/core'
import type { CreateExtensionPlugin, EditorView, ResolvedPos } from '@rme-sdk/sdk/core'
import { NodeSelection, TextSelection } from '@rme-sdk/sdk/pm/state'
import type { PluginKey } from '@rme-sdk/sdk/pm/state'
import { buildGetTarget } from './drop-target'
import type { GetTarget } from './drop-target'
import {
  findBlockByCoords,
  findBlockInteractionRect,
  findFirstLineRect,
} from './node-target'
import type { NodeIndicatorState, ViewDragging } from './types'

export class NodeIndicatorExtension extends PlainExtension {
  get name() {
    return 'nodeIndicator' as const
  }

  createPlugin(): CreateExtensionPlugin<NodeIndicatorState> {
    let getTarget: GetTarget | undefined

    const initialState: NodeIndicatorState = {
      node: null,
      pos: null,
      rect: null,
      interactionRect: null,
    }
    return {
      initialState,
      state: {
        init: () => initialState,
        apply: (tr, value) => {
          const meta = tr.getMeta(this.pluginKey)
          if (meta) {
            return { ...value, ...meta }
          }

          if (tr.docChanged) {
            return { ...value }
          }
          return value
        },
      },
      view: (view) => {
        getTarget = buildGetTarget(view)
        return {}
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

          const tr = view.state.tr

          if (move) {
            const { node } = (view.dragging as ViewDragging | null) || {}
            if (node) node.replace(tr)
            else tr.deleteSelection()
          }

          const pos = tr.mapping.map(insertPos)
          const isNode = slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1
          const beforeInsert = tr.doc
          if (isNode) tr.replaceRangeWith(pos, pos, slice.content.firstChild!)
          else tr.replaceRange(pos, pos, slice)
          if (tr.doc.eq(beforeInsert)) {
            return false
          }

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
            tr.mapping.maps[tr.mapping.maps.length - 1].forEach(
              (_from, _to, _newFrom, newTo) => (end = newTo),
            )
            tr.setSelection(selectionBetween(view, $pos, tr.doc.resolve(end)))
          }
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
            const currentState = this.pluginKey.getState(view.state)
            if (currentState?.node !== null) {
              view.dispatch(
                view.state.tr.setMeta(this.pluginKey, {
                  node: null,
                  pos: null,
                  rect: null,
                  interactionRect: null,
                }),
              )
            }
            return false
          },
          pointermove: (view, event) => {
            if ((view as any).__nodeIndicatorThrottled) {
              return
            }
            ;(view as any).__nodeIndicatorThrottled = true
            requestAnimationFrame(() => {
              ;(view as any).__nodeIndicatorThrottled = false
              handlePointerMove(view, event, this.pluginKey)
            })
          },
        },
      },
    }
  }
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

function handlePointerMove(view: EditorView, event: Event, pluginKey: PluginKey) {
  const currentState = pluginKey.getState(view.state)
  const { x, y } = event as PointerEvent

  const block = findBlockByCoords(view, x, y)

  if (!block) {
    if (currentState?.node !== null) {
      view.dispatch(
        view.state.tr.setMeta(pluginKey, {
          node: null,
          pos: null,
          rect: null,
          interactionRect: null,
        }),
      )
    }
    return
  }

  const { node, pos } = block
  const element = view.nodeDOM(pos)
  if (!element || !isHTMLElement(element)) {
    if (currentState?.node !== null) {
      view.dispatch(
        view.state.tr.setMeta(pluginKey, {
          node: null,
          pos: null,
          rect: null,
          interactionRect: null,
        }),
      )
    }
    return
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

  if (currentState?.pos === newPos && currentState?.node && newNode.type === currentState?.node.type) {
    return
  }

  const newElement = view.nodeDOM(newPos)
  if (!newElement || !isHTMLElement(newElement)) {
    return
  }

  let rect
  if ($pos.depth > 0 && $pos.index($pos.depth) === 0) {
    const parentElement = view.nodeDOM($pos.before($pos.depth))
    rect = findFirstLineRect(parentElement, newElement)
  } else {
    rect = findFirstLineRect(undefined, newElement)
  }

  view.dispatch(
    view.state.tr.setMeta(pluginKey, {
      node: newNode,
      pos: newPos,
      rect: rect || null,
      interactionRect: findBlockInteractionRect(newElement) || rect || null,
    }),
  )
}

export type { NodeIndicatorPluginOptions, NodeIndicatorState } from './types'
