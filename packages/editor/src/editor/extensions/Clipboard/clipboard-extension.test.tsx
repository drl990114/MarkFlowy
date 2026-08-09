import { DOMParser, DOMSerializer, Schema } from '@rme-sdk/sdk/pm/model'
import {
  AllSelection,
  EditorState,
  NodeSelection,
  Plugin,
  type Selection,
  TextSelection,
} from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { describe, expect, it, vi } from 'vitest'

import { shouldStopNodeViewEvent } from '../../codemirror/stop-event'
import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'
import { TransformerExtension } from '../Transformer/transformer-extension'
import { ClipboardExtension } from './clipboard-extension'

type WysiwygDelegate = ReturnType<typeof createWysiwygDelegate>
type WysiwygDocument = ReturnType<WysiwygDelegate['stringToDoc']>

const staticNodeView = () => ({ dom: document.createElement('div') })

function createManagedEditorView(
  delegate: WysiwygDelegate,
  doc: WysiwygDocument,
  selection: Selection,
): EditorView {
  const transformer = delegate.manager.getExtension(TransformerExtension)
  let state = delegate.manager.createState({ content: doc })
  state = state.apply(
    state.tr
      .setMeta(transformer.pluginKey, {
        docToString: delegate.docToString,
        stringToDoc: delegate.stringToDoc,
      })
      .setSelection(selection),
  )

  return new EditorView(document.createElement('div'), {
    editable: () => true,
    state,
    nodeViews: {
      codeMirror: staticNodeView,
      html_block: staticNodeView,
      math_block: staticNodeView,
      mermaid_node: staticNodeView,
    },
  })
}

function createClipboardEvent(type: 'copy' | 'cut') {
  const contents = new Map<string, string>()
  const clipboardData = {
    clearData: vi.fn(() => contents.clear()),
    getData: vi.fn((format: string) => contents.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      contents.set(format, value)
    }),
  }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })

  return { clipboardData, contents, event }
}

const markdown = [
  '---',
  '',
  '---',
  '',
  'before $x + y$ after',
  '',
  '```mermaid',
  'flowchart LR',
  '  A --> B',
  '```',
  '',
  '<section>html source</section>',
  '',
  '$$',
  'e = mc^2',
  '$$',
].join('\n')

