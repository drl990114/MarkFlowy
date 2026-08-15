import { Schema } from '@rme-sdk/sdk/pm/model'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NodeIndicatorState, ViewDragging } from './types'
import { clearViewDragging, startViewDragging } from './drag-preview'
import { setDragPreview } from './set-drag-preview'

vi.mock('./set-drag-preview', () => ({
  setDragPreview: vi.fn(),
}))

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
})

function createView() {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text('first block')),
    schema.nodes.paragraph.create(null, schema.text('second block')),
  ])

  return new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc }),
  })
}

function createDragEvent() {
  const contents = new Map<string, string>()
  const dataTransfer = {
    clearData: vi.fn(() => contents.clear()),
    setData: vi.fn((format: string, value: string) => contents.set(format, value)),
    setDragImage: vi.fn(),
    effectAllowed: 'uninitialized',
  }
  const event = {
    clientX: 0,
    clientY: 0,
    dataTransfer,
  } as unknown as React.DragEvent<HTMLDivElement>

  return { contents, dataTransfer, event }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('block handle dragging', () => {
  it('uses ProseMirror clipboard serialization and starts a movable node drag', () => {
    const view = createView()
    const node = view.state.doc.firstChild!
    const state: NodeIndicatorState = { node, pos: 0, rect: null }
    const { contents, dataTransfer, event } = createDragEvent()

    try {
      startViewDragging(view, state, event)

      expect(dataTransfer.clearData).toHaveBeenCalledOnce()
      expect(contents.get('text/html')).toContain('data-pm-slice="0 0 []"')
      expect(contents.get('text/html')).toContain('first block')
      expect(contents.get('text/plain')).toBe('first block')
      expect(dataTransfer.effectAllowed).toBe('copyMove')
      expect(setDragPreview).toHaveBeenCalledOnce()

      const dragging = view.dragging as ViewDragging
      expect(dragging.move).toBe(true)
      expect(dragging.node?.from).toBe(0)
      expect(dragging.slice.content.firstChild?.textContent).toBe('first block')
    } finally {
      view.destroy()
    }
  })

  it('clears a canceled external-handle drag without clearing a newer drag', () => {
    vi.useFakeTimers()
    const view = createView()
    const node = view.state.doc.firstChild!
    const state: NodeIndicatorState = { node, pos: 0, rect: null }
    const { event } = createDragEvent()

    try {
      startViewDragging(view, state, event)
      const firstDragging = view.dragging
      clearViewDragging(view)

      expect(view.dragging).toBe(firstDragging)
      vi.advanceTimersByTime(50)
      expect(view.dragging).toBeNull()

      startViewDragging(view, state, event)
      clearViewDragging(view)
      const newerDragging = { ...view.dragging! }
      view.dragging = newerDragging
      vi.advanceTimersByTime(50)
      expect(view.dragging).toBe(newerDragging)
    } finally {
      view.destroy()
    }
  })
})
