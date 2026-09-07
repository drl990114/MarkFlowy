import { waitFor } from '@testing-library/react'
import { EditorState as ProseMirrorState } from 'prosemirror-state'
import { EditorView as ProseMirrorView } from 'prosemirror-view'
import { Schema } from 'prosemirror-model'
import { MfCodemirrorView } from 'rme'
import { expect, it } from 'vitest'
import { SourceFind } from './sourceCodeFind'

it('drives the installed RME Source Code view without changing content while navigating', async () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'code' },
      code: {
        content: 'text*',
        code: true,
        attrs: { language: { default: 'text' } },
        toDOM: () => ['pre', ['code', 0]],
      },
      text: { group: 'inline' },
    },
  })
  const node = schema.node('code', null, [schema.text('中文😀 foo foo')])
  const sourceRef: { current?: MfCodemirrorView } = {}
  const host = new ProseMirrorView(document.body, {
    state: ProseMirrorState.create({ doc: schema.node('doc', null, [node]) }),
    dispatchTransaction(transaction) {
      host.updateState(host.state.apply(transaction))
      sourceRef.current?.update(host.state.doc.firstChild!)
    },
  })
  const source = new MfCodemirrorView({
    node,
    view: host,
    getPos: () => 0,
    languageName: 'text',
    options: { copyButton: { enabled: false } },
  })
  sourceRef.current = source
  document.body.append(source.cm.dom)
  const find = new SourceFind(source.cm, (query, active) => source!.setSearchState(query, active))
  const input = document.createElement('input')
  document.body.append(input)
  input.focus()
  try {
    const lineText = source.cm.state.doc.line(1).text
    const startColumn = lineText.lastIndexOf('foo')
    await find.revealSourceMatch({
      line: 1,
      lineText,
      query: 'foo',
      startColumn,
      endColumn: startColumn + 3,
    })
    await waitFor(() =>
      expect(source!.cm.dom.querySelector('.cm-search-active')?.textContent).toBe('foo'),
    )
    expect(source.cm.state.selection.main.from).toBe(startColumn)
    expect(host.state.doc.textContent).toBe(lineText)
    expect(document.activeElement).toBe(input)
    await find.searchAsync({ query: 'foo' })
    await find.navigateTo(1)
    await find.replace('bar')
    expect(host.state.doc.textContent).toBe('中文😀 foo bar')
    find.destroy()
    expect(source.cm.dom.querySelector('.cm-search-active')).toBeNull()
  } finally {
    find.destroy()
    source.destroy()
    host.destroy()
    document.body.replaceChildren()
  }
})
