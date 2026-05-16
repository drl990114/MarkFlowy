import { findParentNodeOfType, FindProsemirrorNodeResult, NodeWithPosition } from '@rme-sdk/core'
import { TableSchemaSpec } from '@rme-sdk/extension-tables'
import { EditorState, NodeType, ResolvedPos, Selection } from '@rme-sdk/pm'
import { CellSelection, Rect, TableMap } from '@rme-sdk/pm/tables'

export function findTable(selection: EditorState | Selection | ResolvedPos) {
  return findParentNodeOfType({ selection, types: 'table' })
}

function findCellsInReat(
  table: FindProsemirrorNodeResult,
  map: TableMap,
  rect: { top: number; bottom: number; left: number; right: number },
): NodeWithPosition[] {
  return map.cellsInRect(rect).map((cellPos) => {
    const node = table.node.nodeAt(cellPos)
    const pos = cellPos + table.start
    if (!node) throw new RangeError(`unable to find a table cell node at position ${pos}`)
    return { node, pos }
  })
}

export function getCellsInColumn(
  selection: EditorState | Selection | ResolvedPos,
  columnIndex: number,
): NodeWithPosition[] {
  const table = findTable(selection)
  if (!table) return []
  const map = TableMap.get(table.node)
  if (columnIndex < 0 || columnIndex >= map.width) return []
  return findCellsInReat(table, map, {
    top: 0,
    bottom: map.height,
    left: columnIndex,
    right: columnIndex + 1,
  })
}

export function getCellsInRow(
  selection: EditorState | Selection | ResolvedPos,
  rowIndex: number,
): NodeWithPosition[] {
  const table = findTable(selection)
  if (!table) return []
  const map = TableMap.get(table.node)
  if (rowIndex < 0 || rowIndex >= map.height) return []
  return findCellsInReat(table, map, {
    top: rowIndex,
    bottom: rowIndex + 1,
    left: 0,
    right: map.width,
  })
}

export function getCellsInRect(
  selection: Selection,
  rect: { top: number; bottom: number; left: number; right: number },
): NodeWithPosition[] {
  const table = findTable(selection)
  if (!table) return []
  const map = TableMap.get(table.node)
  return findCellsInReat(table, map, rect)
}

/**
 * All available cell selection type.
 *
 * @remarks
 *
 * - "table": This selection includes all cells in the table.
 * - "row": This selection goes all the way from the left to the right of the table.
 * - "column": This selection goes all the way from the top to the bottom of the table.
 * - "cell": This selection is neither any of the above. *
 */
export type CellSelectionType = 'table' | 'row' | 'column' | 'cell'

const cellSelectionTypeCache = new WeakMap<CellSelection, CellSelectionType>()

/**
 * Returns the type of the cell selection if it is a cell selection.
 */
export function getCellSelectionType(selection: CellSelection): CellSelectionType {
  let type = cellSelectionTypeCache.get(selection)
  if (!type) {
    type = calcCellSelectionType(selection)
    cellSelectionTypeCache.set(selection, type)
  }
  return type
}

function calcCellSelectionType(selection: CellSelection): CellSelectionType {
  const isColSelection = selection.isColSelection()
  const isRowSelection = selection.isRowSelection()

  if (isColSelection && isRowSelection) {
    return 'table'
  } else if (isColSelection) {
    return 'column'
  } else if (isRowSelection) {
    return 'row'
  } else {
    return 'cell'
  }
}

export function getCellSelectionRect(selection: CellSelection): Rect {
  const table = selection.$anchorCell.node(-1)
  const map = TableMap.get(table)
  const start = selection.$anchorCell.start(-1)
  return map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start)
}

/**
 * Count the number of cells in the given cell selection. Noting that this
 * may be inaccurate if the selection contains merged cells.
 */
export function countCellSelection(selection: CellSelection): number {
  const rect = getCellSelectionRect(selection)
  return (rect.right - rect.left) * (rect.bottom - rect.top)
}

export function isTableType(type: NodeType): boolean {
  return (type.spec as TableSchemaSpec).tableRole === 'table'
}

export function isRowType(type: NodeType): boolean {
  return (type.spec as TableSchemaSpec).tableRole === 'row'
}

export function isCellType(type: NodeType): boolean {
  return (type.spec as TableSchemaSpec).tableRole === 'cell'
}
