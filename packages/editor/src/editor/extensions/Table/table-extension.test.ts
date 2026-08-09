import { NamedShortcut } from '@rme-sdk/sdk/core'
import { createTable as createRemirrorTable } from '@rme-sdk/sdk/extensions/tables'
import { DOMSerializer, Schema } from '@rme-sdk/sdk/pm/model'
import type { Node as ProsemirrorNode } from '@rme-sdk/sdk/pm/model'
import { AllSelection, EditorState, TextSelection } from '@rme-sdk/sdk/pm/state'
import type { Command, Transaction } from '@rme-sdk/sdk/pm/state'
import { addColumnAfter, CellSelection, TableMap } from '@rme-sdk/sdk/pm/tables'
import { Remirror } from '@rme-sdk/sdk/react'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'
import { LineHardBreakExtension } from '../HardBreak/hard-break-extension'
import { LineTableExtension, replaceNewLines } from './table-extension'
import { selectTable } from './table-helpers'
import {
  addTableRowWithAlignment,
  getCellSelectionType,
  getSelectedTableColumnAlignment,
  normalizeTableAlignment,
  selectAllInStages,
  selectTableInStages,
  setTableColumnAlignment,
  type TableAlignment,
} from './table-utils'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    codeBlock: { content: 'text*', group: 'block', code: true },
    table: { content: 'tableRow+', group: 'block', tableRole: 'table' },
    tableRow: {
      content: '(tableCell | tableHeaderCell)+',
      tableRole: 'row',
    },
    tableHeaderCell: {
      content: 'inline*',
      tableRole: 'header_cell',
      attrs: {
        align: { default: null },
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
    },
    tableCell: {
      content: 'inline*',
      tableRole: 'cell',
      attrs: {
        align: { default: null },
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
    },
    html_br: { group: 'inline', inline: true },
    text: { group: 'inline' },
  },
})

const paragraph = (text?: string) =>
  schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)

const singleCellTable = () =>
  schema.nodes.table.create(
    null,
    schema.nodes.tableRow.create(
      null,
      schema.nodes.tableHeaderCell.create(null, schema.text('cell')),
    ),
  )

function alignedTable(alignments: readonly (TableAlignment | null)[] = [null, null, null]) {
  const rows = Array.from({ length: 3 }, (_, rowIndex) => {
    const cellType = rowIndex === 0 ? schema.nodes.tableHeaderCell : schema.nodes.tableCell
    const cells = alignments.map((align, columnIndex) =>
      cellType.create({ align }, schema.text(`${rowIndex}-${columnIndex}`)),
    )
    return schema.nodes.tableRow.create(null, cells)
  })

  return schema.nodes.table.create(null, rows)
}

function tableCellPosition(doc: ReturnType<typeof schema.node>, row: number, column: number) {
  const tableNode = doc.firstChild
  if (!tableNode) throw new Error('Expected a table')
  return 1 + TableMap.get(tableNode).positionAt(row, column, tableNode)
}

function getTableInfo(doc: ProsemirrorNode, tableIndex = 0) {
  let currentTableIndex = 0
  let tableInfo: { node: ProsemirrorNode; pos: number; start: number } | undefined

  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true

    if (currentTableIndex === tableIndex) {
      tableInfo = { node, pos, start: pos + 1 }
    }
    currentTableIndex += 1
    return false
  })

  if (!tableInfo) throw new Error(`Expected table ${tableIndex}`)
  return tableInfo
}

function getTableContentRange(tableInfo: ReturnType<typeof getTableInfo>) {
  const cells: { node: ProsemirrorNode; pos: number }[] = []
  tableInfo.node.descendants((node, pos) => {
    const role = node.type.spec.tableRole
    if (role !== 'cell' && role !== 'header_cell') return true
    cells.push({ node, pos })
    return false
  })

  const firstCell = cells[0]
  const lastCell = cells.at(-1)
  if (!firstCell || !lastCell) throw new Error('Expected table cells')

  return {
    from: tableInfo.start + firstCell.pos + 1,
    to: tableInfo.start + lastCell.pos + lastCell.node.nodeSize - 1,
  }
}

function createAlignedTableState(
  alignments?: readonly (TableAlignment | null)[],
  row = 1,
  column = 0,
) {
  const doc = schema.nodes.doc.create(null, alignedTable(alignments))
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, tableCellPosition(doc, row, column) + 1),
  })
}

