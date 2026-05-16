import { findParentNodeOfType } from '@rme-sdk/core'
import { Transaction } from '@rme-sdk/pm/state'
import { CellSelection, TableMap } from '@rme-sdk/pm/tables'

export function selectRow(tr: Transaction, pos: number): boolean {
  const cell = findParentNodeOfType({ selection: tr.doc.resolve(pos), types: 'tableCell' })

  if (!cell) {
    return false
  }

  tr.setSelection(CellSelection.rowSelection(tr.doc.resolve(cell.pos)))
  return true
}

export function selectColumn(tr: Transaction, pos: number): boolean {
  const cell = findParentNodeOfType({ selection: tr.doc.resolve(pos), types: 'tableCell' })

  if (!cell) {
    return false
  }

  tr.setSelection(CellSelection.colSelection(tr.doc.resolve(cell.pos)))
  return true
}

export function selectTable(tr: Transaction, pos: number): boolean {
  const table = findParentNodeOfType({ selection: tr.doc.resolve(pos), types: 'table' })

  if (!table) {
    return false
  }

  const map = TableMap.get(table.node)

  if (!map.map.length) {
    return false
  }

  const firstCellPos = map.map[0]
  const lastCellPos = map.map[map.map.length - 1]

  tr.setSelection(
    CellSelection.create(tr.doc, table.start + firstCellPos, table.start + lastCellPos),
  )
  return true
}

export function selectCell(tr: Transaction, pos: number): boolean {
  tr.setSelection(CellSelection.create(tr.doc, pos))
  return true
}
