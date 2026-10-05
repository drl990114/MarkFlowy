// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undoDepth } from '@codemirror/commands'
import type { MfCodemirrorView } from 'rme'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorInstances'
import { captureActiveEditorFocus } from './focusActiveEditor'

let view: EditorView | undefined
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
afterEach(() => {
  view?.destroy()
  view = undefined
  sourceCodeCodemirrorViewMap.clear()
  document.body.replaceChildren()
})

it('restores CodeMirror selection including its direction without replacing newer content', () => {
  document.body.innerHTML = `
    <div data-editor-id="test-file" data-editor-active="true">
      <div data-mf-editor-mode="sourceCode"></div>
    </div>
  `
  view = new EditorView({
    parent: document.querySelector('[data-mf-editor-mode]')!,
    state: EditorState.create({
      doc: 'original text',
      selection: { anchor: 8, head: 2 },
      extensions: [history()],
    }),
  })
  sourceCodeCodemirrorViewMap.set('test-file', { cm: view } as MfCodemirrorView)
  const snapshot = captureActiveEditorFocus()!
  view.dispatch({ selection: { anchor: 0 } })
  expect(snapshot.restore()).toBe(true)
  expect(view.hasFocus).toBe(true)
  expect(view.state.selection.main).toMatchObject({ anchor: 8, head: 2 })
  expect(undoDepth(view.state)).toBe(0)

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: 'new' },
    selection: { anchor: 1 },
  })
  expect(snapshot.restore()).toBe(true)
  expect(view.state.doc.toString()).toBe('new')
  expect(view.state.selection.main.head).toBe(1)
})