function runCommand(state: EditorState, command: Command) {
  let nextState = state
  const handled = command(state, (tr) => {
    nextState = state.apply(tr)
  })
  return { handled, state: nextState }
}

function getColumnAlignments(state: EditorState) {
  const tableNode = state.doc.firstChild
  if (!tableNode) throw new Error('Expected a table')
  const map = TableMap.get(tableNode)

  return Array.from({ length: map.height }, (_rowValue, row) =>
    Array.from({ length: map.width }, (_columnValue, column) =>
      tableNode.nodeAt(map.map[row * map.width + column])?.attrs.align ?? null,
    ),
  )
}

const createKeyboardTableState = (withFollowingParagraph = false) => {
  const doc = schema.nodes.doc.create(
    null,
    withFollowingParagraph ? [singleCellTable(), paragraph('after')] : [singleCellTable()],
  )

  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 4),
  })
}

const runShortcut = (
  state: EditorState,
  shortcut: 'Mod-Enter' | 'Shift-Enter',
): { handled: boolean; state: EditorState } => {
  let dispatchedTransaction: Transaction | undefined
  const command = new LineHardBreakExtension().createKeymap()[shortcut]
  const handled = command({
    state,
    tr: state.tr,
    dispatch: (tr) => {
      dispatchedTransaction = tr
    },
  })

  return {
    handled,
    state: dispatchedTransaction ? state.apply(dispatchedTransaction) : state,
  }
}

describe('test replaceNewLines function', () => {
  it('replaceNewLines', () => {
    const text = 'a\nb\nc'
    expect(replaceNewLines(text)).toBe('abc')
  })
})

describe('table markdown alignment', () => {
  it('accepts only supported alignment values', () => {
    expect(normalizeTableAlignment('text-align: center;')).toBe('center')
    expect(normalizeTableAlignment('justify')).toBeNull()
    expect(normalizeTableAlignment('text-align: end;')).toBeNull()
  })

  it('parses semantic headers and round-trips all GFM alignment forms', () => {
    const markdown = [
      '| Left | Center | Right | Default |',
      '| :--- | :---: | ---: | --- |',
      '| a | b | c | d |',
    ].join('\n')
    const delegate = createWysiwygDelegate()

    try {
      const doc = delegate.stringToDoc(markdown)
      const tableNode = doc.firstChild
      expect(tableNode?.type.name).toBe('table')
      expect(tableNode?.child(0).content.content.map((cell) => cell.type.name)).toEqual([
        'tableHeaderCell',
        'tableHeaderCell',
        'tableHeaderCell',
        'tableHeaderCell',
      ])
      expect(tableNode?.child(1).content.content.map((cell) => cell.type.name)).toEqual([
        'tableCell',
        'tableCell',
        'tableCell',
        'tableCell',
      ])
      tableNode?.forEach((row) => {
        expect(row.content.content.map((cell) => cell.attrs.align)).toEqual([
          'left',
          'center',
          'right',
          null,
        ])
      })

      const container = document.createElement('div')
      container.appendChild(
        DOMSerializer.fromSchema(delegate.manager.schema).serializeFragment(doc.content),
      )
      expect(
        Array.from(container.querySelectorAll('th')).map((cell) => [
          cell.getAttribute('data-table-align'),
          cell.style.textAlign,
        ]),
      ).toEqual([
        ['left', 'left'],
        ['center', 'center'],
        ['right', 'right'],
        [null, ''],
      ])

      const separatorCells = delegate
        .docToString(doc)
        .split('\n')[1]
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      expect(separatorCells[0]).toMatch(/^:-+$/)
      expect(separatorCells[1]).toMatch(/^:-+:$/)
      expect(separatorCells[2]).toMatch(/^-+:$/)
      expect(separatorCells[3]).toMatch(/^-+$/)
    } finally {
      delegate.manager.destroy()
    }
  })

  it('writes at least three delimiter hyphens for short aligned cells', () => {
    const delegate = createWysiwygDelegate()

    try {
      const markdown = ['| L | C | R | D |', '| :--- | :---: | ---: | --- |'].join('\n')
      const separator = delegate.docToString(delegate.stringToDoc(markdown)).split('\n')[1]

      expect(separator).toBe('| :--- | :---: | ---: | --- |')
    } finally {
      delegate.manager.destroy()
    }
  })
})

