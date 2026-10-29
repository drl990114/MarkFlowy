import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { MfCodemirrorView } from 'rme'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipboardRead } from '@/helper/clipboard'
import { requestImageInsert } from './requestImageInsert'
import { insertSourceImage, insertSourceLink } from './sourceInsertCommands'
import { sourceCodeCodemirrorViewMap, sourceCodeViewRegistry } from './sourceCodeEditorRegistry'

vi.mock('@/helper/clipboard', () => ({ clipboardRead: vi.fn() }))
vi.mock('./requestImageInsert', () => ({ requestImageInsert: vi.fn() }))

const fileId = 'source-insert-pane-file'
const views: EditorView[] = []

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
