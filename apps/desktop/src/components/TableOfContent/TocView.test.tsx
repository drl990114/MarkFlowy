import { runInNewContext } from 'node:vm'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useImperativeHandle, useState } from 'react'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCapricornEditor } from '../EditorArea/capricornEditorRegistry'
import type {
  CapricornHeading,
  CapricornRuntimeAdapter,
} from '../EditorArea/capricornRuntimeAdapter'
import { TocView } from './TocView'
import textEditorSource from '../EditorArea/TextEditor.tsx?raw'
import { EditorViewType } from '@/constants/editorViewType'
import type { FileType } from '@/helper/fileTypeHandler'
import type { ResumeSelection } from '@/stores/editorResumeStore'

const harness = vi.hoisted(() => ({
  commands: new Map<string, () => void>(),
  refresh: vi.fn(),
  numberingMount: vi.fn(),
  editorState: { activeId: 'file' as string | undefined },
  viewState: { editorViewTypeMap: new Map([['file', 'wysiwyg']]) },
  fileState: {
    fileTypeConfigMap: new Map<string, { type: FileType }>([['file', { type: 'markdown' }]]),
  },
  sourceViews: new Map<string, unknown>(),
  sourceListeners: new Set<() => void>(),
  rme: vi.fn(),
}))
vi.mock('../EditorArea/rmeRuntime', () => ({ getLoadedRmeRuntime: harness.rme }))

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
vi.mock('../SideBar/SideBarHeader', () => ({
  default: ({ actions }: { actions?: React.ReactNode }) => <>{actions}</>,
}))
vi.mock('../SideBar/DockPanelMenu', () => ({ DockPanelMenu: () => null }))
vi.mock('./HeadingNumberingButton', () => ({
  CapricornHeadingNumberingButton: () => {
    harness.numberingMount()
    return null
  },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@markflowy/interface', () => ({
  TableOfContents: ({ ref, activeId }: { ref: React.Ref<unknown>; activeId?: string }) => {
    const [headings, setHeadings] = useState<{ value: string }[]>([])
    useImperativeHandle(ref, () => ({
      refreshByHeadings: (args: { newHeadings: { value: string }[] }) => {
        harness.refresh(args)
        setHeadings(args.newHeadings)
      },
    }))
    return (
      <>
        <span data-testid='active-heading'>{activeId}</span>
        <span data-testid='outline-heading'>{headings[0]?.value}</span>
      </>
    )
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

function createCursorEditorPane(id = 'file', active = true) {
  const pane = document.createElement('div')
  pane.dataset.editorActive = String(active)
  pane.dataset.editorId = id
  Object.defineProperties(pane, {
    clientWidth: { value: 180 },
    offsetWidth: { value: 200 },
    clientHeight: { value: 200 },
    scrollHeight: { value: 1000 },
  })
  pane.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200)
  const content = document.createElement('div')
  content.setAttribute('data-cap-content', '')
  const editable = document.createElement('div')
  editable.setAttribute('data-cap-editable', '')
  editable.setAttribute('data-cap-key', `${id}-document`)
  editable.tabIndex = 0
  content.append(editable)
  pane.append(content)
  const input = document.createElement('textarea')
  input.setAttribute('data-cap-input', '')
  input.setAttribute('data-cap-dockey', `${id}-document`)
  // Capricorn's typing input is a body portal, outside the editor pane.
  document.body.append(pane, input)
  return { pane, content, editable, input }
}

function createCursorOutlineRuntime(prefix = '') {
  let headings = ['first', 'second'].map((id) => ({
    id: `${prefix}${id}`, level: 1, number: null, text: id, title: id,
  }))
  let viewportIndex = 0
  let selectionIndex = 0
  let selectionOffset = 0
  let selectionListener: (() => void) | undefined
  let headingListener: ((snapshot: CapricornHeading[]) => void) | undefined
  const unsubscribeSelection = vi.fn()
  const capture = vi.fn((): ResumeSelection => ({
    kind: 'capricorn',
    anchor: { path: [selectionIndex * 2 + 1, 0], offset: selectionOffset },
    focus: { path: [selectionIndex * 2 + 1, 0], offset: selectionOffset },
  }))
  const subscribeSelection = vi.fn((listener: () => void) => {
    selectionListener = listener
    return () => {
      if (selectionListener === listener) selectionListener = undefined
      unsubscribeSelection()
    }
  })
  const getAll = vi.fn(() => headings)
  const getActiveHeadingId = vi.fn(() => headings[viewportIndex].id)
  const getSelectionHeadingId = vi.fn(() => headings[selectionIndex].id)
  const editor = {
    headings: {
      getAll,
      jumpTo: vi.fn(async () => true),
      subscribe: (listener: typeof headingListener) => {
        headingListener = listener
        return () => { if (headingListener === listener) headingListener = undefined }
      },
    },
    getActiveHeadingId,
    getSelectionHeadingId,
    resume: { capture, subscribe: subscribeSelection, restore: vi.fn(() => true) },
  } as unknown as CapricornRuntimeAdapter
  return {
    editor, getAll, getActiveHeadingId, getSelectionHeadingId, capture,
    subscribeSelection, unsubscribeSelection,
    getSelectionListener: () => selectionListener,
    notifySelection: () => selectionListener?.(),
    moveSelection: (index: number, offset = 0) => {
      selectionIndex = index
      selectionOffset = offset
      selectionListener?.()
    },
    setViewport: (index: number) => { viewportIndex = index },
    renameHeadings: () => {
      headings = headings.map((heading) => ({ ...heading, title: `Renamed ${heading.title}` }))
      headingListener?.(headings)
    },
  }
}

afterEach(() => {
  cleanup()
  setCapricornEditor('file', undefined)
  harness.commands.clear()
  harness.refresh.mockClear()
  harness.numberingMount.mockClear()
  harness.editorState.activeId = 'file'
  harness.viewState.editorViewTypeMap.clear()
  harness.viewState.editorViewTypeMap.set('file', 'wysiwyg')
  harness.fileState.fileTypeConfigMap.clear()
  harness.fileState.fileTypeConfigMap.set('file', { type: 'markdown' })
  harness.sourceViews.clear()
  harness.sourceListeners.clear()
  harness.rme.mockReset()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('outline cursor following', () => {
  it.each(['content', 'portal-input'] as const)(
    'follows the %s caret through automatic scrolling and returns to viewport on manual scrolling',
    (focusTarget) => {
      vi.useFakeTimers()
      const { pane, editable, input } = createCursorEditorPane()
      const runtime = createCursorOutlineRuntime()
      setCapricornEditor('file', runtime.editor)
      const { getByTestId } = render(<TocView />)
      act(() => vi.runAllTimers())
      expect(getByTestId('active-heading').textContent).toBe('first')
      const focus = focusTarget === 'content' ? editable : input
      act(() => {
        focus.focus()
        runtime.moveSelection(1)
        vi.runAllTimers()
      })
      expect(getByTestId('active-heading').textContent).toBe('second')

      // Caret reveal can scroll the viewport without placing its heading at the top.
      act(() => {
        pane.dispatchEvent(new Event('scroll'))
        vi.runAllTimers()
      })
      expect(getByTestId('active-heading').textContent).toBe('second')

      for (const [index, event] of [
        new WheelEvent('wheel', { bubbles: true, deltaY: 100 }),
        new Event('touchmove', { bubbles: true }),
        new MouseEvent('pointerdown', { bubbles: true, clientX: 195, clientY: 20 }),
      ].entries()) {
        act(() => {
          pane.dispatchEvent(event)
          pane.dispatchEvent(new Event('scroll'))
          vi.runAllTimers()
        })
        expect(getByTestId('active-heading').textContent).toBe('first')
        act(() => {
          // A later caret change wins even if a scroll frame was already queued.
          pane.dispatchEvent(new Event('scroll'))
          runtime.moveSelection(1, index + 1)
          vi.runAllTimers()
        })
        expect(getByTestId('active-heading').textContent).toBe('second')
      }
      expect(runtime.getAll).toHaveBeenCalledOnce()
      expect(harness.refresh).toHaveBeenCalledOnce()
    },
  )

  it('waits for portal focus after a synchronous selection notification and rejects selection left outside', () => {
    vi.useFakeTimers()
    const { input } = createCursorEditorPane()
    const outside = document.createElement('input')
    document.body.append(outside)
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    expect(getByTestId('active-heading').textContent).toBe('first')

    act(() => {
      outside.focus()
      // The model publishes synchronously, before the click/layout effect focuses its portal.
      runtime.moveSelection(1)
      input.focus()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')

    act(() => {
      outside.focus()
      runtime.moveSelection(0)
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
    expect(runtime.getAll).toHaveBeenCalledOnce()
  })

  it('follows the first click when portal focus arrives after the selection frame', () => {
    vi.useFakeTimers()
    const { input } = createCursorEditorPane()
    const outside = document.createElement('input')
    document.body.append(outside)
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())

    act(() => {
      outside.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
    // Native WebKit may finish transferring focus only after the first frame.
    act(() => {
      input.focus()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
    expect(runtime.getAll).toHaveBeenCalledOnce()
    expect(harness.refresh).toHaveBeenCalledOnce()
  })

  it('resumes caret following when a click leaves the model selection unchanged', () => {
    vi.useFakeTimers()
    const { pane, editable, input } = createCursorEditorPane()
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      input.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
      pane.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')

    // Capricorn repairs native selection with blur/focus. With no pending
    // selection intent, that passive focus cycle must not undo manual scrolling.
    act(() => {
      input.blur()
      input.focus()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
    act(() => {
      editable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
    expect(runtime.getAll).toHaveBeenCalledOnce()
  })

  it('does not let delayed focus reclaim caret ownership after a newer reading gesture', () => {
    vi.useFakeTimers()
    const { pane, editable, input } = createCursorEditorPane()
    const outside = document.createElement('input')
    document.body.append(outside)
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      outside.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
      pane.dispatchEvent(new Event('scroll'))
      input.focus()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
    act(() => {
      editable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
  })

  it('ignores nested runtimes and block controls even while the active input has focus', () => {
    vi.useFakeTimers()
    const { pane, content, input } = createCursorEditorPane()
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      input.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
      pane.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    const nestedContent = document.createElement('div')
    nestedContent.setAttribute('data-cap-content', '')
    const nestedEditable = document.createElement('div')
    nestedEditable.tabIndex = 0
    nestedContent.append(nestedEditable)
    content.append(nestedContent)
    const targets: HTMLElement[] = [nestedEditable]
    for (const attribute of [
      'data-cap-not-editable', 'data-cap-avoid-click-focus', 'data-cap-selection-ignore',
    ]) {
      const control = document.createElement('div')
      control.setAttribute(attribute, '')
      content.append(control)
      targets.push(control)
    }
    const button = document.createElement('button')
    content.append(button)
    targets.push(button)
    for (const target of targets) {
      act(() => {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        vi.runAllTimers()
      })
      expect(getByTestId('active-heading').textContent).toBe('first')
    }
    act(() => {
      nestedEditable.focus()
      runtime.moveSelection(1, 1)
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
  })

  it('keeps embedded code editing eligible inside a non-editable block', () => {
    vi.useFakeTimers()
    const { pane, content } = createCursorEditorPane()
    const block = document.createElement('div')
    block.setAttribute('data-cap-not-editable', '')
    const codeInput = document.createElement('div')
    codeInput.className = 'cm-content'
    codeInput.setAttribute('contenteditable', 'true')
    codeInput.tabIndex = 0
    block.append(codeInput)
    content.append(block)
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      codeInput.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
    act(() => {
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
      pane.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
    act(() => {
      codeInput.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
  })

  it('cancels a pending selection when the user interacts elsewhere before delayed focus arrives', () => {
    vi.useFakeTimers()
    const { input } = createCursorEditorPane()
    const outside = document.createElement('input')
    document.body.append(outside)
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      outside.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      input.focus()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')
  })

  it('keeps caret ownership across passive refreshes and ignores external focus or unchanged selections', async () => {
    vi.useFakeTimers()
    const { pane, content, input } = createCursorEditorPane()
    const runtime = createCursorOutlineRuntime()
    setCapricornEditor('file', runtime.editor)
    const { getByTestId } = render(<TocView />)
    act(() => vi.runAllTimers())
    act(() => {
      input.focus()
      runtime.moveSelection(1)
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('second')
    await act(async () => {
      content.append(document.createElement('p'))
      runtime.renameHeadings()
      await Promise.resolve()
    })
    act(() => vi.runAllTimers())
    expect(getByTestId('active-heading').textContent).toBe('second')
    expect(runtime.getAll).toHaveBeenCalledOnce()

    act(() => {
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
      pane.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
      // capture() returns fresh objects, but equal paths/offsets are not a caret move.
      runtime.notifySelection()
      vi.runAllTimers()
    })
    expect(getByTestId('active-heading').textContent).toBe('first')

    const searchInput = document.createElement('input')
    document.body.append(searchInput)
    const toolbarButton = document.createElement('button')
    pane.append(toolbarButton)
    const inactive = createCursorEditorPane('inactive', false)
    for (const [index, external] of [searchInput, toolbarButton, inactive.input].entries()) {
      act(() => {
        external.focus()
        runtime.moveSelection(1, index + 1)
        vi.runAllTimers()
      })
      expect(getByTestId('active-heading').textContent).toBe('first')
    }
    expect(runtime.getAll).toHaveBeenCalledOnce()
  })

  it.each(['active-file', 'preview-mode'] as const)(
    'retains early caret changes and rejects old callbacks after replacement, %s changes and unmount',
    (change) => {
      vi.useFakeTimers()
      const { input } = createCursorEditorPane()
      const previous = createCursorOutlineRuntime('old-')
      setCapricornEditor('file', previous.editor)
      const { getByTestId, rerender, unmount } = render(<TocView />)
      const notifyPrevious = previous.getSelectionListener()!
      act(() => {
        input.focus()
        previous.moveSelection(1)
      })
      expect(previous.getAll).not.toHaveBeenCalled()
      act(() => vi.runAllTimers())
      expect(getByTestId('active-heading').textContent).toBe('old-second')

      const next = createCursorOutlineRuntime('next-')
      act(() => {
        previous.moveSelection(0)
        setCapricornEditor('file', next.editor)
      })
      act(() => {
        next.moveSelection(1)
        notifyPrevious()
        vi.runAllTimers()
      })
      expect(previous.unsubscribeSelection).toHaveBeenCalledOnce()
      expect(getByTestId('active-heading').textContent).toBe('next-second')
      expect(next.getAll).toHaveBeenCalledOnce()

      const notifyNext = next.getSelectionListener()!
      act(() => next.moveSelection(0))
      next.getSelectionHeadingId.mockClear()
      if (change === 'active-file') {
        harness.editorState.activeId = 'other-file'
        harness.fileState.fileTypeConfigMap.set('other-file', { type: 'text' })
        harness.viewState.editorViewTypeMap.set('other-file', EditorViewType.SOURCECODE)
      } else {
        harness.viewState.editorViewTypeMap.set('file', EditorViewType.PREVIEW)
      }
      // The queued frame must verify ownership even before React sees the switch.
      act(() => vi.runAllTimers())
      expect(next.getSelectionHeadingId).not.toHaveBeenCalled()
      rerender(<TocView />)
      act(() => {
        notifyNext()
        vi.runAllTimers()
      })
      expect(next.unsubscribeSelection).toHaveBeenCalledOnce()
      expect(next.subscribeSelection).toHaveBeenCalledOnce()
      expect(getByTestId('active-heading').textContent).toBe(
        change === 'active-file' ? '' : 'next-first',
      )

      const readsBeforeUnmount = next.capture.mock.calls.length
      unmount()
      act(() => {
        notifyPrevious()
        notifyNext()
        vi.runAllTimers()
      })
      expect(next.capture).toHaveBeenCalledTimes(readsBeforeUnmount)
      expect(next.getSelectionHeadingId).not.toHaveBeenCalled()
    },
  )
})

describe('outline file type ownership', () => {
  it.each([
    ['pdf', EditorViewType.PREVIEW],
    ['image', EditorViewType.PREVIEW],
    ['html', EditorViewType.PREVIEW],
    ['html', EditorViewType.SOURCECODE],
    ['text', EditorViewType.SOURCECODE],
    ['json', EditorViewType.SOURCECODE],
    ['unsupported', undefined],
    [undefined, undefined],
  ] as const)('clears Markdown headings immediately for %s in %s mode', (type, mode) => {
    vi.useFakeTimers()
    let notifyHeadings: ((headings: CapricornHeading[]) => void) | undefined
    const heading = { id: 'old', level: 1, number: null, text: 'Old', title: 'Old' }
    const unsubscribe = vi.fn()
    const getAll = vi.fn(() => [heading])
    setCapricornEditor('file', {
      headings: {
        getAll,
        subscribe: (listener: typeof notifyHeadings) => {
          notifyHeadings = listener
          return unsubscribe
        },
      },
    } as unknown as CapricornRuntimeAdapter)
    const { getByTestId, rerender } = render(<TocView />)
    act(() => vi.runAllTimers())
    expect(getByTestId('outline-heading').textContent).toBe('Old')
    harness.refresh.mockClear()

    // Queue an old heading notification before switching to the next file.
    act(() => notifyHeadings!([{ ...heading, title: 'Stale' }]))
    harness.editorState.activeId = 'other-file'
    if (type) harness.fileState.fileTypeConfigMap.set('other-file', { type })
    if (mode) harness.viewState.editorViewTypeMap.set('other-file', mode)
    rerender(<TocView />)
    expect(getByTestId('outline-heading').textContent).toBe('')
    expect(getByTestId('active-heading').textContent).toBe('')
    expect(harness.refresh).toHaveBeenLastCalledWith({ newHeadings: [] })
    expect(unsubscribe).toHaveBeenCalledOnce()

    act(() => {
      notifyHeadings!([{ ...heading, title: 'Late stale notification' }])
      harness.commands.get('app:toc_refresh')?.()
      vi.runAllTimers()
    })
    expect(getByTestId('outline-heading').textContent).toBe('')
    expect(harness.rme).not.toHaveBeenCalled()

    harness.editorState.activeId = 'file'
    rerender(<TocView />)
    act(() => vi.runAllTimers())
    expect(getByTestId('outline-heading').textContent).toBe('Old')
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('clears headings when the active file is reclassified without changing its preview mode', () => {
    vi.useFakeTimers()
    harness.viewState.editorViewTypeMap.set('file', EditorViewType.PREVIEW)
    const getAll = vi.fn(() => [
      { id: 'old', level: 1, number: null, text: 'Old', title: 'Old' },
    ])
    setCapricornEditor('file', {
      headings: { getAll, subscribe: () => () => {} },
    } as unknown as CapricornRuntimeAdapter)
    const { getByTestId, rerender } = render(<TocView />)
    act(() => vi.runAllTimers())
    expect(getByTestId('outline-heading').textContent).toBe('Old')

    harness.fileState.fileTypeConfigMap.set('file', { type: 'pdf' })
    rerender(<TocView />)
    expect(getByTestId('outline-heading').textContent).toBe('')
    act(() => {
      harness.commands.get('app:toc_refresh')?.()
      vi.runAllTimers()
    })
    expect(getAll).toHaveBeenCalledOnce()
    expect(getByTestId('outline-heading').textContent).toBe('')
  })

  it.each(['capricorn', 'source'])('rejects a queued %s scan after file reclassification', (engine) => {
    vi.useFakeTimers()
    const readHeadings = vi.fn(() => [])
    if (engine === 'capricorn') {
      setCapricornEditor('file', {
        headings: { getAll: readHeadings, subscribe: () => () => {} },
      } as unknown as CapricornRuntimeAdapter)
    } else {
      harness.viewState.editorViewTypeMap.set('file', EditorViewType.SOURCECODE)
      harness.sourceViews.set('file', {
        get cm() {
          return readHeadings()
        },
      })
    }
    render(<TocView />)
    act(() => harness.commands.get('app:toc_refresh')?.())
    // Execution-time checks must catch changes before React rerenders.
    harness.fileState.fileTypeConfigMap.set('file', { type: 'text' })
    act(() => vi.runAllTimers())
    expect(readHeadings).not.toHaveBeenCalled()
    expect(harness.rme).not.toHaveBeenCalled()
    expect(harness.refresh.mock.calls.every(([args]) => args.newHeadings.length === 0)).toBe(true)
  })
})

describe('Capricorn outline refresh ownership', () => {
  it.each(['wysiwyg', 'preview'])(
    'updates %s headings on scroll and virtual mounts without rescanning',
    async (mode) => {
      harness.viewState.editorViewTypeMap.set('file', mode)
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
      const jumpTo = vi.fn(async () => true)
      setCapricornEditor('file', {
        headings: { getAll, jumpTo, subscribe: () => () => {} },
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
      await act(async () => harness.refresh.mock.lastCall?.[0].newHeadings[1].onClick())
      expect(jumpTo).toHaveBeenCalledWith('second', { offset: 100 })
      if (mode === 'preview') expect(harness.numberingMount).not.toHaveBeenCalled()
    },
  )
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

it('reuses the source engine for outline extraction, numbering and navigation', () => {
  vi.useFakeTimers()
  harness.viewState.editorViewTypeMap.set('file', EditorViewType.SOURCECODE)
  const cm = { scrollDOM: document.createElement('div'), dispatch: vi.fn(), focus: vi.fn() }
  harness.sourceViews.set('file', { cm })
  const extractMatches = vi.fn(() => [{ type: 'ATXHeading1', value: '# 1 Introduction', from: 0 }])
  const analyzeHeadingNumbering = vi.fn(() => ({
    complete: true,
    entries: [{ prefix: '1', title: 'Introduction' }],
  }))
  harness.rme.mockReturnValue({ extractMatches, analyzeHeadingNumbering })
  render(<TocView />)
  act(() => {
    harness.commands.get('app:toc_refresh')?.()
    vi.runAllTimers()
  })
  expect(extractMatches).toHaveBeenCalledWith(cm)
  expect(analyzeHeadingNumbering).toHaveBeenCalledWith([{ level: 1, text: '1 Introduction' }])
  const heading = harness.refresh.mock.lastCall![0].newHeadings[0]
  expect(heading).toMatchObject({ depth: 1, chapter: '1', value: 'Introduction' })
  act(() => heading.onClick())
  expect(cm.dispatch).toHaveBeenCalledWith({
    selection: { anchor: 0, head: 0 },
    scrollIntoView: true,
  })
  expect(cm.focus).toHaveBeenCalledOnce()
})

it('cancels a queued Source Code scan after the active mode changes', () => {
  vi.useFakeTimers()
  harness.viewState.editorViewTypeMap.set('file', EditorViewType.SOURCECODE)
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
  expect(harness.rme).not.toHaveBeenCalled()
  expect(harness.refresh).not.toHaveBeenCalled()
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