describe('table column alignment commands', () => {
  it('updates the complete current column from a text selection', () => {
    const result = runCommand(createAlignedTableState(), setTableColumnAlignment('center'))

    expect(result.handled).toBe(true)
    expect(getColumnAlignments(result.state)).toEqual([
      ['center', null, null],
      ['center', null, null],
      ['center', null, null],
    ])
    expect(getSelectedTableColumnAlignment(result.state)).toBe('center')
  })

  it('updates all complete columns covered by a cell selection', () => {
    const initialState = createAlignedTableState()
    const selection = new CellSelection(
      initialState.doc.resolve(tableCellPosition(initialState.doc, 1, 0)),
      initialState.doc.resolve(tableCellPosition(initialState.doc, 1, 1)),
    )
    const state = initialState.apply(initialState.tr.setSelection(selection))
    const result = runCommand(state, setTableColumnAlignment('right'))

    expect(result.handled).toBe(true)
    expect(getColumnAlignments(result.state)).toEqual([
      ['right', 'right', null],
      ['right', 'right', null],
      ['right', 'right', null],
    ])
  })

  it('reports a mixed selection and leaves calls outside tables disabled', () => {
    const initialState = createAlignedTableState(['left', 'right', null])
    const selection = new CellSelection(
      initialState.doc.resolve(tableCellPosition(initialState.doc, 1, 0)),
      initialState.doc.resolve(tableCellPosition(initialState.doc, 1, 1)),
    )
    const mixedState = initialState.apply(initialState.tr.setSelection(selection))
    expect(getSelectedTableColumnAlignment(mixedState)).toBeUndefined()

    const doc = schema.nodes.doc.create(null, paragraph('outside'))
    const outsideState = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
    })
    expect(runCommand(outsideState, setTableColumnAlignment('left')).handled).toBe(false)
    expect(getSelectedTableColumnAlignment(outsideState)).toBeUndefined()
  })

  it.each(['before', 'after'] as const)(
    'preserves every column alignment when inserting a row %s',
    (position) => {
      const state = createAlignedTableState(['left', 'center', 'right'])
      const result = runCommand(state, addTableRowWithAlignment(position))

      expect(result.handled).toBe(true)
      expect(getColumnAlignments(result.state)).toEqual([
        ['left', 'center', 'right'],
        ['left', 'center', 'right'],
        ['left', 'center', 'right'],
        ['left', 'center', 'right'],
      ])
    },
  )

  it('keeps a newly inserted column unaligned by default', () => {
    const result = runCommand(
      createAlignedTableState(['left', 'center', 'right']),
      addColumnAfter,
    )

    expect(result.handled).toBe(true)
    expect(getColumnAlignments(result.state)).toEqual([
      ['left', null, 'center', 'right'],
      ['left', null, 'center', 'right'],
      ['left', null, 'center', 'right'],
    ])
  })
})

