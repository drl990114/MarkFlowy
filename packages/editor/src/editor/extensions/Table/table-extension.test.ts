import { Schema } from '@rme-sdk/pm/model'
import { EditorState, TextSelection } from '@rme-sdk/pm/state'
import type { Transaction } from '@rme-sdk/pm/state'
import { describe, expect, it } from 'vitest'
import { LineHardBreakExtension } from '../HardBreak/hard-break-extension'
import { replaceNewLines } from './table-extension'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    codeBlock: { content: 'text*', group: 'block', code: true },
    table: { content: 'tableRow+', group: 'block' },
    tableRow: { content: 'tableCell+' },
    tableCell: { content: 'inline*' },
    html_br: { group: 'inline', inline: true },
    text: { group: 'inline' },
  },
})

const paragraph = (text?: string) =>
  schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)

const table = () =>
  schema.nodes.table.create(
    null,
    schema.nodes.tableRow.create(
      null,
      schema.nodes.tableCell.create(null, schema.text('cell')),
    ),
  )

const createTableState = (withFollowingParagraph = false) => {
  const doc = schema.nodes.doc.create(
    null,
    withFollowingParagraph ? [table(), paragraph('after')] : [table()],
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

describe('table keyboard shortcuts', () => {
  it('exits a trailing table with Mod-Enter', () => {
    const result = runShortcut(createTableState(), 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).type.name).toBe('table')
    expect(result.state.doc.child(1).type.name).toBe('paragraph')
    expect(result.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('inserts the exit paragraph before existing content', () => {
    const result = runShortcut(createTableState(true), 'Mod-Enter')

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(3)
    expect(result.state.doc.child(0).type.name).toBe('table')
    expect(result.state.doc.child(1).type.name).toBe('paragraph')
    expect(result.state.doc.child(1).textContent).toBe('')
    expect(result.state.doc.child(2).textContent).toBe('after')
  })

  it('keeps Shift-Enter as a line break inside the table cell', () => {
    const result = runShortcut(createTableState(), 'Shift-Enter')
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
