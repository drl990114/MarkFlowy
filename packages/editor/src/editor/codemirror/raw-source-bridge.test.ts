import { afterEach, describe, expect, it } from 'vitest'
import { Schema } from '@rme-sdk/sdk/pm/model'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { history, redo, undo } from '@codemirror/commands'
import { CodeMirror6NodeView } from '../extensions/CodeMirror/codemirror-node-view'
import type { MfCodemirrorView } from './codemirror'

const schema = new Schema({
  nodes: {
    doc: { content: 'codeMirror' },
    codeMirror: {
      content: 'text*',
      code: true,
      marks: '',
      attrs: { language: { default: '' } },
      toDOM: () => ['pre', 0],
    },
    text: { group: 'inline' },
  },
})
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
})

function mount(content: string) {
  const container = document.createElement('div')
  document.body.append(container)
  let source!: MfCodemirrorView
  const view = new EditorView(container, {
    state: EditorState.create({
      schema,
      doc: schema.node('doc', null, schema.node('codeMirror', null, schema.text(content))),
    }),
    nodeViews: {
      codeMirror: (node, ownerView, getPos) =>
        new CodeMirror6NodeView({
          node,
          view: ownerView,
          getPos: () => getPos()!,
          extensions: [history()],
          toggleName: 'paragraph',
          options: { preserveLineEndings: true, copyButton: { enabled: false } },
          onCodemirrorViewLoad: (loaded) => {
            source = loaded
          },
        }),
    },
  })
  cleanups.push(() => {
    view.destroy()
    container.remove()
  })
  return { view, source }
}

describe('source CodeMirror to PM bridge', () => {
  it('keeps exact Markdown and mixed endings outside the edited range, including undo', () => {
    const original = "<SPAN x='a'>A &amp; B</SPAN>\r\n\r\n[link][Ref]\n\n[Ref]: <a b>\r\nedit\r"
    const { view, source } = mount(original)
    expect(source.content).toBe(original)
    const from = source.cm.state.doc.toString().indexOf('edit')
    source.cm.dispatch({ changes: { from, to: from + 4, insert: 'edited' } })
    expect(view.state.doc.textContent).toBe(original.replace('edit', 'edited'))
    expect(source.content).toBe(view.state.doc.textContent)
    expect(undo(source.cm)).toBe(true)
    expect(view.state.doc.textContent).toBe(original)
    expect(redo(source.cm)).toBe(true)
    expect(view.state.doc.textContent).toBe(original.replace('edit', 'edited'))
  })

  it('maps PM selection and search offsets after CRLF and emoji', () => {
    const { view, source } = mount('😀\r\nword\rnext')
    source.setSelection(4, 8)
    expect(source.cm.state.selection.main.from).toBe(3)
    expect(source.cm.state.selection.main.to).toBe(7)
    expect(source.toCodeMirrorPosition(9)).toBe(8)
    source.cm.dispatch({ selection: { anchor: 3, head: 7 } })
    expect(view.state.selection.from).toBe(5)
    expect(view.state.selection.to).toBe(9)
  })
})
