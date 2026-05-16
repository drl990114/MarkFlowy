import type { ResolvedPos, Selection } from '@rme-sdk/core-types'
import type { PositionerPosition } from '@rme-sdk/extension-positioner'
import { Positioner, hasStateChanged, isPositionVisible } from '@rme-sdk/extension-positioner'
import type { ActiveCellColumnPositionerData } from '@rme-sdk/extension-tables'
import type { FindProsemirrorNodeResult, Shape } from '@rme-sdk/main'
import { findParentNodeOfType, isElementDomNode } from '@rme-sdk/main'

export interface PositionerIllustrationProps {
  positioner: Positioner
}

function findTable(selection: Selection | ResolvedPos): FindProsemirrorNodeResult | undefined {
  return findParentNodeOfType({ selection, types: 'table' })
}

function findCellClosestToPos(
  selection: Selection | ResolvedPos,
): FindProsemirrorNodeResult | undefined {
  return findParentNodeOfType({ selection, types: ['tableHeaderCell', 'tableCell'] })
}

const basePosition = { y: -999_999, x: -999_999, width: 0, height: 0 }
const baseRect = {
  ...basePosition,
  left: -999_999,
  top: -999_999,
  bottom: -999_999,
  right: -999_999,
}

const defaultAbsolutePosition: PositionerPosition = {
  ...basePosition,
  rect: { ...baseRect, toJSON: () => baseRect as Shape },
  visible: false,
}

export const activeCellColumnAndRowPositioner = Positioner.create<ActiveCellColumnPositionerData>({
  hasChanged: hasStateChanged,

  getActive(props) {
    const { state, view } = props
    const { selection } = state
    const table = findTable(selection)

    if (!table) {
      return Positioner.EMPTY
    }

    const cell = findCellClosestToPos(selection)
    if (!cell) {
      return Positioner.EMPTY
    }

    const { pos } = cell
    const tableNode = view.nodeDOM(table.pos)
    const node = view.nodeDOM(pos)

    if (!isElementDomNode(tableNode) || !isElementDomNode(node)) {
      return Positioner.EMPTY
    }

    const tableRect = tableNode.getBoundingClientRect()
    const rect = node.getBoundingClientRect()

    return [
      {
        pos: table.pos,
        rect: new DOMRect(tableRect.x, tableRect.y, tableRect.width, tableRect.height),
      },
      {
        pos,
        rect: new DOMRect(rect.x, tableRect.y, rect.width, tableRect.height),
      },
    ]
  },

  getID(data) {
    return `${data.pos}`
  },

  getPosition(props) {
    const { view, data: cell } = props
    const node = view.nodeDOM(cell.pos)

    if (!isElementDomNode(node)) {
      // This should never happen.
      return defaultAbsolutePosition
    }

    const rect = node.getBoundingClientRect()
    const editorRect = view.dom.getBoundingClientRect()

    const width = rect.width

    // The top and left relative to the parent `editorRect`.
    const left = view.dom.scrollLeft + rect.left - editorRect.left
    const top = view.dom.scrollTop + rect.top - editorRect.top
    const height = rect.height

    const columnTopRect = new DOMRect(rect.x, rect.y, width, height)

    return {
      x: left, // padding: 0 20px
      y: top,
      width,
      height,
      rect: columnTopRect,
      visible: isPositionVisible(columnTopRect, view.dom),
    }
  },
})
