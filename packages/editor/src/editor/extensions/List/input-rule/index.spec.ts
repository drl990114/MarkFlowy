import { describe, expect, it } from 'vitest'

import { setupTestingEditor } from '../../../test/setup-editor'

import type { ListAttributes } from './types'

describe('input rules', () => {
  const t = setupTestingEditor()

  it('can turn a paragraph into a bullet list', () => {
    const editor = t.add(t.doc(t.p('<cursor>')))
    editor.insertText('- ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.bulletList(t.p('<cursor>'))),
    )
  })

  it('can turn a paragraph into a task list', () => {
    const editor = t.add(t.doc(t.p('<cursor>')))
    editor.insertText('- [x] ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.checkedTaskList(t.p('<cursor>'))),
    )
  })

  it('can turn a paragraph into an ordered list', () => {
    const editor = t.add(t.doc(t.p('<cursor>')))
    editor.insertText('1. ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.orderedList(t.p('<cursor>'))),
    )
  })

  it('can turn a paragraph into an ordered list with a custom order counter', () => {
    const editor = t.add(t.doc(t.p('<cursor>')))
    editor.insertText('99. ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.ordered99List(t.p('<cursor>'))),
    )
  })

  it('can change list type', () => {
    const editor = t.add(t.doc(t.uncheckedTaskList(t.p('<cursor>'))))
    editor.insertText('1. ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.orderedList(t.p('<cursor>'))),
    )
  })

  it('can reset the attribute "collapsed" when changing list type', () => {
    const editor = t.add(t.doc(t.collapsedToggleList(t.p('<cursor>'))))
    expect((editor.state.doc.child(0).attrs as ListAttributes).collapsed).toBe(
      true,
    )
    editor.insertText('1. ')
    expect(editor.state).toEqualRemirrorState(
      t.doc(t.orderedList(t.p('<cursor>'))),
    )
    expect((editor.state.doc.child(0).attrs as ListAttributes).collapsed).toBe(
      false,
    )
  })

  it('can turn a paragraph into a sub-list', () => {
    const editor = t.add(
      t.doc(
        t.bulletList(
          //
          t.p('A1'),
          t.p('<cursor>A1'),
          t.p('A1'),
        ),
      ),
    )
    editor.insertText('- ')

    expect(editor.state).toEqualRemirrorState(
      t.doc(
        t.bulletList(
          //
          t.p('A1'),
          t.bulletList(t.p('<cursor>A1')),
          t.p('A1'),
        ),
      ),
    )
  })

  it("can ignore the input rule if it's already that list type", () => {
    const editor = t.add(
      t.doc(
        t.bulletList(
          //
          t.p('<cursor>A1'),
          t.p('A1'),
        ),
      ),
    )
    editor.insertText('- ')

    expect(editor.state).toEqualRemirrorState(
      t.doc(
        t.bulletList(
          //
          t.p('- A1'),
          t.p('A1'),
        ),
      ),
    )
  })
})
