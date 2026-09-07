import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { history, undo } from '@codemirror/commands'
import { SourceFind } from './sourceCodeFind'

let view: EditorView | undefined
let find: SourceFind | undefined
afterEach(() => {
  find?.destroy()
  view?.destroy()
  document.body.replaceChildren()
})
function create(doc: string) {
  view = new EditorView({
    state: EditorState.create({ doc, extensions: history() }),
    parent: document.body,
  })
  find = new SourceFind(view, () => {})
  return find
}
describe('source document search', () => {
  it('selects the requested Unicode/CRLF line and occurrence using native positions', async () => {
    const api = create('first\r\n\r\n中文😀 foo foo')
    const line = view!.state.doc.line(3)
    const startColumn = line.text.lastIndexOf('foo')
    expect(
      await api.revealSourceMatch({
        line: 3,
        lineText: line.text,
        startColumn,
        endColumn: startColumn + 3,
        query: 'foo',
      }),
    ).toEqual({ status: 'exact' })
    expect(view!.state.selection.main.from).toBe(line.from + startColumn)
    expect((await api.searchAsync({ query: 'foo' }))?.matches).toHaveLength(2)
  })
  it('reuses results for navigation, treats regex punctuation literally, and rejects stale lines', async () => {
    const api = create('a.b aXb a.b')
    const state = await api.searchAsync({ query: 'a.b' })
    expect(state?.matches).toHaveLength(2)
    await api.navigateTo(1)
    expect(api.getState().matches).toBe(state?.matches)
    expect(
      await api.revealSourceMatch({
        line: 1,
        lineText: 'changed a.b',
        query: 'a.b',
        startColumn: 8,
        endColumn: 11,
      }),
    ).toEqual({ status: 'stale' })
  })
  it('cancels a superseded dense query without publishing it and refreshes after edits', async () => {
    const api = create('a '.repeat(100000))
    const abort = new AbortController()
    const pending = api.searchAsync({ query: 'a' }, { signal: abort.signal })
    abort.abort()
    expect(await pending).toBeNull()
    expect(api.getState().query).toBe('')
    await api.searchAsync({ query: 'needle' })
    view!.dispatch({ changes: { from: 0, to: 2, insert: 'needle ' } })
    expect((await api.searchAsync({ query: 'needle' }))?.matches).toHaveLength(1)
  })
  it('replaces the selected occurrence and all matches through CodeMirror transactions', async () => {
    const api = create('one one')
    await api.searchAsync({ query: 'one' })
    await api.navigateTo(1)
    expect(await api.replace('two')).toBe(true)
    expect(view!.state.doc.toString()).toBe('one two')
    expect(await api.replaceAll('three')).toBe(1)
    expect(view!.state.doc.toString()).toBe('three two')
  })

  it('refreshes a subscribed query after native edits and undo without nested CodeMirror dispatch', async () => {
    const api = create('one one')
    const release = api.subscribe(() => {})
    await api.searchAsync({ query: 'one' })
    view!.dispatch({ changes: { from: 0, to: 3, insert: 'two' } })
    await waitFor(() => expect(api.getState().matches).toHaveLength(1))
    undo(view!)
    await waitFor(() => expect(api.getState().matches).toHaveLength(2))
    release()
  })
})
