import { Schema } from '@rme-sdk/sdk/pm/model'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findBlockByCoords,
  findBlockInteractionRect,
  findFirstLineRect,
} from './node-target'
import { NodeIndicatorExtension } from './node-indicator-extension'

vi.mock('./node-target', () => ({
  findBlockByCoords: vi.fn(),
  findBlockInteractionRect: vi.fn(),
  findFirstLineRect: vi.fn(),
}))

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
    bulletList: { content: 'listItem+', group: 'block', toDOM: () => ['ul', 0] },
    listItem: { content: 'block+', toDOM: () => ['li', 0] },
    text: { group: 'inline' },
  },
})

function createListView() {
  const paragraph = schema.nodes.paragraph.create(null, schema.text('list item'))
  const listItem = schema.nodes.listItem.create(null, paragraph)
  const list = schema.nodes.bulletList.create(null, listItem)
  const doc = schema.nodes.doc.create(null, list)

  return new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc }),
  })
}

describe('NodeIndicatorExtension pointer tracking', () => {
  let scheduledFrame: FrameRequestCallback | undefined

  const flushScheduledFrame = () => {
    const frame = scheduledFrame
    scheduledFrame = undefined
    frame?.(0)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    scheduledFrame = undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      scheduledFrame = undefined
    })

    vi.mocked(findFirstLineRect).mockReturnValue({ top: 10, right: 100, bottom: 30, left: 20 })
    vi.mocked(findBlockInteractionRect).mockReturnValue({
      top: 8,
      right: 100,
      bottom: 40,
      left: 20,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks the latest list item hover without dispatching editor transactions', () => {
    const view = createListView()
    const extension = new NodeIndicatorExtension()
    const plugin = extension.createPlugin()
    const pluginView = plugin.view?.(view)
    const pointermove = plugin.props?.handleDOMEvents?.pointermove as
      | ((view: EditorView, event: PointerEvent) => boolean | void)
      | undefined
    const dispatch = vi.spyOn(view, 'dispatch')
    const listener = vi.fn()
    const unsubscribe = extension.subscribeToNodeIndicatorState(listener)
    const paragraph = view.state.doc.nodeAt(2)!
    vi.mocked(findBlockByCoords).mockReturnValue({ node: paragraph, pos: 2 })

    try {
      pointermove?.(view, { x: 10, y: 12 } as PointerEvent)
      pointermove?.(view, { x: 20, y: 24 } as PointerEvent)

      flushScheduledFrame()

      expect(findBlockByCoords).toHaveBeenCalledOnce()
      expect(findBlockByCoords).toHaveBeenCalledWith(view, 20, 24)
      expect(extension.getNodeIndicatorState()).toMatchObject({
        node: view.state.doc.nodeAt(1),
        pos: 1,
      })
      expect(listener).toHaveBeenCalledOnce()
      expect(dispatch).not.toHaveBeenCalled()

      pointermove?.(view, { x: 22, y: 25 } as PointerEvent)
      flushScheduledFrame()

      expect(listener).toHaveBeenCalledOnce()
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
      pluginView?.destroy?.()
      view.destroy()
    }
  })

  it('cancels a queued hover update when the pointer leaves the editor', () => {
    const view = createListView()
    const extension = new NodeIndicatorExtension()
    const plugin = extension.createPlugin()
    const pluginView = plugin.view?.(view)
    const pointermove = plugin.props?.handleDOMEvents?.pointermove as
      | ((view: EditorView, event: PointerEvent) => boolean | void)
      | undefined
    const pointerout = plugin.props?.handleDOMEvents?.pointerout as
      | ((view: EditorView, event: PointerEvent) => boolean | void)
      | undefined
    const dispatch = vi.spyOn(view, 'dispatch')

    try {
      pointermove?.(view, { x: 10, y: 12 } as PointerEvent)
      pointerout?.(view, { relatedTarget: null } as PointerEvent)

      expect(scheduledFrame).toBeUndefined()
      expect(findBlockByCoords).not.toHaveBeenCalled()
      expect(extension.getNodeIndicatorState().node).toBeNull()
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      pluginView?.destroy?.()
      view.destroy()
    }
  })

  it('clears the hover snapshot after the document changes', () => {
    const view = createListView()
    const extension = new NodeIndicatorExtension()
    const plugin = extension.createPlugin()
    const pluginView = plugin.view?.(view)
    const pointermove = plugin.props?.handleDOMEvents?.pointermove as
      | ((view: EditorView, event: PointerEvent) => boolean | void)
      | undefined
    const paragraph = view.state.doc.nodeAt(2)!
    vi.mocked(findBlockByCoords).mockReturnValue({ node: paragraph, pos: 2 })

    try {
      pointermove?.(view, { x: 10, y: 12 } as PointerEvent)
      flushScheduledFrame()
      expect(extension.getNodeIndicatorState().node).not.toBeNull()

      const previousState = view.state
      view.updateState(previousState.apply(previousState.tr.insertText('updated ', 3)))
      pluginView?.update?.(view, previousState)

      expect(extension.getNodeIndicatorState().node).toBeNull()
    } finally {
      pluginView?.destroy?.()
      view.destroy()
    }
  })
})
