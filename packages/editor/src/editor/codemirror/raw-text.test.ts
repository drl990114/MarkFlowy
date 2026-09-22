import { describe, expect, it } from 'vitest'
import { EditorState, Transaction } from '@codemirror/state'
import { history, isolateHistory, redo, undo } from '@codemirror/commands'
import { RawTextProjection, rawTextExtension, resetRawText } from './raw-text'

function editor(raw: string) {
  const extension = rawTextExtension(raw)
  let state = EditorState.create({ doc: raw, extensions: [extension.extension, history()] })
  return {
    get state() {
      return state
    },
    get raw() {
      return state.field(extension.field).raw
    },
    dispatch(transaction: Transaction) {
      state = transaction.state
    },
    change(from: number, to: number, insert: string, isolated = true) {
      state = state.update({
        changes: { from, to, insert },
        annotations: isolated ? isolateHistory.of('full') : Transaction.userEvent.of('input.type'),
      }).state
    },
    replace(replacement: string) {
      state = state.update({
        changes: { from: 0, to: state.doc.length, insert: replacement },
        effects: resetRawText.of(replacement),
        annotations: Transaction.addToHistory.of(false),
      }).state
    },
  }
}

describe('raw source and CodeMirror projection', () => {
  it.each(['a\r\nb\r\nc\r\n', 'a\rb\rc\r', 'a\r\nb\nc\rd\n\n'])(
    'preserves untouched newlines while editing %j',
    (source) => {
      const view = editor(source)
      view.change(0, 1, 'A')
      expect(view.raw).toBe(`A${source.slice(1)}`)
      expect(undo(view)).toBe(true)
      expect(view.raw).toBe(source)
      expect(redo(view)).toBe(true)
      expect(view.raw).toBe(`A${source.slice(1)}`)
    },
  )

  it('restores deleted mixed line endings through existing undo/redo history', () => {
    const source = 'one\r\ntwo\nthree\rfour\r\n😀'
    const view = editor(source)
    view.change(1, view.state.doc.length - 2, 'X\nY')
    const edited = view.raw
    for (let n = 0; n < 3; n++) {
      expect(undo(view)).toBe(true)
      expect(view.raw).toBe(source)
      expect(redo(view)).toBe(true)
      expect(view.raw).toBe(edited)
    }
  })

  it('retains raw newline history when adjacent edits are grouped', () => {
    const source = 'a\r\nb\nc\rd'
    const view = editor(source)
    view.change(1, 4, 'X', false)
    view.change(1, 3, 'Y\n', false)
    const edited = view.raw
    while (undo(view)) {
      /* Exhaust the existing grouped history. */
    }
    expect(view.raw).toBe(source)
    while (redo(view)) {
      /* Restore the same edits. */
    }
    expect(view.raw).toBe(edited)
  })

  it('maps CRLF, CR, emoji and search/selection boundaries in UTF-16 offsets', () => {
    const raw = new RawTextProjection('😀\r\n中\rnext\n')
    expect(raw.normalized).toBe('😀\n中\nnext\n')
    for (let pos = 0; pos <= raw.normalized.length; pos++)
      expect(raw.toNormalized(raw.toRaw(pos))).toBe(pos)
    expect(raw.toRaw(3)).toBe(4)
    expect(raw.toNormalized(4)).toBe(3)
  })

  it('uses the replacement source for a subsequent edit even if normalized text is unchanged', () => {
    const view = editor('a\r\nb')
    view.replace('a\rb')
    view.change(2, 3, 'B')
    expect(view.raw).toBe('a\rB')
  })

  it('preserves each surrounding newline style during a paste into multiple ranges', () => {
    const view = editor('a\r\nb\rc\nd')
    view.dispatch(
      view.state.update({
        changes: [
          { from: 2, to: 3, insert: 'B\nB' },
          { from: 6, insert: 'D\n' },
        ],
        userEvent: 'input.paste',
      }),
    )
    expect(view.raw).toBe('a\r\nB\r\nB\rc\nD\nd')
    expect(undo(view)).toBe(true)
    expect(view.raw).toBe('a\r\nb\rc\nd')
  })

  it('restores exact raw text across a sequence of range edits', () => {
    const view = editor('a\r\nb\nc\rd\r\n\r\nend')
    const snapshots = [view.raw]
    let seed = 41
    const random = (limit: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed % limit
    }
    for (let n = 0; n < 60; n++) {
      const from = random(view.state.doc.length + 1)
      const to = from + random(view.state.doc.length - from + 1)
      view.change(from, to, ['X', '\nY', 'Z\n\n'][random(3)])
      snapshots.push(view.raw)
    }
    for (let n = snapshots.length - 2; n >= 0; n--) {
      expect(undo(view)).toBe(true)
      expect(view.raw).toBe(snapshots[n])
    }
  })
})
