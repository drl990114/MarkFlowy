import { runInNewContext } from 'node:vm'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useImperativeHandle } from 'react'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCapricornEditor } from '../EditorArea/capricornEditorRegistry'
import type {
  CapricornHeading,
  CapricornRuntimeAdapter,
} from '../EditorArea/capricornRuntimeAdapter'
import { TocView } from './TocView'
import textEditorSource from '../EditorArea/TextEditor.tsx?raw'

const harness = vi.hoisted(() => ({
  commands: new Map<string, () => void>(),
  refresh: vi.fn(),
  numberingMount: vi.fn(),
  editorState: { activeId: 'file' as string | undefined },
  viewState: { editorViewTypeMap: new Map([['file', 'wysiwyg']]) },
  sourceViews: new Map<string, unknown>(),
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
vi.mock('@/stores/useEditorViewTypeStore', () => {
  const state = harness.viewState
  return {
    default: Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
      getState: () => state,
    }),
  }
})
vi.mock('../EditorArea/TextEditor', () => ({ sourceCodeCodemirrorViewMap: harness.sourceViews }))
vi.mock('../SideBar/SideBarHeader', () => ({
  default: ({ actions }: { actions?: React.ReactNode }) => <>{actions}</>,
}))
vi.mock('./HeadingNumberingButton', () => ({
  CapricornHeadingNumberingButton: () => {
    harness.numberingMount()
    return null
  },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@markflowy/interface', () => ({
  TableOfContents: ({ ref, activeId }: { ref: React.Ref<unknown>; activeId?: string }) => {
    useImperativeHandle(ref, () => ({ refreshByHeadings: harness.refresh }))
    return <span data-testid='active-heading'>{activeId}</span>
  },
}))

// Exercise the actual snapshot callback without mounting unrelated Tauri file
// services. Extract its AST rather than copying the publication logic here.
function createSnapshotPublisher(bindings: Record<string, unknown>) {
  const file = ts.createSourceFile(
    'TextEditor.tsx',
    textEditorSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let expression: ts.Expression | undefined
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.left.getText(file) === 'publishEditorSnapshotRef.current' &&
      ts.isArrowFunction(node.right)
    ) {
      expression = node.right
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  expect(expression).toBeDefined()
  const compiled = ts.transpileModule(`(${expression!.getText(file)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return runInNewContext(compiled, bindings) as (snapshot: unknown) => boolean
}

afterEach(() => {
  cleanup()
  setCapricornEditor('file', undefined)
  harness.commands.clear()
  harness.refresh.mockClear()
  harness.numberingMount.mockClear()
  harness.editorState.activeId = 'file'
  harness.viewState.editorViewTypeMap.set('file', 'wysiwyg')
  harness.sourceViews.clear()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('Capricorn outline refresh ownership', () => {
  it('updates the active heading on scroll and virtual mounts without rescanning the outline', async () => {
    const pane = document.createElement('div')
    pane.dataset.editorActive = 'true'
    pane.dataset.editorId = 'file'
    const content = document.createElement('div')
    content.setAttribute('data-cap-content', '')
    pane.append(content)
    document.body.append(pane)
    let activeHeading = 'first'
    const headings = ['first', 'second'].map((id) => ({
      id,
      level: 1,
      number: null,
      text: id,
      title: id,
    }))
    const getAll = vi.fn(() => headings)
    const getActiveHeadingId = vi.fn(() => activeHeading)
    setCapricornEditor('file', {
      headings: { getAll, subscribe: () => () => {} },
      getActiveHeadingId,
    } as unknown as CapricornRuntimeAdapter)
    const { getByTestId } = render(<TocView />)
    await waitFor(() => expect(getByTestId('active-heading').textContent).toBe('first'))
    activeHeading = 'second'
    act(() => pane.dispatchEvent(new Event('scroll')))
    await waitFor(() => expect(getByTestId('active-heading').textContent).toBe('second'))
    activeHeading = 'first'
    await act(async () => {
      content.append(document.createElement('p'))
      await Promise.resolve()
    })
    await waitFor(() => expect(getByTestId('active-heading').textContent).toBe('first'))
    expect(getAll).toHaveBeenCalledOnce()
    expect(getActiveHeadingId).toHaveBeenLastCalledWith(headings, pane)
  })
  it('ignores plain text snapshots and keeps subscribed heading changes and legacy snapshots', () => {
    vi.useFakeTimers()
    let notifyHeadings: ((headings: CapricornHeading[]) => void) | undefined
    let headings: CapricornHeading[] = [
      { id: 'heading', level: 1, number: null, text: 'Initial', title: 'Initial' },
    ]
    const getAll = vi.fn(() => headings)
    const unsubscribe = vi.fn()
    setCapricornEditor('file', {
      headings: {
        getAll,
        subscribe: (listener: typeof notifyHeadings) => {
          notifyHeadings = listener
          return unsubscribe
        },
      },
    } as unknown as CapricornRuntimeAdapter)
    const { unmount } = render(<TocView />)
    act(() => vi.runAllTimers())
    getAll.mockClear()
    harness.refresh.mockClear()

    const refreshLegacyToc = vi.fn(() => harness.commands.get('app:toc_refresh')?.())
    const recordContent = vi.fn()
    const publish = createSnapshotPublisher({
      id: 'file',
      instanceIdRef: { current: 'instance' },
      editorSnapshotRegistry: {
        publish: (_id: string, _instanceId: string, publishSnapshot: () => boolean) =>
          publishSnapshot(),
      },
      measureEditorSnapshot: (_id: string, _size: number, _mode: string, serialize: () => string) =>
        serialize(),
      latestContentRef: { current: '' },
      isUnmountingRef: { current: false },
      setContent: recordContent,
      updateCachedFileContent: vi.fn(),
      emitContentSync: vi.fn(),
      activeRef: { current: true },
      debounceRefreshToc: refreshLegacyToc,
      getFileObject: () => ({}),
      autosave: false,
      captureException: (error: unknown) => {
        throw error
      },
    })
    act(() => {
      expect(
        publish({ kind: 'capricorn', mode: 'coalesced', getMarkdown: () => 'Edited paragraph' }),
      ).toBe(true)
      vi.advanceTimersByTime(1500)
    })
    expect(recordContent).toHaveBeenCalledWith('Edited paragraph')
    expect(refreshLegacyToc).not.toHaveBeenCalled()
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).not.toHaveBeenCalled()

    headings = [{ ...headings[0], text: 'Renamed', title: 'Renamed' }]
    act(() => {
      notifyHeadings!(headings)
      vi.runAllTimers()
    })
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).toHaveBeenCalledWith({
      newHeadings: [expect.objectContaining({ id: 'heading', value: 'Renamed' })],
    })

    expect(
      publish({
        kind: 'rme',
        delegate: { view: 'SourceCode', docToString: () => 'Source edit' },
        doc: { content: { size: 11 } },
      }),
    ).toBe(true)
    expect(refreshLegacyToc).toHaveBeenCalledOnce()
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('Capricorn outline snapshot work', () => {
  it('waits for runtime registration instead of polling after an early refresh', () => {
    vi.useFakeTimers()
    const getAll = vi.fn(() => [
      { id: 'ready', level: 1, number: null, text: 'Ready', title: 'Ready' },
    ])
    render(<TocView />)

    act(() => harness.commands.get('app:toc_refresh')?.())
    expect(vi.getTimerCount()).toBe(0)
    expect(getAll).not.toHaveBeenCalled()

    act(() => {
      setCapricornEditor('file', {
        headings: { getAll, subscribe: () => () => {} },
      } as unknown as CapricornRuntimeAdapter)
    })
    expect(getAll).not.toHaveBeenCalled()
    act(() => vi.runAllTimers())
    expect(getAll).toHaveBeenCalledOnce()
    expect(harness.refresh).toHaveBeenCalledExactlyOnceWith({
      newHeadings: [expect.objectContaining({ id: 'ready', value: 'Ready' })],
    })
  })

  it('keeps the first scan off the opening frames and consumes an intervening latest snapshot', () => {
    vi.useFakeTimers()
    let notifyHeadings: ((headings: CapricornHeading[]) => void) | undefined
    const getAll = vi.fn(() => [])
    const heading = { id: 'heading', level: 1, number: null, text: 'Latest', title: 'Latest' }
    setCapricornEditor('file', {
      headings: {
        getAll,
        subscribe: (listener: typeof notifyHeadings) => {
          notifyHeadings = listener
          return () => {}
        },
      },
    } as unknown as CapricornRuntimeAdapter)
    render(<TocView />)
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.numberingMount).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersToNextFrame()
      notifyHeadings!([{ ...heading, title: 'Intermediate' }])
      notifyHeadings!([heading])
      vi.advanceTimersByTime(0)
    })
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).not.toHaveBeenCalled()
    expect(harness.numberingMount).not.toHaveBeenCalled()
    act(() => vi.runAllTimers())
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).toHaveBeenCalledExactlyOnceWith({
      newHeadings: [expect.objectContaining({ id: 'heading', value: 'Latest' })],
    })
    expect(harness.numberingMount).toHaveBeenCalled()
  })

  it.each(['active-file', 'view-mode'])('does not scan after a pending %s change', (change) => {
    vi.useFakeTimers()
    const getAll = vi.fn(() => [])
    setCapricornEditor('file', {
      headings: { getAll, subscribe: () => () => {} },
    } as unknown as CapricornRuntimeAdapter)
    render(<TocView />)
    if (change === 'active-file') harness.editorState.activeId = 'another-file'
    else harness.viewState.editorViewTypeMap.set('file', 'sourcecode')
    act(() => vi.runAllTimers())
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).not.toHaveBeenCalled()
  })

  it('reuses heading notifications instead of rereading the complete document', () => {
    vi.useFakeTimers()
    let notifyHeadings: ((headings: CapricornHeading[]) => void) | undefined
    const headings = Array.from({ length: 19824 }, (_, i) => ({
      id: String(i),
      level: 2,
      number: null,
      text: `Heading ${i}`,
      title: `Heading ${i}`,
    }))
    const getAll = vi.fn(() => headings)
    setCapricornEditor('file', {
      headings: {
        getAll,
        subscribe: (listener: typeof notifyHeadings) => {
          notifyHeadings = listener
          return () => {}
        },
      },
    } as unknown as CapricornRuntimeAdapter)
    render(<TocView />)
    act(() => vi.runAllTimers())
    expect(getAll).toHaveBeenCalledOnce()
    expect(harness.refresh).toHaveBeenCalledOnce()
    getAll.mockClear()
    harness.refresh.mockClear()
    act(() => {
      for (let i = 0; i < 100; i++) {
        const snapshot = headings.slice()
        snapshot[0] = { ...headings[0], title: `Revision ${i}` }
        notifyHeadings!(snapshot)
      }
      vi.runAllTimers()
    })

    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).toHaveBeenCalledOnce()
    expect(harness.refresh.mock.calls[0][0].newHeadings).toHaveLength(19824)
    expect(harness.refresh.mock.calls[0][0].newHeadings[0].value).toBe('Revision 99')
    harness.refresh.mockClear()
    const notifySeparateHeading = notifyHeadings!
    for (let i = 0; i < 10; i++) {
      act(() => {
        notifySeparateHeading([{ ...headings[0], title: `Separate ${i}` }])
        vi.runAllTimers()
      })
    }
    expect(getAll).not.toHaveBeenCalled()
    expect(harness.refresh).toHaveBeenCalledTimes(10)
    expect(harness.refresh.mock.lastCall![0].newHeadings[0].value).toBe('Separate 9')
  })
})

it('cancels a queued Source Code scan after the active mode changes', () => {
  vi.useFakeTimers()
  harness.viewState.editorViewTypeMap.set('file', 'sourcecode')
  const readStaleView = vi.fn(() => ({}))
  // The stale callback must return before touching this deliberately minimal
  // view, which represents a CodeMirror instance being replaced by a switch.
  harness.sourceViews.set('file', {
    get cm() {
      return readStaleView()
    },
  })
  render(<TocView />)

  act(() => harness.commands.get('app:toc_refresh')?.())
  harness.viewState.editorViewTypeMap.set('file', 'wysiwyg')
  act(() => vi.runAllTimers())
  expect(readStaleView).not.toHaveBeenCalled()
  expect(harness.refresh).toHaveBeenCalledExactlyOnceWith({ newHeadings: [] })
})

it('cancels old-editor snapshots and initializes the replacement editor once', () => {
  vi.useFakeTimers()
  let notifyOld: ((headings: CapricornHeading[]) => void) | undefined
  const oldHeadings: CapricornHeading[] = [
    { id: 'old', level: 1, number: null, text: 'Old', title: 'Old' },
  ]
  const nextHeadings: CapricornHeading[] = [
    { id: 'next', level: 1, number: '1', text: '1 Next', title: 'Next' },
  ]
  const unsubscribe = vi.fn()
  const oldGetAll = vi.fn(() => oldHeadings)
  const nextGetAll = vi.fn(() => nextHeadings)
  setCapricornEditor('file', {
    headings: {
      getAll: oldGetAll,
      subscribe: (listener: typeof notifyOld) => {
        notifyOld = listener
        return unsubscribe
      },
    },
  } as unknown as CapricornRuntimeAdapter)
  const { unmount } = render(<TocView />)
  act(() => vi.runAllTimers())
  harness.refresh.mockClear()
  oldGetAll.mockClear()
  act(() => {
    notifyOld!([{ ...oldHeadings[0], title: 'stale' }])
    setCapricornEditor('file', {
      headings: { getAll: nextGetAll, subscribe: () => () => {} },
    } as unknown as CapricornRuntimeAdapter)
  })
  // A callback queued by the old source must not steal the new initial task.
  act(() => notifyOld!([{ ...oldHeadings[0], title: 'late stale notification' }]))
  act(() => vi.runAllTimers())
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(oldGetAll).not.toHaveBeenCalled()
  expect(nextGetAll).toHaveBeenCalledOnce()
  expect(harness.refresh).toHaveBeenCalledExactlyOnceWith({
    newHeadings: [expect.objectContaining({ id: 'next', chapter: '1', value: 'Next' })],
  })
  act(() => {
    harness.commands.get('app:toc_refresh')?.()
    unmount()
    vi.runAllTimers()
  })
  expect(nextGetAll).toHaveBeenCalledOnce()
})
