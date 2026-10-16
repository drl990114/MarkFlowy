// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { act, cleanup, render } from '@testing-library/react'
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react'
import type { MfCodemirrorView } from 'rme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import { TocView } from './TocView'

const harness = vi.hoisted(() => ({
  commands: new Map<string, () => void>(),
  editorState: { activeId: 'file' as string | undefined },
  viewState: { editorViewTypeMap: new Map<string, string>() },
  fileState: { fileTypeConfigMap: new Map([['file', { type: 'markdown' }]]) },
  sourceViews: new Map<string, unknown>(),
  sourceListeners: new Set<() => void>(),
  extractMatches: vi.fn(),
}))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ id, handler }: { id: string; handler: () => void }) => {
      harness.commands.set(id, handler)
      return { dispose: () => harness.commands.delete(id) }
    },
    execute: (id: string) => harness.commands.get(id)?.(),
  },
}))
vi.mock('@/stores', () => ({
  useEditorStore: Object.assign(
    (selector: (state: typeof harness.editorState) => unknown) => selector(harness.editorState),
    { getState: () => harness.editorState },
  ),
}))
vi.mock('@/stores/useEditorViewTypeStore', () => ({
  default: Object.assign(
    (selector: (state: typeof harness.viewState) => unknown) => selector(harness.viewState),
    { getState: () => harness.viewState },
  ),
}))
vi.mock('@/stores/useFileTypeConfigStore', () => ({
  default: Object.assign(
    (selector: (state: typeof harness.fileState) => unknown) => selector(harness.fileState),
    { getState: () => harness.fileState },
  ),
}))
vi.mock('../EditorArea/sourceCodeEditorRegistry', () => ({
  sourceCodeCodemirrorViewMap: harness.sourceViews,
  subscribeSourceCodeEditors: (listener: () => void) => {
    harness.sourceListeners.add(listener)
    return () => harness.sourceListeners.delete(listener)
  },
}))
vi.mock('../EditorArea/rmeRuntime', () => ({
  getLoadedRmeRuntime: () => ({
    extractMatches: harness.extractMatches,
    analyzeHeadingNumbering: () => ({ complete: false, entries: [] }),
  }),
}))
vi.mock('../EditorArea/capricornEditorRegistry', () => ({
  getCapricornEditor: () => undefined,
  subscribeCapricornEditors: () => () => {},
}))
vi.mock('../SideBar/SideBarHeader', () => ({ default: () => null }))
vi.mock('./HeadingNumberingButton', () => ({ CapricornHeadingNumberingButton: () => null }))
vi.mock('./styles', () => ({ TocViewContainer: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@markflowy/interface', () => ({
  TableOfContents: ({ ref, activeId }: { ref: Ref<unknown>; activeId?: string }) => {
    const [headings, setHeadings] = useState<{ id: string }[]>([])
    useImperativeHandle(ref, () => ({
      refreshByHeadings: ({ newHeadings }: { newHeadings: { id: string }[] }) => setHeadings(newHeadings),
    }))
    return <output data-testid='active-heading' data-heading-count={headings.length}>{activeId}</output>
  },
}))

const documentText = '# Alpha\nalpha paragraph\n\n## Beta\nbeta paragraph\n\n## Gamma\ngamma paragraph'
const beta = documentText.indexOf('## Beta')
const gamma = documentText.indexOf('## Gamma')
const natives: EditorView[] = []

function createSource(doc = documentText) {
  const pane = document.createElement('div')
  pane.dataset.editorId = 'file'
  pane.dataset.editorActive = 'true'
  const viewport = document.createElement('div')
  viewport.dataset.overlayscrollbarsViewport = ''
  pane.append(viewport)
  document.body.append(pane)
  // All sections share a viewport: the caret must be able to change the active
  // heading without any browser layout or scrolling being required.
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, -100, 600, 1000))
  const native = new EditorView({ state: EditorState.create({ doc }), parent: viewport })
  natives.push(native)
  const source = { cm: native, isDestroyed: false } as unknown as MfCodemirrorView
  return { native, source, pane, viewport }
}

function publishSource(source: MfCodemirrorView) {
  harness.sourceViews.set('file', source)
  harness.sourceListeners.forEach((listener) => listener())
}

function flushFrame() {
  act(() => vi.advanceTimersByTime(32))
}

function mountSource() {
  const editor = createSource()
  publishSource(editor.source)
  const rendered = render(<TocView />)
  act(() => vi.advanceTimersByTime(350))
  flushFrame()
  expect(rendered.getByTestId('active-heading').getAttribute('data-heading-count')).toBe('3')
  act(() => editor.native.focus())
  flushFrame()
  return { ...editor, ...rendered }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  harness.viewState.editorViewTypeMap.set('file', EditorViewType.SOURCECODE)
  harness.extractMatches.mockImplementation((view: EditorView) => {
    const text = view.state.doc.toString()
    return Array.from(text.matchAll(/^(#{1,6}) .+$/gm), (match) => ({
      type: `ATXHeading${match[1].length}`,
      from: match.index,
      value: match[0],
    }))
  })
})

