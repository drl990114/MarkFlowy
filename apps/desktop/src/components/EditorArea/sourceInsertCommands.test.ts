// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import type { MfCodemirrorView } from 'rme'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { clipboardRead } from '@/helper/clipboard'
import { requestImageInsert } from './requestImageInsert'
import { insertSourceBlock, insertSourceImage, insertSourceLink } from './sourceInsertCommands'
import { sourceCodeCodemirrorViewMap, sourceCodeViewRegistry } from './sourceCodeEditorRegistry'

vi.mock('@/helper/clipboard', () => ({ clipboardRead: vi.fn() }))
vi.mock('./requestImageInsert', () => ({ requestImageInsert: vi.fn() }))

const fileId = 'source-insert-pane-file'
const views: EditorView[] = []

beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})

function createSource(instanceId: string, groupId: string, content = 'label') {
  const cm = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: content, selection: { anchor: 0, head: content.length } }),
  })
  views.push(cm)
  const source = { cm } as unknown as MfCodemirrorView
  sourceCodeViewRegistry.register(fileId, instanceId, source, groupId)
  return source
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function beginInsert(kind: 'link' | 'image', view: EditorView, isCurrent?: () => boolean) {
  if (kind === 'link') {
    const pending = deferred<Awaited<ReturnType<typeof clipboardRead>>>()
    vi.mocked(clipboardRead).mockReturnValueOnce(pending.promise)
    return {
      result: insertSourceLink(view, fileId, isCurrent, 'left-group'),
      finish: () => pending.resolve({ html: '', text: 'https://example.com' }),
      expected: '[label](https://example.com)',
    }
  }
  const pending = deferred<Awaited<ReturnType<typeof requestImageInsert>>>()
  vi.mocked(requestImageInsert).mockReturnValueOnce(pending.promise)
  return {
    result: insertSourceImage(view, fileId, isCurrent, 'left-group'),
    finish: () => pending.resolve({ src: '/image.png' }),
    expected: '![label](/image.png)',
  }
}

afterEach(() => {
  sourceCodeCodemirrorViewMap.delete(fileId)
  for (const instanceId of ['left', 'right', 'replacement']) {
    sourceCodeViewRegistry.remove(fileId, instanceId)
  }
  views.splice(0).forEach((view) => view.destroy())
  document.body.replaceChildren()
  vi.clearAllMocks()
})

describe.each(['link', 'image'] as const)('source %s insertion', (kind) => {
  it('keeps the original pane and selection when the active compatibility alias moves', async () => {
    const left = createSource('left', 'left-group')
    const right = createSource('right', 'right-group', 'sibling')
    sourceCodeCodemirrorViewMap.set(fileId, left)
    const pending = beginInsert(kind, left.cm)

    sourceCodeCodemirrorViewMap.set(fileId, right)
    left.cm.dispatch({ selection: { anchor: 0 } })
    pending.finish()

    expect(await pending.result).toBe(true)
    expect(left.cm.state.doc.toString()).toBe(pending.expected)
    expect(right.cm.state.doc.toString()).toBe('sibling')
    expect(sourceCodeCodemirrorViewMap.get(fileId)).toBe(right)
  })

  it.each(['unmounted', 'replaced'] as const)('rejects a request after its pane runtime is %s', async (change) => {
    const left = createSource('left', 'left-group')
    sourceCodeCodemirrorViewMap.set(fileId, left)
    const pending = beginInsert(kind, left.cm)
    if (change === 'unmounted') sourceCodeViewRegistry.remove(fileId, 'left')
    else createSource('replacement', 'left-group')
    pending.finish()

    expect(await pending.result).toBe(false)
    expect(left.cm.state.doc.toString()).toBe('label')
    expect(views.every((view) => view.state.doc.toString() === 'label')).toBe(true)
  })

  it('preserves the caller cancellation guard', async () => {
    const left = createSource('left', 'left-group')
    sourceCodeCodemirrorViewMap.set(fileId, left)
    const pending = beginInsert(kind, left.cm, () => false)
    pending.finish()

    expect(await pending.result).toBe(false)
    expect(left.cm.state.doc.toString()).toBe('label')
  })
})

describe('source block insertion', () => {
  function blockView(doc: string, from: number, to = from, readOnly = false) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        selection: { anchor: from, head: to },
        extensions: [history(), EditorState.readOnly.of(readOnly)],
      }),
    })
    views.push(view)
    return view
  }

  it.each(['code', 'math'] as const)('wraps a selected paragraph in a %s block with one undo step', (kind) => {
    const view = blockView('before hello after', 7, 12)
    const fence = kind === 'code' ? '```' : '$$'
    expect(insertSourceBlock(view, kind)).toBe(true)
    expect(view.state.doc.toString()).toBe(`before \n\n${fence}\nhello\n${fence}\n\n after`)
    const { from, to } = view.state.selection.main
    expect(view.state.sliceDoc(from, to)).toBe('hello')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('before hello after')
  })

  it('places the empty-block caret inside the fences without adding duplicate blank lines', () => {
    const view = blockView('before\n\nafter', 8)
    insertSourceBlock(view, 'code')
    expect(view.state.doc.toString()).toBe('before\n\n```\n\n```\n\nafter')
    expect(view.state.selection.main.anchor).toBe(12)
  })

  it('uses a longer fence around selected code examples', () => {
    const content = '```js\nconst n = 1\n```'
    const view = blockView(content, 0, content.length)
    insertSourceBlock(view, 'code')
    expect(view.state.doc.toString()).toBe(`\`\`\`\`\n${content}\n\`\`\`\`\n`)
  })

  it('does not edit a readonly source', () => {
    const view = blockView('locked', 0, 6, true)
    expect(insertSourceBlock(view, 'math')).toBe(false)
    expect(view.state.doc.toString()).toBe('locked')
  })

  it('keeps the inserted block separate from the immediately preceding typing history', () => {
    const view = blockView('before', 6)
    view.dispatch({ changes: { from: 6, insert: ' typing' }, selection: { anchor: 13 }, userEvent: 'input.type' })
    insertSourceBlock(view, 'math')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('before typing')
  })
})
