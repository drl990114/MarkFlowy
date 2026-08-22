import { Schema } from '@rme-sdk/sdk/pm/model'
import { createListItemDragSlice } from '@rme-sdk/sdk/extensions/list'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import { NodeSelection } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NodeIndicatorState, ViewDragging } from './types'
import { clearViewDragging, startViewDragging } from './drag-preview'
import { createBlockDropTransaction } from './node-indicator-extension'
import { setDragPreview } from './set-drag-preview'

vi.mock('./set-drag-preview', () => ({
  setDragPreview: vi.fn(),
}))

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
    bulletList: {
      content: 'listItem+',
      group: 'block',
      attrs: { tight: { default: true } },
      toDOM: () => ['ul', 0],
    },
    orderedList: {
      content: 'listItem+',
      group: 'block',
      attrs: { order: { default: 1 }, tight: { default: true } },
      toDOM: (node) => ['ol', { start: node.attrs.order }, 0],
    },
    listItem: {
      content: 'block+',
      attrs: { checked: { default: null } },
      toDOM: () => ['li', 0],
    },
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

function createOrderedListView() {
  const createParagraph = (text: string) => schema.nodes.paragraph.create(null, schema.text(text))
  const item = (text: string) => schema.nodes.listItem.create(null, createParagraph(text))
  const list = schema.nodes.orderedList.create({ order: 9, tight: true }, [
    item('first item'),
    item('second item'),
  ])
  const doc = schema.nodes.doc.create(null, list)

  return new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc }),
  })
}

function paragraph(text: string) {
  return schema.nodes.paragraph.create(null, schema.text(text))
}

function listItem(text: string, nestedList?: ReturnType<typeof schema.node>) {
  return schema.nodes.listItem.create(
    { checked: null },
    nestedList ? [paragraph(text), nestedList] : [paragraph(text)],
  )
}

function bulletList(...items: ReturnType<typeof listItem>[]) {
  return schema.nodes.bulletList.create({ tight: true }, items)
}

function orderedList(order: number, ...items: ReturnType<typeof listItem>[]) {
  return schema.nodes.orderedList.create({ order, tight: true }, items)
}

function createDocumentView(...blocks: ReturnType<typeof schema.node>[]) {
  return new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc: schema.nodes.doc.create(null, blocks) }),
  })
}

function moveListItem(view: EditorView, itemPos: number, insertPos: number) {
  const slice = createListItemDragSlice(view.state.doc, itemPos)
  if (!slice) throw new Error('Expected a list item drag slice')

  const node = NodeSelection.create(view.state.doc, itemPos)
  view.dispatch(view.state.tr.setSelection(node))
  const dragging: ViewDragging = { slice, move: true, node }
  view.dragging = dragging

  const tr = createBlockDropTransaction(view, slice, true, insertPos)
  if (!tr) throw new Error('Expected a block drop transaction')
  view.dispatch(tr)
  view.dragging = null
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

  it('serializes a list item with an open native-list wrapper and its actual order', () => {
    const view = createOrderedListView()
    const list = view.state.doc.firstChild!
    const firstItem = list.firstChild!
    const secondItemPos = 1 + firstItem.nodeSize
    const secondItem = list.child(1)
    const state: NodeIndicatorState = {
      node: secondItem,
      pos: secondItemPos,
      rect: null,
    }
    const { contents, event } = createDragEvent()

    try {
      startViewDragging(view, state, event)

      expect(contents.get('text/html')).toContain('<ol start="10"')
      expect(contents.get('text/html')).toContain('<li><p>second item</p></li>')
      expect(contents.get('text/html')).toContain('data-pm-slice="1 1')
      expect(contents.get('text/plain')).toBe('second item')

      const dragging = view.dragging as ViewDragging
      expect(dragging.slice.openStart).toBe(1)
      expect(dragging.slice.openEnd).toBe(1)
      expect(dragging.slice.content.firstChild?.type.name).toBe('orderedList')
      expect(dragging.slice.content.firstChild?.attrs.order).toBe(10)
      expect(dragging.node?.from).toBe(secondItemPos)
    } finally {
      view.destroy()
    }
  })

  it('reorders items inside the same list', () => {
    const list = bulletList(listItem('a'), listItem('b'), listItem('c'))
    const view = createDocumentView(list)

    try {
      moveListItem(view, 1, list.nodeSize - 1)
      expect(
        Array.from(
          { length: view.state.doc.firstChild!.childCount },
          (_, index) => view.state.doc.firstChild!.child(index).textContent,
        ),
      ).toEqual(['b', 'c', 'a'])
    } finally {
      view.destroy()
    }
  })

  it('adopts the target list type and removes an emptied source container', () => {
    const source = orderedList(9, listItem('ordered'))
    const target = bulletList(listItem('bullet'))
    const view = createDocumentView(source, target)
    const targetEnd = source.nodeSize + target.nodeSize - 1

    try {
      moveListItem(view, 1, targetEnd)

      expect(view.state.doc.childCount).toBe(1)
      expect(view.state.doc.firstChild?.type.name).toBe('bulletList')
      expect(view.state.doc.firstChild?.textContent).toBe('bulletordered')
    } finally {
      view.destroy()
    }
  })

  it('preserves ordered position and a nested branch when moved to the root', () => {
    const nested = bulletList(listItem('nested'))
    const source = orderedList(9, listItem('first'), listItem('second', nested))
    const trailing = paragraph('after')
    const view = createDocumentView(source, trailing)
    const secondItemPos = 1 + source.firstChild!.nodeSize

    try {
      moveListItem(view, secondItemPos, view.state.doc.content.size)

      expect(view.state.doc.childCount).toBe(3)
      expect(view.state.doc.child(0).textContent).toBe('first')
      expect(view.state.doc.child(1).textContent).toBe('after')
      expect(view.state.doc.child(2).type.name).toBe('orderedList')
      expect(view.state.doc.child(2).attrs.order).toBe(10)
      expect(view.state.doc.child(2).firstChild?.child(1).type.name).toBe('bulletList')
      expect(view.state.doc.child(2).textContent).toBe('secondnested')
    } finally {
      view.destroy()
    }
  })
})