describe('staged table select all', () => {
  it('selects the current cell, the table, and then the whole document', () => {
    const delegate = createWysiwygDelegate()

    try {
      const doc = delegate.stringToDoc(
        [
          'Before',
          '',
          '| Header A | Header B |',
          '| --- | --- |',
          '| Cell A | Cell B |',
          '',
          'After',
        ].join('\n'),
      )
      const tableInfo = getTableInfo(doc)
      const map = TableMap.get(tableInfo.node)
      const cursorPos = tableInfo.start + map.positionAt(1, 1, tableInfo.node) + 1
      let state = delegate.manager.createState({ content: doc })
      state = state.apply(state.tr.setSelection(TextSelection.create(doc, cursorPos)))
      const modACommand =
        delegate.manager.getExtension(LineTableExtension).createKeymap()[NamedShortcut.SelectAll]
      if (!modACommand) throw new Error('Expected the table select-all shortcut')

      const runModA = () => {
        const previousState = state
        const handled = modACommand({
          state: previousState,
          tr: previousState.tr,
          next: () => false,
          dispatch: (tr) => {
            state = previousState.apply(tr)
          },
        })
        return handled
      }

      expect(runModA()).toBe(true)
      expect(state.selection).toBeInstanceOf(CellSelection)
      expect(getCellSelectionType(state.selection as CellSelection)).toBe('cell')
      expect((state.selection as CellSelection).ranges).toHaveLength(1)
      expect((state.selection as CellSelection).$anchorCell.pos).toBe(cursorPos - 1)

      expect(runModA()).toBe(true)
      expect(state.selection).toBeInstanceOf(CellSelection)
      expect(getCellSelectionType(state.selection as CellSelection)).toBe('table')
      expect((state.selection as CellSelection).ranges).toHaveLength(4)
      expect((state.selection as CellSelection).$headCell.pos).toBe(
        tableInfo.start + map.positionAt(0, 0, tableInfo.node),
      )

      expect(runModA()).toBe(true)
      expect(state.selection).toBeInstanceOf(AllSelection)
      expect(state.selection.from).toBe(0)
      expect(state.selection.to).toBe(doc.content.size)
    } finally {
      delegate.manager.destroy()
    }
  })

  it('expands a partial cell selection to the complete table', () => {
    const initialState = createAlignedTableState()
    const cellPos = tableCellPosition(initialState.doc, 1, 1)
    const state = initialState.apply(
      initialState.tr.setSelection(CellSelection.create(initialState.doc, cellPos)),
    )
    const result = runCommand(state, selectTableInStages)

    expect(result.handled).toBe(true)
    expect(result.state.selection).toBeInstanceOf(CellSelection)
    expect(getCellSelectionType(result.state.selection as CellSelection)).toBe('table')
  })

  it('keeps the primary range on the top-left cell when the table handle selects all', () => {
    const doc = schema.nodes.doc.create(null, alignedTable())
    const tableInfo = getTableInfo(doc)
    const map = TableMap.get(tableInfo.node)
    const tr = EditorState.create({ doc }).tr

    expect(selectTable(tr, tableInfo.start + map.positionAt(1, 1, tableInfo.node))).toBe(true)
    expect(tr.selection).toBeInstanceOf(CellSelection)
    expect(getCellSelectionType(tr.selection as CellSelection)).toBe('table')
    expect((tr.selection as CellSelection).$headCell.pos).toBe(
      tableInfo.start + map.positionAt(0, 0, tableInfo.node),
    )
  })

  it('selects the current empty cell on the first invocation', () => {
    const table = schema.nodes.table.create(
      null,
      schema.nodes.tableRow.create(null, [
        schema.nodes.tableHeaderCell.create(null, schema.text('filled')),
        schema.nodes.tableHeaderCell.create(),
      ]),
    )
    const doc = schema.nodes.doc.create(null, table)
    const emptyCellPos = 1 + TableMap.get(table).positionAt(0, 1, table)
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, emptyCellPos + 1),
    })
    const result = runCommand(state, selectTableInStages)

    expect(result.handled).toBe(true)
    expect(result.state.selection).toBeInstanceOf(CellSelection)
    expect((result.state.selection as CellSelection).ranges).toHaveLength(1)
    expect((result.state.selection as CellSelection).$anchorCell.pos).toBe(emptyCellPos)
  })

  it('runs all three stages through a custom select-all shortcut', async () => {
    const delegate = createWysiwygDelegate({
      overrideShortcutMap: { selectAll: 'Alt-a' },
    })
    const doc = delegate.stringToDoc(
      ['| Header A | Header B |', '| --- | --- |', '|  |  |'].join('\n'),
    )
    const container = document.createElement('div')
    const root = createRoot(container)
    let mounted = false

    try {
      await act(async () => {
        root.render(
          createElement(Remirror, {
            autoRender: true,
            initialContent: doc,
            manager: delegate.manager,
          }),
        )
      })
      mounted = true

      const tableInfo = getTableInfo(doc)
      const map = TableMap.get(tableInfo.node)
      expect(tableInfo.node.lastChild?.lastChild?.textContent).toBe('')
      const cursorPos = tableInfo.start + map.positionAt(0, 0, tableInfo.node) + 1
      await act(async () => {
        delegate.manager.view.dispatch(
          delegate.manager.view.state.tr.setSelection(
            TextSelection.create(delegate.manager.view.state.doc, cursorPos),
          ),
        )
      })

      const pressCustomSelectAll = async () => {
        await act(async () => {
          delegate.manager.view.dom.dispatchEvent(
            new KeyboardEvent('keydown', {
              altKey: true,
              bubbles: true,
              cancelable: true,
              code: 'KeyA',
              key: 'a',
            }),
          )
        })
      }

      await pressCustomSelectAll()
      expect(delegate.manager.view.state.selection).toBeInstanceOf(CellSelection)
      expect(
        getCellSelectionType(delegate.manager.view.state.selection as CellSelection),
      ).toBe('cell')
      expect(delegate.manager.view.dom.querySelectorAll('.selectedCell')).toHaveLength(1)

      await pressCustomSelectAll()
      expect(delegate.manager.view.state.selection).toBeInstanceOf(CellSelection)
      expect(
        getCellSelectionType(delegate.manager.view.state.selection as CellSelection),
      ).toBe('table')
      expect(
        delegate.manager.view.dom.querySelectorAll('.selectedCell'),
      ).toHaveLength(4)
      expect(delegate.manager.view.state.selection.$from.pos).not.toBe(
        delegate.manager.view.state.selection.$to.pos,
      )

      const copiedTable = delegate.manager.view.serializeForClipboard(
        delegate.manager.view.state.selection.content(),
      )
      expect(copiedTable.dom.querySelector('table')).not.toBeNull()
      expect(copiedTable.dom.querySelectorAll('th')).toHaveLength(2)
      expect(copiedTable.dom.querySelectorAll('td')).toHaveLength(2)
      expect(copiedTable.text).toContain('Header A')
      expect(copiedTable.text).toContain('Header B')

      await pressCustomSelectAll()
      expect(delegate.manager.view.state.selection).toBeInstanceOf(AllSelection)
    } finally {
      if (mounted) {
        await act(async () => {
          root.unmount()
        })
      }
      delegate.manager.destroy()
    }
  })

  it('only selects the table containing the cursor', () => {
    const doc = schema.nodes.doc.create(null, [
      alignedTable(),
      paragraph('between'),
      alignedTable(),
    ])
    const secondTable = getTableInfo(doc, 1)
    const map = TableMap.get(secondTable.node)
    const cursorPos = secondTable.start + map.positionAt(1, 1, secondTable.node) + 1
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, cursorPos),
    })
    const firstResult = runCommand(state, selectTableInStages)

    expect(firstResult.handled).toBe(true)
    expect(firstResult.state.selection).toBeInstanceOf(CellSelection)
    expect(getCellSelectionType(firstResult.state.selection as CellSelection)).toBe('cell')
    expect((firstResult.state.selection as CellSelection).$anchorCell.node(-1)).toBe(
      secondTable.node,
    )

    const secondResult = runCommand(firstResult.state, selectTableInStages)
    expect(secondResult.handled).toBe(true)
    expect(getCellSelectionType(secondResult.state.selection as CellSelection)).toBe('table')
    expect((secondResult.state.selection as CellSelection).$anchorCell.node(-1)).toBe(
      secondTable.node,
    )
  })

  it('leaves selections outside or spanning multiple tables to the default Mod-a command', () => {
    const paragraphDoc = schema.nodes.doc.create(null, paragraph('outside'))
    const paragraphState = EditorState.create({
      doc: paragraphDoc,
      selection: TextSelection.create(paragraphDoc, 2),
    })
    expect(runCommand(paragraphState, selectTableInStages).handled).toBe(false)

    const doc = schema.nodes.doc.create(null, [alignedTable(), paragraph('between'), alignedTable()])
    const firstTableRange = getTableContentRange(getTableInfo(doc))
    const secondTableRange = getTableContentRange(getTableInfo(doc, 1))
    const spanningState = EditorState.create({
      doc,
      selection: TextSelection.create(doc, firstTableRange.from, secondTableRange.to),
    })
    expect(runCommand(spanningState, selectTableInStages).handled).toBe(false)
  })

  it('falls back to selecting the document outside a table', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('before'), paragraph('after')])
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
    })
    const result = runCommand(state, selectAllInStages)

    expect(result.handled).toBe(true)
    expect(result.state.selection).toBeInstanceOf(AllSelection)
  })
})

