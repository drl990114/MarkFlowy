import type { ProsemirrorNode } from '@rme-sdk/pm'
import type { EditorView } from '@rme-sdk/pm/view'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LivePreviewRenderer } from './live-preview-types'

vi.mock('../../codemirror', () => ({
  MfCodemirrorView: class {
    cm = { focus: vi.fn() }
    content: string

    constructor(options: { node: ProsemirrorNode }) {
      this.content = options.node.textContent
    }

    destroy() {}

    forwardSelection() {}

    setSelection() {}

    update(node: ProsemirrorNode) {
      this.content = node.textContent
      return true
    }
  },
}))

import { LivePreviewNodeView } from './LivePreviewNodeView'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const nodeType = {}

function createNode(textContent: string): ProsemirrorNode {
  return { textContent, type: nodeType } as unknown as ProsemirrorNode
}

describe('LivePreviewNodeView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('does not let a stale async render mutate the latest preview', async () => {
    const oldRender = deferred()
    const newRender = deferred()
    const renderer: LivePreviewRenderer = {
      className: 'test-renderer',
      displayName: 'Test',
      getCodeMirrorExtensions: () => [],
      languageName: 'test',
      render: async (content, container) => {
        await (content === 'old' ? oldRender.promise : newRender.promise)
        container.textContent = content
      },
    }
    const nodeView = new LivePreviewNodeView({
      getPos: () => 0,
      node: createNode('old'),
      renderer,
      view: {} as EditorView,
    })
    const preview = nodeView.dom.querySelector<HTMLElement>('.mf-live-preview-render')

    await vi.advanceTimersByTimeAsync(0)
    nodeView.update(createNode('new'))
    await vi.advanceTimersByTimeAsync(120)
    newRender.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(preview?.textContent).toBe('new')

    oldRender.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(preview?.textContent).toBe('new')

    nodeView.destroy()
  })
})
