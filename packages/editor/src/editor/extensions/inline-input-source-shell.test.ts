import type { Node as ProseMirrorNode } from '@rme-sdk/sdk/pm/model'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import type { EditorView } from '@rme-sdk/sdk/pm/view'
import { describe, expect, it, vi } from 'vitest'

import { createWysiwygDelegate } from '../components/WysiwygEditor/delegate'
import { HTMLInlineView } from './HtmlNode/html-inline-view'
import { MathInlineView } from './Math/math-inline-nodeview'

function findNode(doc: ProseMirrorNode, nodeName: string) {
  let found: { node: ProseMirrorNode; pos: number } | undefined
  doc.descendants((node, pos) => {
    if (!found && node.type.name === nodeName) found = { node, pos }
  })
  if (!found) throw new Error(`Missing ${nodeName} node`)
  return found
}

function createOuterView(doc: ProseMirrorNode): EditorView {
  let state = EditorState.create({ doc })

  return {
    dispatch: vi.fn((transaction) => {
      state = state.apply(transaction)
    }),
    editable: true,
    focus: vi.fn(),
    hasFocus: vi.fn(() => true),
    get state() {
      return state
    },
  } as unknown as EditorView
}

describe.each([
  {
    create: (node: ProseMirrorNode, outerView: EditorView, getPos: () => number) =>
      new HTMLInlineView(node, outerView, getPos),
    markdown: '<kbd>x</kbd>',
    nodeName: 'html_inline_node',
    source: '<kbd>x</kbd>',
  },
  {
    create: (node: ProseMirrorNode, outerView: EditorView, getPos: () => number) =>
      new MathInlineView(node, outerView, getPos),
    markdown: '$x^2$',
    nodeName: 'math_inline',
    source: 'x^2',
  },
])('$nodeName inline source shell', ({ create, markdown, nodeName, source }) => {
  it('keeps the painted shell separate from the focused contenteditable', () => {
    const delegate = createWysiwygDelegate({ disableAllBuildInShortcuts: true })
    const doc = delegate.stringToDoc(markdown)
    const { node, pos } = findNode(doc, nodeName)
    const nodeView = create(node, createOuterView(doc), () => pos)
    const shell = nodeView.dom.querySelector<HTMLElement>('.inline-input-source-shell')

    expect(shell).not.toBeNull()
    expect(shell?.style.display).toBe('none')

    nodeView.selectNode()

    const sourceEditor = shell?.querySelector<HTMLElement>('.inline-input-src')
    expect(shell?.style.display).toBe('inline')
    expect(sourceEditor?.getAttribute('contenteditable')).toBe('true')
    expect(sourceEditor?.textContent).toBe(source)
    expect(sourceEditor?.querySelector('p')).toBeNull()

    nodeView.deselectNode()
    expect(shell?.style.display).toBe('none')

    nodeView.destroy()
  })
})
