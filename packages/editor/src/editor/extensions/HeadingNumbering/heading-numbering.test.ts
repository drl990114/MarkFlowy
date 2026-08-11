import { EditorState } from '@rme-sdk/sdk/pm/state'
import { describe, expect, it } from 'vitest'

import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'
import {
  analyzeHeadingNumbering,
  createHeadingPrefixes,
  hasHeadingStructureChanged,
  removeHeadingNumbering,
  rewriteHeadingNumbering,
} from './heading-numbering'

function transformMarkdown(markdown: string, transform: (tr: EditorState['tr']) => void): string {
  const delegate = createWysiwygDelegate()

  try {
    const state = EditorState.create({ doc: delegate.stringToDoc(markdown) })
    const tr = state.tr
    transform(tr)
    return delegate.docToString(tr.doc)
  } finally {
    delegate.manager.destroy()
  }
}

describe('heading numbering', () => {
  it('creates a full path and preserves skipped heading levels', () => {
    const prefixes = createHeadingPrefixes([
      { level: 1, text: 'One' },
      { level: 3, text: 'Deep' },
      { level: 2, text: 'Two' },
    ])

    expect(prefixes).toEqual(['1', '1.0.1', '1.1'])
  })

  it('recognizes a complete decimal document', () => {
    const analysis = analyzeHeadingNumbering([
      { level: 1, text: '1、First' },
      { level: 2, text: '1.1、Child' },
      { level: 3, text: '1.1.1、Detail' },
      { level: 2, text: '1.2、Next' },
    ])

    expect(analysis.complete).toBe(true)
    expect(analysis.entries.map((entry) => entry.title)).toEqual([
      'First',
      'Child',
      'Detail',
      'Next',
    ])
  })

  it('does not treat arbitrary numeric title text as a structural prefix', () => {
    const analysis = analyzeHeadingNumbering([
      { level: 1, text: '2026 roadmap' },
      { level: 1, text: '2 Follow-up' },
    ])

    expect(analysis.complete).toBe(false)
    expect(analysis.entries[0].prefix).toBeNull()
    expect(analysis.entries[0].title).toBe('2026 roadmap')
  })

  it('writes prefixes into heading text and replaces recognized prefixes', () => {
    const result = transformMarkdown('# 1 Old\n\n## 1.1 Child\n\n## Another', (tr) =>
      rewriteHeadingNumbering(tr),
    )

    expect(result).toBe('# 1、Old\n\n## 1.1、Child\n\n## 1.2、Another')
  })

  it('repairs a loose prefix when the document still has recognized numbering', () => {
    const result = transformMarkdown('# 1 First\n\n# 9 Second', (tr) =>
      rewriteHeadingNumbering(tr, {
        replaceLoosePrefixes: true,
      }),
    )

    expect(result).toBe('# 1、First\n\n# 2、Second')
  })

  it('removes only recognized structural prefixes', () => {
    const result = transformMarkdown('# 1、First\n\n## 1.1、Child\n\n# 2026 roadmap', (tr) =>
      removeHeadingNumbering(tr),
    )

    expect(result).toBe('# First\n\n## Child\n\n# 2026 roadmap')
  })

  it('distinguishes heading reordering from an ordinary title edit', () => {
    const previous = analyzeHeadingNumbering([
      { level: 1, text: '1 First' },
      { level: 1, text: '2 Second' },
    ])
    const reordered = analyzeHeadingNumbering([
      { level: 1, text: '2 Second' },
      { level: 1, text: '1 First' },
    ])
    const edited = analyzeHeadingNumbering([
      { level: 1, text: 'Renamed' },
      { level: 1, text: '2 Second' },
    ])

    expect(hasHeadingStructureChanged(previous, reordered)).toBe(true)
    expect(hasHeadingStructureChanged(previous, edited)).toBe(false)
  })

  it('automatically numbers a heading inserted into a fully numbered document', () => {
    const delegate = createWysiwygDelegate()

    try {
      let state = delegate.manager.createState({
        content: delegate.stringToDoc('# 1 First\n\n# 2 Second'),
      })
      const heading = state.schema.nodes.heading.create({ level: 1 }, state.schema.text('Third'))
      state = state.apply(state.tr.insert(state.doc.content.size, heading))

      expect(delegate.docToString(state.doc)).toBe('# 1、First\n\n# 2、Second\n\n# 3、Third')
    } finally {
      delegate.manager.destroy()
    }
  })

  it('pauses automatic numbering when the prefix is edited manually', () => {
    const delegate = createWysiwygDelegate()

    try {
      let state = delegate.manager.createState({
        content: delegate.stringToDoc('# 1 First\n\n# 2 Second'),
      })
      const firstHeading = state.doc.firstChild!
      state = state.apply(state.tr.insertText('Renamed', 1, firstHeading.nodeSize - 1))

      expect(delegate.docToString(state.doc)).toBe('# Renamed\n\n# 2 Second')
    } finally {
      delegate.manager.destroy()
    }
  })

  it('does not start numbering an unnumbered document during ordinary edits', () => {
    const delegate = createWysiwygDelegate()

    try {
      let state = delegate.manager.createState({ content: delegate.stringToDoc('# Introduction') })
      const heading = state.doc.firstChild!
      state = state.apply(state.tr.insertText('!', heading.nodeSize - 1))

      expect(delegate.docToString(state.doc)).toBe('# Introduction!')
    } finally {
      delegate.manager.destroy()
    }
  })
})
