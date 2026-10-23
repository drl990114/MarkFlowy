// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { IHeadingData } from '@markflowy/interface'
import type { MfCodemirrorView } from 'rme'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOutlineSession, OutlineSession } from './outlineSession'

const views: EditorView[] = []
afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const headings = (depths: number[]): IHeadingData[] => depths.map((depth, index) => ({
  id: `heading-${index}`, depth, value: 'Repeated title', htmlNode: null,
}))

function sourceSession(doc: string) {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const view = new EditorView({ state: EditorState.create({ doc }) })
  views.push(view)
  const source = { cm: view, isDestroyed: false } as unknown as MfCodemirrorView
  const session = getOutlineSession(source, 'a', 'sourceCode', source)
  const refresh = () => {
    const next = [...view.state.doc.toString().matchAll(/^(#+) (.+)$/gm)].map((match) => ({
      id: `heading-${match.index}`, depth: match[1].length, value: match[2], htmlNode: null,
    }))
    session.refresh(next, new Map(next.map((heading) => [heading.id, Number(heading.id.slice(8))])))
  }
  refresh()
  return { view, session, refresh }
}

describe('outline fold session', () => {
  it('preserves panel remount state and isolates document, mode and editor replacements', () => {
    const editor = {}
    const session = getOutlineSession(editor, 'a', 'wysiwyg')
    session.refresh(headings([1, 2, 3, 1, 2]))
    session.setCollapsedIds(new Set(['heading-0', 'heading-1', 'heading-3']))
    expect(getOutlineSession(editor, 'a', 'wysiwyg')).toBe(session)
    expect(getOutlineSession({}, 'a', 'wysiwyg').getSnapshot().collapsedIds.size).toBe(0)
    expect(getOutlineSession(editor, 'a', 'preview').getSnapshot().collapsedIds.size).toBe(0)
    expect(getOutlineSession(editor, 'b', 'preview').getSnapshot().collapsedIds.size).toBe(0)
  })

  it('prunes deleted and newly leaf headings without conflating repeated titles', () => {
    const session = new OutlineSession('a', 'wysiwyg')
    session.refresh(headings([1, 2, 3, 1, 2]))
    session.setCollapsedIds(new Set(['heading-0', 'heading-1', 'heading-3']))
    session.refresh(headings([1, 2, 2]))
    expect([...session.getSnapshot().collapsedIds]).toEqual(['heading-0'])
    session.refresh([])
    expect(session.getSnapshot()).toMatchObject({ headingCount: 0, collapsedIds: new Set() })
  })

  it('maps folds through edits while the panel has no subscribers and discards replaced headings', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const view = new EditorView({ state: EditorState.create({ doc: '# Same\n## Child\n# Same\n## Child' }) })
    views.push(view)
    const source = { cm: view, isDestroyed: false } as unknown as MfCodemirrorView
    const session = getOutlineSession(source, 'a', 'sourceCode', source)
    const refresh = () => {
      const next = [...view.state.doc.toString().matchAll(/^(#+) (.+)$/gm)].map((match) => ({
        id: `heading-${match.index}`, depth: match[1].length, value: match[2], htmlNode: null,
      }))
      session.refresh(next, new Map(next.map((heading) => [heading.id, Number(heading.id.slice(8))])))
    }
    refresh()
    const second = view.state.doc.toString().lastIndexOf('# Same')
    session.setCollapsedIds(new Set([`heading-${second}`]))
    // No React subscriber is mounted during these edits.
    view.dispatch({ changes: { from: 0, insert: 'Introduction\n' } })
    view.dispatch({ changes: { from: 0, insert: 'More\n' } })
    refresh()
    const moved = second + 'Introduction\nMore\n'.length
    expect([...session.getSnapshot().collapsedIds]).toEqual([`heading-${moved}`])
    // Replacing a heading at the same position must not transfer its fold.
    view.dispatch({ changes: { from: moved, to: moved + '# Same'.length, insert: '# New' } })
    refresh()
    expect(session.getSnapshot().collapsedIds.size).toBe(0)
    session.dispose()
    vi.unstubAllGlobals()
  })

  it.each([
    { title: '# Parent', changes: { from: 0, insert: '#' } },
    { title: '## Parent', changes: { from: 0, to: 1, insert: '' } },
    { title: '## Parent', changes: { from: 1, to: 2, insert: '' } },
    { title: '# Parent', changes: { from: 2, to: 8, insert: 'Renamed' } },
  ])('keeps a folded parent through marker or title edits: $title $changes', ({ title, changes }) => {
    const { view, session, refresh } = sourceSession(`${title}\n### Child`)
    session.setCollapsedIds(new Set(['heading-0']))
    view.dispatch({ changes })
    refresh()
    expect([...session.getSnapshot().collapsedIds]).toEqual(['heading-0'])
    session.dispose()
  })

  it('keeps the original heading folded when a new same-title heading is inserted before it', () => {
    const { view, session, refresh } = sourceSession('# Parent\n### Child')
    session.setCollapsedIds(new Set(['heading-0']))
    const inserted = '# Parent\n## New child\n'
    view.dispatch({ changes: { from: 0, insert: inserted } })
    refresh()
    expect([...session.getSnapshot().collapsedIds]).toEqual([`heading-${inserted.length}`])
    session.dispose()
  })

  it('does not transfer a folded heading into another title when the heading line is merged', () => {
    const { view, session, refresh } = sourceSession('# Earlier\n# Parent\n### Child')
    session.setCollapsedIds(new Set([`heading-${'# Earlier\n'.length}`]))
    view.dispatch({ changes: { from: '# Earlier'.length, to: '# Earlier\n'.length } })
    refresh()
    expect(session.getSnapshot().collapsedIds.size).toBe(0)
    session.dispose()
  })
})