describe('semantic table creation', () => {
  it('uses header cells for newly created tables', () => {
    const delegate = createWysiwygDelegate()

    try {
      const tableNode = createRemirrorTable({
        schema: delegate.manager.schema,
        rowsCount: 2,
        columnsCount: 2,
        withHeaderRow: true,
      })
      expect(tableNode.child(0).content.content.map((cell) => cell.type.name)).toEqual([
        'tableHeaderCell',
        'tableHeaderCell',
      ])
      expect(tableNode.child(1).content.content.map((cell) => cell.type.name)).toEqual([
        'tableCell',
        'tableCell',
      ])
    } finally {
      delegate.manager.destroy()
    }
  })

  it('uses header cells for pipe-table shortcut input', () => {
    const delegate = createWysiwygDelegate()

    try {
      const doc = delegate.stringToDoc('| A | B |')
      const state = EditorState.create({
        schema: delegate.manager.schema,
        doc,
        selection: TextSelection.create(doc, doc.content.size - 1),
      })
      const extension = delegate.manager.getExtension(LineTableExtension)
      const enterCommand = extension.createKeymap().Enter
      if (!enterCommand) throw new Error('Expected the table Enter shortcut')
      let nextState = state
      const handled = enterCommand({
        state,
        tr: state.tr,
        next: () => false,
        dispatch: (tr) => {
          nextState = state.apply(tr)
        },
      })

      expect(handled).toBe(true)
      expect(nextState.doc.firstChild?.child(0).content.content.map((cell) => cell.type.name)).toEqual(
        ['tableHeaderCell', 'tableHeaderCell'],
      )
    } finally {
      delegate.manager.destroy()
    }
  })

  it('preserves alignment when Tab adds a row from the final cell', () => {
    const delegate = createWysiwygDelegate()

    try {
      const doc = delegate.stringToDoc(
        ['| Left | Center | Right |', '| :--- | :---: | ---: |', '| a | b | c |'].join(
          '\n',
        ),
      )
      const tableNode = doc.firstChild
      if (!tableNode) throw new Error('Expected a table')
      const map = TableMap.get(tableNode)
      const finalCellPos = 1 + map.positionAt(map.height - 1, map.width - 1, tableNode)
      const state = EditorState.create({
        schema: delegate.manager.schema,
        doc,
        selection: TextSelection.create(doc, finalCellPos + 1),
      })
      const extension = delegate.manager.getExtension(LineTableExtension)
      const tabCommand = extension.createKeymap().Tab
      if (!tabCommand) throw new Error('Expected the table Tab shortcut')
      let nextState = state
      const handled = tabCommand({
        state,
        tr: state.tr,
        next: () => false,
        dispatch: (tr) => {
          nextState = state.apply(tr)
        },
      })

      expect(handled).toBe(true)
      expect(nextState.doc.firstChild?.childCount).toBe(3)
      expect(getColumnAlignments(nextState).at(-1)).toEqual(['left', 'center', 'right'])
    } finally {
      delegate.manager.destroy()
    }
  })
})