afterEach(() => {
  cleanup()
  natives.splice(0).forEach((native) => native.destroy())
  harness.commands.clear()
  harness.sourceViews.clear()
  harness.sourceListeners.clear()
  harness.editorState.activeId = 'file'
  harness.viewState.editorViewTypeMap.clear()
  harness.extractMatches.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('Source Code outline selection tracking', () => {
  it('follows the focused selection head across sections in one viewport, including reverse selections', () => {
    const { native, getByTestId } = mountSource()
    const active = () => getByTestId('active-heading').textContent
    expect(active()).toBe('heading-0')
    harness.extractMatches.mockClear()

    act(() => native.dispatch({ selection: { anchor: beta + 10 } }))
    flushFrame()
    expect(active()).toBe(`heading-${beta}`)
    act(() => native.dispatch({ selection: { anchor: gamma + 10, head: beta + 11 } }))
    flushFrame()
    expect(active()).toBe(`heading-${beta}`)
    act(() => native.dispatch({ selection: { anchor: beta + 11, head: gamma + 10 } }))
    flushFrame()
    expect(active()).toBe(`heading-${gamma}`)

    const input = document.createElement('input')
    document.body.append(input)
    act(() => {
      input.focus()
      native.dispatch({ selection: { anchor: 3 } })
    })
    flushFrame()
    expect(active()).toBe(`heading-${gamma}`)
    expect(harness.extractMatches).not.toHaveBeenCalled()
  })

  it('keeps the caret heading after automatic scrolling, then follows wheel and touch reading gestures', () => {
    const { native, viewport, getByTestId } = mountSource()
    const active = () => getByTestId('active-heading').textContent

    for (const gesture of ['wheel', 'touchmove']) {
      act(() => native.dispatch({ selection: { anchor: gamma + 10 + (gesture === 'wheel' ? 0 : 1) } }))
      flushFrame()
      act(() => {
        native.scrollDOM.dispatchEvent(new Event('scroll'))
        viewport.dispatchEvent(new Event('scroll'))
      })
      flushFrame()
      expect(active()).toBe(`heading-${gamma}`)

      act(() => {
        viewport.dispatchEvent(new Event(gesture))
        viewport.dispatchEvent(new Event('scroll'))
      })
      flushFrame()
      expect(active()).toBe('heading-0')
    }
  })

  it('maps accumulated edits before cached headings without extracting the outline again', () => {
    const { native, getByTestId } = mountSource()
    const active = () => getByTestId('active-heading').textContent
    harness.extractMatches.mockClear()
    const inserted = 'extra introduction text '.repeat(5)
    act(() => native.dispatch({ changes: { from: 8, insert: inserted }, selection: { anchor: beta + inserted.length - 1 } }))
    flushFrame()
    // This cursor is beyond the old Gamma offset but still before the moved Beta.
    expect(active()).toBe('heading-0')

    act(() => native.dispatch({ changes: { from: 8, to: 28 }, selection: { anchor: beta + inserted.length - 20 + 10 } }))
    flushFrame()
    expect(active()).toBe(`heading-${beta}`)
    act(() => native.dispatch({ selection: { anchor: gamma + inserted.length - 20 + 10 } }))
    flushFrame()
    expect(active()).toBe(`heading-${gamma}`)
    expect(harness.extractMatches).not.toHaveBeenCalled()
  })

  it('detaches a replaced instance and removes its CodeMirror subscription on unmount', () => {
    const first = mountSource()
    act(() => first.native.dispatch({ selection: { anchor: gamma + 10 } }))
    flushFrame()
    expect(first.getByTestId('active-heading').textContent).toBe(`heading-${gamma}`)

    first.pane.dataset.editorActive = 'false'
    const replacement = createSource()
    act(() => publishSource(replacement.source))
    act(() => vi.advanceTimersByTime(350))
    flushFrame()
    act(() => {
      replacement.native.focus()
      replacement.native.dispatch({ selection: { anchor: beta + 10 } })
    })
    flushFrame()
    expect(first.getByTestId('active-heading').textContent).toBe(`heading-${beta}`)
    harness.extractMatches.mockClear()

    act(() => {
      first.native.focus()
      first.native.dispatch({ selection: { anchor: 2 } })
      first.viewport.dispatchEvent(new Event('wheel'))
      first.viewport.dispatchEvent(new Event('scroll'))
    })
    flushFrame()
    expect(first.getByTestId('active-heading').textContent).toBe(`heading-${beta}`)

    expect(first.native.state.facet(EditorView.updateListener)).toHaveLength(0)
    expect(replacement.native.state.facet(EditorView.updateListener)).toHaveLength(1)
    first.unmount()
    expect(replacement.native.state.facet(EditorView.updateListener)).toHaveLength(0)
    expect(harness.sourceListeners.size).toBe(0)
    act(() => {
      replacement.native.focus()
      replacement.native.dispatch({ selection: { anchor: gamma + 10 } })
    })
    flushFrame()
    expect(harness.extractMatches).not.toHaveBeenCalled()
  })
})
