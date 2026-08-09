import { findParentNodeOfType } from '@rme-sdk/sdk/core'
import type { FindProsemirrorNodeResult, NodeWithPosition } from '@rme-sdk/sdk/core'
import type { TableSchemaSpec } from '@rme-sdk/sdk/extensions/tables'
import type { EditorState, NodeType, ResolvedPos, Selection } from '@rme-sdk/sdk/pm'
import { selectAll } from '@rme-sdk/sdk/pm/commands'
import type { Node as ProsemirrorNode } from '@rme-sdk/sdk/pm/model'
import { AllSelection, TextSelection } from '@rme-sdk/sdk/pm/state'
import type { Command, Transaction } from '@rme-sdk/sdk/pm/state'
import { addRow, CellSelection, isCellSelection, selectedRect, TableMap } from '@rme-sdk/sdk/pm/tables'
import type { Rect } from '@rme-sdk/sdk/pm/tables'

export const TABLE_ALIGNMENTS = ['left', 'center', 'right'] as const

export type TableAlignment = (typeof TABLE_ALIGNMENTS)[number]

export function normalizeTableAlignment(value: unknown): TableAlignment | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  if (TABLE_ALIGNMENTS.includes(normalized as TableAlignment)) {
    return normalized as TableAlignment
  }

  const styleMatch = normalized.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/)
  return styleMatch ? (styleMatch[1] as TableAlignment) : null
}

export function findTable(selection: EditorState | Selection | ResolvedPos) {
  return findParentNodeOfType({ selection, types: 'table' })
}

export const exitTable: Command = (state, dispatch) => {
  const table = findTable(state.selection)
  if (!table) return false

  const paragraphType = state.schema.nodes.paragraph
  const paragraph = paragraphType?.createAndFill()
  if (!paragraph) return false

  const parentDepth = table.depth - 1
  const parent = state.selection.$from.node(parentDepth)
  const insertIndex = state.selection.$from.indexAfter(parentDepth)
  if (!parent.canReplaceWith(insertIndex, insertIndex, paragraphType)) return false

  if (dispatch) {
    const tr = state.tr.insert(table.end, paragraph)
    tr.setSelection(TextSelection.near(tr.doc.resolve(table.end + 1), 1))
    dispatch(tr.scrollIntoView())
  }

  return true
}

export function getTableColumnAlignments(
  table: ProsemirrorNode,
  map = TableMap.get(table),
): (TableAlignment | null)[] {
  const alignments: (TableAlignment | null)[] = []

  for (let columnIndex = 0; columnIndex < map.width; columnIndex++) {
    const cell = table.nodeAt(map.map[columnIndex])
    alignments.push(normalizeTableAlignment(cell?.attrs.align))
  }

  return alignments
}

export function applyTableRowColumnAlignments(
  tr: Transaction,
  tableStart: number,
  rowIndex: number,
  alignments: readonly (TableAlignment | null)[],
): Transaction {
  const table = tr.doc.nodeAt(tableStart - 1)
  if (!table) return tr

  const map = TableMap.get(table)
  const seenCells = new Set<number>()

  for (let columnIndex = 0; columnIndex < map.width; columnIndex++) {
    const cellPos = map.positionAt(rowIndex, columnIndex, table)
    if (seenCells.has(cellPos)) continue
    seenCells.add(cellPos)

    const cell = table.nodeAt(cellPos)
    const alignment = alignments[columnIndex] ?? null
    if (!cell || normalizeTableAlignment(cell.attrs.align) === alignment) continue

    tr.setNodeMarkup(tableStart + cellPos, undefined, {
      ...cell.attrs,
      align: alignment,
    })
  }

  return tr
}

export function addTableRowWithAlignment(position: 'before' | 'after'): Command {
  return (state, dispatch) => {
    if (!findTable(state.selection)) return false

    if (dispatch) {
      const rect = selectedRect(state)
      const rowIndex = position === 'before' ? rect.top : rect.bottom
      const alignments = getTableColumnAlignments(rect.table, rect.map)
      const tr = addRow(state.tr, rect, rowIndex)
      applyTableRowColumnAlignments(tr, rect.tableStart, rowIndex, alignments)
      dispatch(tr)
    }

    return true
  }
}

export function setTableColumnAlignment(alignment: TableAlignment): Command {
  return (state, dispatch) => {
    if (!findTable(state.selection)) return false

    const rect = selectedRect(state)
    const cellPositions = rect.map.cellsInRect({
      top: 0,
      bottom: rect.map.height,
      left: rect.left,
      right: rect.right,
    })
    const changedCells = cellPositions.filter((cellPos) => {
      const cell = rect.table.nodeAt(cellPos)
      return cell && normalizeTableAlignment(cell.attrs.align) !== alignment
    })

    if (changedCells.length === 0) return false

    if (dispatch) {
      const tr = state.tr
      for (const cellPos of changedCells) {
        const cell = rect.table.nodeAt(cellPos)
        if (!cell) continue
        tr.setNodeMarkup(rect.tableStart + cellPos, undefined, {
          ...cell.attrs,
          align: alignment,
        })
      }
      dispatch(tr)
    }

    return true
  }
}

export function getSelectedTableColumnAlignment(
  state: EditorState,
): TableAlignment | null | undefined {
  if (!findTable(state.selection)) return undefined

  const rect = selectedRect(state)
  const alignments = getTableColumnAlignments(rect.table, rect.map).slice(rect.left, rect.right)
  const firstAlignment = alignments[0] ?? null
  return alignments.every((alignment) => alignment === firstAlignment)
    ? firstAlignment
    : undefined
}

function selectCompleteTable(
  state: EditorState,
  dispatch: Parameters<Command>[1],
  table: FindProsemirrorNodeResult,
) {
  if (dispatch) {
    const map = TableMap.get(table.node)
    const firstCellPos = map.map[0]
    const lastCellPos = map.map[map.map.length - 1]
    dispatch(
      state.tr
        .setSelection(
          // Keep the primary range on the top-left cell. The custom copy shortcut
          // uses execCommand, which can skip copying when the head cell is empty.
          CellSelection.create(
            state.doc,
            table.start + lastCellPos,
            table.start + firstCellPos,
          ),
        )
        .scrollIntoView(),
    )
  }
  return true
}

export const selectTableInStages: Command = (state, dispatch) => {
  const { selection } = state
  const table = findTable(selection)
  if (!table) return false

  if (!isCellSelection(selection)) {
    const endTable = findTable(selection.$to)
    if (!endTable || endTable.pos !== table.pos) return false
  }

  if (isCellSelection(selection) && getCellSelectionType(selection) === 'table') {
    dispatch?.(
      state.tr
        .setSelection(new AllSelection(state.doc))
        .scrollIntoView(),
    )
    return true
  }

  if (isCellSelection(selection)) {
    return selectCompleteTable(state, dispatch, table)
  }

  const cell = findParentNodeOfType({
    selection: selection.$head,
    types: ['tableHeaderCell', 'tableCell'],
  })
  if (!cell) return false

  dispatch?.(
    state.tr
      .setSelection(CellSelection.create(state.doc, cell.pos))
      .scrollIntoView(),
  )
  return true
}

export const selectAllInStages: Command = (state, dispatch) => {
  return selectTableInStages(state, dispatch) || selectAll(state, dispatch)
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
