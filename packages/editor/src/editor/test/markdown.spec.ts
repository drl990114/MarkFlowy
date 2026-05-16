import { describe, it, expect } from 'vitest'

import { markdownToTaggedDoc } from './markdown'
import { setupTestingEditor } from './setup-editor'

describe('markdownToTaggedDoc', () => {
  it('can convert a markdown string to a prosemirror document', () => {
    const t = setupTestingEditor()
    const input = `
      - A1
      - A2
    `
    const output = markdownToTaggedDoc(t.editor, input)
    expect(output.toString()).toMatchInlineSnapshot(
      `"doc(list(paragraph("A1")), list(paragraph("A2")))"`,
    )
  })

  it('can keep the tagged selection', () => {
    const t = setupTestingEditor()
    const input = `
    - A1
    - A<start>2<end>
    `
    const output = markdownToTaggedDoc(t.editor, input)
    const editor = t.add(output)
    expect(editor.state.selection.from).toEqual(9)
    expect(editor.state.selection.to).toEqual(10)
  })

  it('can prase task list', () => {
    const t = setupTestingEditor()
    const input = `
      - [ ] A1
      - [x] A2
    `
    const output = markdownToTaggedDoc(t.editor, input)
    expect(output).toEqualRemirrorDocument(
      t.doc(
        //
        t.uncheckedTaskList(t.p('A1')),
        t.checkedTaskList(t.p('A2')),
      ),
    )
  })

  it('can prase ordered list', () => {
    const t = setupTestingEditor()
    const input = `
      1. A1
      2. A2
    `
    const output = markdownToTaggedDoc(t.editor, input)
    expect(output).toEqualRemirrorDocument(
      t.doc(
        //
        t.orderedList(t.p('A1')),
        t.orderedList(t.p('A2')),
      ),
    )
  })
})
