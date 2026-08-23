import { Remirror } from '@rme-sdk/sdk/react'
import { TextSelection } from '@rme-sdk/sdk/pm/state'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'

function pressEnter(element: HTMLElement): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
}

function pressBackspace(element: HTMLElement): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' }))
}

describe('standard list Enter behavior in the MarkFlowy editor', () => {
  it('does not re-enter a list from the root paragraph after an empty task item exits', async () => {
    const delegate = createWysiwygDelegate()
    const { schema } = delegate.manager
    const paragraph = schema.nodes.paragraph
    const listItem = schema.nodes.listItem
    const bulletList = schema.nodes.bulletList
    const firstItem = listItem.create(
      { checked: true },
      paragraph.create(null, schema.text('done')),
    )
    const emptyItem = listItem.create({ checked: false }, paragraph.create())
    const initialContent = schema.nodes.doc.create(null, [
      bulletList.create({ tight: true }, [firstItem, emptyItem]),
    ])
    const emptyParagraphPos = 1 + firstItem.nodeSize + 2
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <Remirror autoRender initialContent={initialContent} manager={delegate.manager} />,
        )
      })

      const { view } = delegate.manager
      await act(async () => {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos)),
        )
        pressEnter(view.dom)
        pressEnter(view.dom)
      })

      expect(view.state.doc.childCount).toBe(3)
      expect(view.state.doc.child(0).type.name).toBe('bulletList')
      expect(view.state.doc.child(0).childCount).toBe(1)
      expect(view.state.doc.child(1).type.name).toBe('paragraph')
      expect(view.state.doc.child(2).type.name).toBe('paragraph')
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
    }
  })

  it('splits a root paragraph after a task list without creating another list', async () => {
    const delegate = createWysiwygDelegate()
    const initialContent = delegate.stringToDoc('- [ ] task\n\nAfter')
    let paragraphEnd = 0
    initialContent.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'After') {
        paragraphEnd = pos + 1 + node.content.size
      }
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <Remirror autoRender initialContent={initialContent} manager={delegate.manager} />,
        )
      })

      const { view } = delegate.manager
      await act(async () => {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphEnd)),
        )
        pressEnter(view.dom)
      })

      expect(
        Array.from(
          { length: view.state.doc.childCount },
          (_, index) => view.state.doc.child(index).type.name,
        ),
      ).toEqual(['bulletList', 'paragraph', 'paragraph'])
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
    }
  })

  it('merges a non-empty root paragraph into the previous list item on Backspace', async () => {
    const delegate = createWysiwygDelegate()
    const initialContent = delegate.stringToDoc('- item\n\nparagraph')
    let paragraphStart = 0
    initialContent.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'paragraph') {
        paragraphStart = pos + 1
      }
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <Remirror autoRender initialContent={initialContent} manager={delegate.manager} />,
        )
      })

      const { view } = delegate.manager
      await act(async () => {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphStart)),
        )
        pressBackspace(view.dom)
      })

      expect(view.state.doc.childCount).toBe(1)
      expect(view.state.doc.firstChild?.type.name).toBe('bulletList')
      expect(view.state.doc.firstChild?.firstChild?.textContent).toBe('itemparagraph')
      expect(view.state.selection.$from.parent.type.name).toBe('paragraph')
      expect(view.state.selection.$from.parentOffset).toBe(4)
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
    }
  })

  it('deletes an empty root paragraph after a list and moves the cursor to the list item', async () => {
    const delegate = createWysiwygDelegate()
    const { schema } = delegate.manager
    const paragraph = schema.nodes.paragraph
    const listItem = schema.nodes.listItem
    const bulletList = schema.nodes.bulletList
    const list = bulletList.create(
      { tight: true },
      listItem.create({ checked: null }, paragraph.create(null, schema.text('item'))),
    )
    const initialContent = schema.nodes.doc.create(null, [list, paragraph.create()])
    const emptyParagraphPos = list.nodeSize + 1
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <Remirror autoRender initialContent={initialContent} manager={delegate.manager} />,
        )
      })

      const { view } = delegate.manager
      await act(async () => {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos)),
        )
        pressBackspace(view.dom)
      })

      expect(view.state.doc.childCount).toBe(1)
      expect(view.state.doc.firstChild?.type.name).toBe('bulletList')
      expect(view.state.selection.$from.parent.textContent).toBe('item')
      expect(view.state.selection.$from.parentOffset).toBe(4)
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
    }
  })

  it('does not split a list item when Enter confirms a Chinese IME composition', async () => {
    const delegate = createWysiwygDelegate()
    const { schema } = delegate.manager
    const paragraph = schema.nodes.paragraph
    const listItem = schema.nodes.listItem
    const bulletList = schema.nodes.bulletList
    const initialContent = schema.nodes.doc.create(null, [
      bulletList.create(
        { tight: true },
        listItem.create(
          { checked: null },
          paragraph.create(null, schema.text('请问')),
        ),
      ),
    ])
    let paragraphEnd = 0
    initialContent.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === '请问') {
        paragraphEnd = pos + 1 + node.content.size
      }
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <Remirror autoRender initialContent={initialContent} manager={delegate.manager} />,
        )
      })

      const { view } = delegate.manager
      await act(async () => {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphEnd)),
        )
        view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
        view.dom.dispatchEvent(
          new CompositionEvent('compositionend', { bubbles: true, data: '请问' }),
        )
        pressEnter(view.dom)
      })

      expect(view.state.doc.firstChild?.childCount).toBe(1)
      expect(view.state.doc.textContent).toBe('请问')
    } finally {
      await act(async () => root.unmount())
      delegate.manager.destroy()
    }
  })
})
