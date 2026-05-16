import type { VirtualElement } from '@floating-ui/dom'
import {
  isElement,
  isHTMLElement,
  isTextNode,
} from '@ocavue/utils'
import type { Node as ProseMirrorNode } from '@rme-sdk/pm/model'
import type { EditorView } from '@rme-sdk/pm/view'

import { getClientRect } from '../../utils/get-client-rect'
import { Rect } from './types'

export interface HoverState {
  node: ProseMirrorNode
  pos: number
}

export type ElementHoverHandler = (
  reference: VirtualElement | null,
  hoverState: HoverState | null,
) => void


export function findBlockByCoords(view: EditorView, x: number, y: number): { node: ProseMirrorNode; pos: number } | undefined {
  const rect = getClientRect(view.dom)
  if (!isWithinRect(rect, x, y)) {
    return
  }

  let parent: ProseMirrorNode | undefined = view.state.doc
  let pos = -1

  while (parent) {
    if (parent.isBlock && (parent.isTextblock || parent.isAtom || parent.type.spec.isolating)) {
      return { node: parent, pos }
    }

    // Collect all children and their positions
    const children: ProseMirrorNode[] = []
    const positions: number[] = []
    parent.forEach((child, offset) => {
      children.push(child)
      positions.push(offset + pos + 1)
    })

    let lo = 0
    let hi = children.length - 1

    while (lo <= hi) {
      const i = hi - ((hi - lo) >> 1)
      const childDOM = view.nodeDOM(positions[i])
      const childRect = getNodeRect(childDOM)
      if (!childRect) {
        console.warn(`[rme] Unable to get rect at position: ${positions[i]}`)
        return
      }
      if (childRect.top > y) {
        hi = i - 1
      } else if (childRect.bottom < y) {
        lo = i + 1
      } else {
        lo = i
        break
      }
    }

    if (lo > hi) {
      return
    }

    parent = children[lo]
    pos = positions[lo]
  }
}

function getNodeRect(node: Node | null | undefined): Rect | undefined {
  if (node && isElement(node) && node.isConnected) {
    return getClientRect(node)
  }
}

function isWithinRect(rect: Rect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

export function findFirstLineRect(outer?: Node | null, inner?: Node | null): Rect | undefined {
  if (outer && !outer.isConnected) {
    return
  }
  if (inner && !inner.isConnected) {
    return
  }

  if (outer && inner) {
    const outerRect = findOuterRect(outer)
    const innerRect = findFirstLineRectInNode(inner)
    if (outerRect && innerRect) {
      const { top, bottom } = innerRect
      const { left, right } = outerRect
      return { top, bottom, left, right }
    } else {
      return outerRect || innerRect
    }
  } else if (outer) {
    return findFirstLineRectInNode(outer)
  } else if (inner) {
    return findFirstLineRectInNode(inner)
  }
}

function findOuterRect(node: Node): Rect | undefined {
  if (!isElement(node)) {
    return
  }

  const rect = getClientRect(node)
  const style = node.ownerDocument.defaultView?.getComputedStyle(node)
  const marginLeft = style && Number.parseInt(style.marginLeft, 10) || 0
  const marginRight = style && Number.parseInt(style.marginRight, 10) || 0
  const left = rect.left - marginLeft
  const right = rect.right + marginRight

  return { top: rect.top, bottom: rect.bottom, left, right }
}

function findFirstLineRectInNode(node: Node): Rect | undefined {
  if (isElement(node)) {
    return findFirstLineRectInElement(node)
  } else if (isTextNode(node)) {
    return findFirstLineRectInTextNode(node)
  }
}

function findFirstLineRectInTextNode(node: Text): Rect | undefined {
  const ownerDocument = node.ownerDocument
  if (!ownerDocument) {
    return
  }
  const range = ownerDocument.createRange()
  range.setStart(node, 0)
  range.setEnd(node, 0)
  const rects = range.getClientRects()
  return rects[0]
}

function findFirstLineRectInElement(element: Element): Rect | undefined {
  if (element.nodeName === 'BR') {
    return element.getBoundingClientRect()
  }

  const rect = getClientRect(element)
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  const marginLeft = style && Number.parseInt(style.marginLeft, 10) || 0
  const marginRight = style && Number.parseInt(style.marginRight, 10) || 0
  const left = rect.left - marginLeft
  const right = rect.right + marginRight

  const lineHeight = style && Number.parseInt(style.lineHeight, 10) || 24
  const paddingTop = style && Number.parseInt(style.paddingTop, 10) || 0
  const borderTop = style && Number.parseInt(style.borderTopWidth, 10) || 0
  const top = rect.top + paddingTop + borderTop
  const bottom = top + lineHeight

  return { top, bottom, left, right }
}