describe('table keyboard shortcuts', () => {
  it('exits a trailing table with Mod-Enter', () => {
    const result = runShortcut(createKeyboardTableState(), 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).type.name).toBe('table')
    expect(result.state.doc.child(1).type.name).toBe('paragraph')
    expect(result.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('inserts the exit paragraph before existing content', () => {
    const result = runShortcut(createKeyboardTableState(true), 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(3)
    expect(result.state.doc.child(0).type.name).toBe('table')
    expect(result.state.doc.child(1).type.name).toBe('paragraph')
    expect(result.state.doc.child(1).textContent).toBe('')
    expect(result.state.doc.child(2).textContent).toBe('after')
  })

  it('keeps Shift-Enter as a line break inside the table header', () => {
    const result = runShortcut(createKeyboardTableState(), 'Shift-Enter')
    const cell = result.state.doc.child(0).child(0).child(0)
    let hasLineBreak = false
    cell.forEach((node) => {
      if (node.type.name === 'html_br') hasLineBreak = true
    })

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(cell.textContent).toBe('cell')
    expect(hasLineBreak).toBe(true)
    expect(result.state.selection.$from.node(1).type.name).toBe('table')
  })

  it('preserves Mod-Enter line breaks in ordinary paragraphs', () => {
    const doc = schema.nodes.doc.create(null, paragraph('text'))
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
    })
    const result = runShortcut(state, 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.firstChild?.textContent).toBe('t\next')
  })

  it('preserves Mod-Enter exit behavior in code blocks', () => {
    const codeBlock = schema.nodes.codeBlock.create(null, schema.text('code'))
    const doc = schema.nodes.doc.create(null, codeBlock)
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
    })
    const result = runShortcut(state, 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).type.name).toBe('codeBlock')
    expect(result.state.doc.child(1).type.name).toBe('paragraph')
    expect(result.state.selection.$from.parent.type.name).toBe('paragraph')
  })
})
