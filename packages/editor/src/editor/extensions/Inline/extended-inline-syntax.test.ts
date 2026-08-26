import { EditorState, Plugin, TextSelection } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { describe, expect, it } from 'vitest'

import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'
import { LineInlineDecorationExtension } from './inline-deco-extension'

function collectMarkNames(markdown: string): Set<string> {
  const delegate = createWysiwygDelegate({ disableAllBuildInShortcuts: true })
  const doc = delegate.stringToDoc(markdown)
  const names = new Set<string>()

  doc.descendants((node) => {
    for (const mark of node.marks) names.add(mark.type.name)
  })

  return names
}

describe('extended inline Markdown syntax', () => {
  it('round-trips highlight, subscript, superscript, and emoji shortcodes', () => {
    const markdown = '==highlight== H~2~O 2^10^ = 1024 :rocket: :tada: :white_check_mark:'
    const delegate = createWysiwygDelegate({ disableAllBuildInShortcuts: true })
    const doc = delegate.stringToDoc(markdown)

    expect(delegate.docToString(doc)).toBe(markdown)
    for (const markName of ['mdHighlight', 'mdSubscript', 'mdSuperscript', 'mdEmoji']) {
      expect(delegate.manager.schema.marks[markName]).toBeDefined()
    }
  })

  it('keeps emoji shortcodes literal in code and automatic links', () => {
    expect(collectMarkNames('`:rocket:`')).not.toContain('mdEmoji')
    expect(collectMarkNames('<https://example.com/:rocket:>')).not.toContain('mdEmoji')
  })

  it('reveals the shortcode decoration when the cursor moves into an emoji mark', () => {
    const delegate = createWysiwygDelegate({ disableAllBuildInShortcuts: true })
    const doc = delegate.stringToDoc('before :rocket: after')
    let emojiStart = -1

    doc.descendants((node, pos) => {
      if (node.marks.some((mark) => mark.type.name === 'mdEmoji')) emojiStart = pos
    })

    const plugin = new Plugin(new LineInlineDecorationExtension().createPlugin())
    const state = EditorState.create({ doc, plugins: [plugin] })
    const view = new EditorView(document.createElement('div'), { state })
    let emojiElement = view.dom.querySelector<HTMLElement>('.md-emoji')

    expect(emojiStart).toBeGreaterThanOrEqual(0)
    expect(emojiElement).not.toBeNull()
    expect(emojiElement?.textContent).toBe(':rocket:')
    expect(emojiElement?.querySelector('.show')).toBeNull()

    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, emojiStart + 2)),
    )
    emojiElement = view.dom.querySelector<HTMLElement>('.md-emoji')

    expect(emojiElement?.matches('.show')).toBe(false)
    expect(emojiElement?.querySelector('.show')).not.toBeNull()

    view.destroy()
  })
})
