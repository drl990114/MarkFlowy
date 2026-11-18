import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import { extractMatches } from './outline'

describe('source Markdown outline ranges', () => {
  it('reads only intersecting headings, preserving full titles and Markdown nesting semantics', () => {
    const doc = '# First\n\n> ## Quoted\n\n```md\n### In code\n```\n\n# Last'
    const view = { state: EditorState.create({ doc, extensions: [markdown()] }) }
    const all = extractMatches(view)
    expect(all.map((item) => item.value)).toEqual(['# First', '## Quoted', '# Last'])
    const read = vi.spyOn(view.state.doc, 'sliceString')
    const from = doc.indexOf('## Quoted') + 1
    expect(extractMatches(view, { from, to: from + 1 })).toEqual([all[1]])
    expect(read).toHaveBeenCalledOnce()
    const inCode = doc.indexOf('### In code')
    expect(extractMatches(view, { from: inCode, to: inCode + 1 })).toEqual([])
  })
})