describe('ClipboardExtension', () => {
  it('routes an outer all-selection past the first nested editor to ProseMirror', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        codeMirror: { content: 'text*', group: 'block', toDOM: () => ['pre', ['code', 0]] },
        paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
        text: { group: 'inline' },
      },
    })
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.codeMirror.create(),
      schema.nodes.paragraph.create(null, schema.text('body')),
    ])
    const clipboardTextSerializer = vi.fn(() => markdown)
    const state = EditorState.create({
      doc,
      plugins: [new Plugin({ props: { clipboardTextSerializer } })],
      selection: new AllSelection(doc),
    })
    const container = document.createElement('div')
    const nestedTargets: HTMLElement[] = []
    const view = new EditorView(container, {
      state,
      nodeViews: {
        codeMirror: (node, outerView, getPos) => {
          const dom = document.createElement('div')
          const placeholder = document.createElement('span')
          placeholder.textContent = '输入 yaml front matter'
          dom.append(placeholder)
          nestedTargets.push(placeholder)

          return {
            dom,
            stopEvent: (event) =>
              shouldStopNodeViewEvent(event, outerView, getPos as () => number, node),
          }
        },
      },
    })

    try {
      const { clipboardData, contents, event } = createClipboardEvent('copy')
      nestedTargets[0]!.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(clipboardData.clearData).toHaveBeenCalledOnce()
      expect(clipboardTextSerializer).toHaveBeenCalledOnce()
      expect(contents.get('text/plain')).toBe(markdown)
    } finally {
      view.destroy()
    }
  })

  it('serializes Mermaid, HTML, and math nodes as Markdown source', () => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc(markdown)

    try {
      const serialized = delegate.docToString(doc)

      expect(serialized).toContain('```mermaid\nflowchart LR\n  A --> B\n```')
      expect(serialized).toContain('<section>html source</section>')
      expect(serialized).toContain('$$\ne = mc^2\n$$')
      expect(serialized).not.toContain('MERMAID')
      expect(serialized).not.toContain('LATEX')
      expect(serialized).not.toContain('输入 yaml front matter')
    } finally {
      delegate.manager.destroy()
    }
  })

  it.each([
    ['codeMirror', '---\n\n---'],
    ['mermaid_node', '```mermaid\nflowchart LR\n  A --> B\n```'],
    ['html_block', '<section>html source</section>'],
    ['math_block', '$$\ne = mc^2\n$$'],
  ])('keeps the Markdown wrapper when copying one %s node', (nodeType, expected) => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc(markdown)
    let nodePos: number | undefined
    doc.descendants((node, pos) => {
      if (node.type.name === nodeType) {
        nodePos = pos
        return false
      }
      return true
    })
    expect(nodePos).toBeTypeOf('number')

    const view = createManagedEditorView(delegate, doc, NodeSelection.create(doc, nodePos!))

    try {
      expect(view.serializeForClipboard(view.state.selection.content()).text).toContain(expected)
    } finally {
      view.destroy()
      delegate.manager.destroy()
    }
  })

  it.each([
    ['plain paragraph', 'plain text', 'paragraph', 'plain text'],
    ['heading', '# Heading', 'heading', '# Heading'],
    ['marked paragraph', '**bold**', 'paragraph', '**bold**'],
    ['inline math', 'before $x + y$ after', 'math_inline', '$x + y$'],
    ['inline HTML', 'before <kbd>x</kbd> after', 'html_inline_node', '<kbd>x</kbd>'],
    ['Markdown image', 'before ![alt](image.png) after', 'md_image', '![alt](image.png)'],
  ])('serializes a selected %s without losing its syntax', (_, source, nodeType, expected) => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc(source)
    let nodePos: number | undefined
    doc.descendants((node, pos) => {
      if (node.type.name === nodeType) {
        nodePos = pos
        return false
      }
      return true
    })
    expect(nodePos).toBeTypeOf('number')

    const view = createManagedEditorView(delegate, doc, NodeSelection.create(doc, nodePos!))

    try {
      expect(view.serializeForClipboard(view.state.selection.content()).text.trim()).toBe(expected)
    } finally {
      view.destroy()
      delegate.manager.destroy()
    }
  })

  it('preserves structured node types through clipboard HTML', () => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc(markdown)
    const container = document.createElement('div')
    container.append(
      DOMSerializer.fromSchema(delegate.manager.schema).serializeFragment(doc.content),
    )

    try {
      const parsed = DOMParser.fromSchema(delegate.manager.schema).parseSlice(container)
      const originalTypes = doc.content.content.map((node) => node.type.name)
      const parsedTypes = parsed.content.content.map((node) => node.type.name)
      const parsedDoc = delegate.manager.schema.topNodeType.createAndFill(undefined, parsed.content)

      expect(parsedTypes).toEqual(originalTypes)
      expect(parsedDoc).not.toBeNull()
      expect(delegate.docToString(parsedDoc!)).toBe(delegate.docToString(doc))
      expect(parsedDoc?.firstChild?.attrs['front-matter']).toBe(true)
    } finally {
      delegate.manager.destroy()
    }
  })

  it('pastes MarkFlowy clipboard HTML back as structured nodes', async () => {
    const delegate = createWysiwygDelegate()
    const sourceDoc = delegate.stringToDoc(markdown)
    const htmlContainer = document.createElement('div')
    htmlContainer.append(
      DOMSerializer.fromSchema(delegate.manager.schema).serializeFragment(sourceDoc.content),
    )
    const targetDoc = delegate.stringToDoc('replace me')
    const view = createManagedEditorView(delegate, targetDoc, new AllSelection(targetDoc))
    const clipboard = delegate.manager.getExtension(ClipboardExtension)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const handled = await clipboard.handleClipboardData({
        html: htmlContainer.innerHTML,
        text: delegate.docToString(sourceDoc),
        view,
      })

      expect(handled).toBe(true)
      expect(view.state.doc.content.content.map((node) => node.type.name)).toEqual(
        sourceDoc.content.content.map((node) => node.type.name),
      )
      expect(delegate.docToString(view.state.doc)).toBe(delegate.docToString(sourceDoc))
    } finally {
      consoleLog.mockRestore()
      view.destroy()
      delegate.manager.destroy()
    }
  })

  it('pastes plain Markdown clipboard text back as structured nodes', async () => {
    const delegate = createWysiwygDelegate()
    const sourceDoc = delegate.stringToDoc(markdown)
    const targetDoc = delegate.stringToDoc('replace me')
    const view = createManagedEditorView(delegate, targetDoc, new AllSelection(targetDoc))
    const clipboard = delegate.manager.getExtension(ClipboardExtension)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const handled = await clipboard.handleClipboardData({
        html: '',
        text: delegate.docToString(sourceDoc),
        view,
      })

      expect(handled).toBe(true)
      expect(view.state.doc.content.content.map((node) => node.type.name)).toEqual(
        sourceDoc.content.content.map((node) => node.type.name),
      )
      expect(delegate.docToString(view.state.doc)).toBe(delegate.docToString(sourceDoc))
    } finally {
      consoleLog.mockRestore()
      view.destroy()
      delegate.manager.destroy()
    }
  })

  it('preserves code and attrs-only math metadata through clipboard HTML', () => {
    const delegate = createWysiwygDelegate()
    const { schema } = delegate.manager
    const code = schema.nodes.codeMirror.create(
      { 'front-matter': false, language: 'typescript' },
      schema.text('const answer = 42'),
    )
    const math = schema.nodes.math_block.create({ tex: 'x^2 + y^2' })
    const doc = schema.topNodeType.create(null, [code, math])
    const container = document.createElement('div')
    container.append(DOMSerializer.fromSchema(schema).serializeFragment(doc.content))

    try {
      const parsed = DOMParser.fromSchema(schema).parseSlice(container)
      const parsedCode = parsed.content.firstChild
      const parsedMath = parsed.content.lastChild

      expect(parsedCode?.type.name).toBe('codeMirror')
      expect(parsedCode?.attrs.language).toBe('typescript')
      expect(parsedCode?.attrs['front-matter']).toBe(false)
      expect(parsedCode?.textContent).toBe('const answer = 42')
      expect(parsedMath?.type.name).toBe('math_block')
      expect(parsedMath?.attrs.tex).toBe('x^2 + y^2')
      expect(parsedMath?.textContent).toBe('')
    } finally {
      delegate.manager.destroy()
    }
  })

  it('keeps a local CodeMirror text selection inside the nested editor', () => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc('```\nlocal source\n```\n\nafter')
    const codeBlock = doc.firstChild
    expect(codeBlock?.type.name).toBe('codeMirror')

    const nodeStart = 0
    const localSelection = TextSelection.create(
      doc,
      nodeStart + 1,
      nodeStart + codeBlock!.nodeSize - 1,
    )
    const crossNodeSelection = TextSelection.create(doc, nodeStart + 1, codeBlock!.nodeSize + 1)
    const wholeNodeSelection = NodeSelection.create(doc, nodeStart)
    const createView = (selection: Selection) =>
      ({ state: { selection } }) as typeof delegate.manager.view

    try {
      expect(
        shouldStopNodeViewEvent(
          new Event('copy'),
          createView(localSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(true)
      expect(
        shouldStopNodeViewEvent(
          new Event('copy'),
          createView(crossNodeSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(false)
      expect(
        shouldStopNodeViewEvent(
          new Event('copy'),
          createView(wholeNodeSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(false)
      expect(
        shouldStopNodeViewEvent(
          new Event('cut'),
          createView(localSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(true)
      expect(
        shouldStopNodeViewEvent(
          new Event('cut'),
          createView(crossNodeSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(false)
      expect(
        shouldStopNodeViewEvent(
          new KeyboardEvent('keydown'),
          createView(crossNodeSelection),
          () => nodeStart,
          codeBlock!,
        ),
      ).toBe(true)
    } finally {
      delegate.manager.destroy()
    }
  })
})
