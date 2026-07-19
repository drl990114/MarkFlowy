import type { ProsemirrorNode } from '@rme-sdk/pm'
import { Schema } from '@rme-sdk/pm/model'
import { EditorState, NodeSelection, TextSelection } from '@rme-sdk/pm/state'
import type { EditorView } from '@rme-sdk/pm/view'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LivePreviewNodeViewOptions, LivePreviewRenderer } from './live-preview-types'

type MockCodeMirrorState = {
  doc: { length: number }
  selection: {
    main: { anchor: number; head: number; empty: boolean }
  }
}

type MockMfCodemirrorOptions = {
  node: ProsemirrorNode
  options: {
    codemirrorEditorViewConfig: { parent: HTMLElement }
    onSearchActiveChange?: (active: boolean) => void
  }
}

type MockMfCodemirrorInstance = {
  cm: {
    dom: HTMLElement
    contentDOM: HTMLElement
    readonly hasFocus: boolean
    state: MockCodeMirrorState
    dispatch: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
    requestMeasure: ReturnType<typeof vi.fn>
  }
  content: string
  destroy: ReturnType<typeof vi.fn>
  forwardSelection: ReturnType<typeof vi.fn>
  modeAtLastFocus: string | undefined
  modeAtLastSetSelection: string | undefined
  options: MockMfCodemirrorOptions
  parent: HTMLElement
  setSelection: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

const codemirrorHarness = vi.hoisted(() => ({
  instances: [] as MockMfCodemirrorInstance[],
}))

vi.mock('../../codemirror', () => ({
  MfCodemirrorView: class {
    cm: {
      dom: HTMLElement
      contentDOM: HTMLElement
      readonly hasFocus: boolean
      state: {
        doc: { length: number }
        selection: {
          main: { anchor: number; head: number; empty: boolean }
        }
      }
      dispatch: ReturnType<typeof vi.fn>
      focus: ReturnType<typeof vi.fn>
      requestMeasure: ReturnType<typeof vi.fn>
    }

    content: string
    destroy: ReturnType<typeof vi.fn>
    forwardSelection: ReturnType<typeof vi.fn>
    modeAtLastFocus: string | undefined
    modeAtLastSetSelection: string | undefined
    options: MockMfCodemirrorOptions
    parent: HTMLElement
    setSelection: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>

    constructor(options: MockMfCodemirrorOptions) {
      this.options = options
      this.parent = options.options.codemirrorEditorViewConfig.parent
      this.content = options.node.textContent

      const dom = document.createElement('div')
      const contentDOM = document.createElement('div')
      contentDOM.tabIndex = 0
      dom.append(contentDOM)
      this.parent.append(dom)

      const state = {
        doc: { length: this.content.length },
        selection: {
          main: { anchor: 0, head: 0, empty: true },
        },
      }

      const focus = vi.fn(() => {
        this.modeAtLastFocus = this.parent.closest<HTMLElement>(
          '.mf-live-preview-block',
        )?.dataset.mode
        contentDOM.focus()
      })

      this.cm = {
        dom,
        contentDOM,
        get hasFocus() {
          return document.activeElement === contentDOM
        },
        state,
        dispatch: vi.fn((spec: { selection?: { anchor: number; head?: number } }) => {
          if (!spec.selection) return
          const anchor = spec.selection.anchor
          const head = spec.selection.head ?? anchor
          state.selection.main = { anchor, head, empty: anchor === head }
        }),
        focus,
        requestMeasure: vi.fn(),
      }

      this.destroy = vi.fn(() => dom.remove())
      this.forwardSelection = vi.fn()
      this.setSelection = vi.fn((anchor: number, head: number) => {
        this.modeAtLastSetSelection = this.parent.closest<HTMLElement>(
          '.mf-live-preview-block',
        )?.dataset.mode
        state.selection.main = { anchor, head, empty: anchor === head }
        focus()
      })
      this.update = vi.fn((node: ProsemirrorNode) => {
        this.content = node.textContent
        state.doc.length = this.content.length
        return true
      })

      codemirrorHarness.instances.push(this)
    }
  },
}))

import { LivePreviewNodeView } from './LivePreviewNodeView'
import { LivePreviewBlockExtension } from './live-preview-extension'

function deferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    livePreview: {
      group: 'block',
      content: 'text*',
      selectable: true,
      toDOM: () => ['div', 0],
    },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
})

function createNode(textContent: string): ProsemirrorNode {
  return schema.nodes.livePreview.create(
    null,
    textContent ? schema.text(textContent) : undefined,
  )
}

function createEditorView(node: ProsemirrorNode): EditorView {
  let state = EditorState.create({
    doc: schema.nodes.doc.create(null, [node, schema.nodes.paragraph.create()]),
  })

  return {
    get state() {
      return state
    },
    dispatch: vi.fn((transaction) => {
      state = state.apply(transaction)
    }),
    focus: vi.fn(),
    hasFocus: vi.fn(() => true),
    root: document,
  } as unknown as EditorView
}

function createRenderer(
  overrides: Partial<LivePreviewRenderer> = {},
): LivePreviewRenderer {
  return {
    className: 'test-renderer',
    displayName: 'Test',
    getCodeMirrorExtensions: () => [],
    languageName: 'test',
    render: (content, container) => {
      container.textContent = content
    },
    ...overrides,
  }
}

const nodeViews: LivePreviewNodeView[] = []

function createNodeView({
  content = 'source',
  renderer = createRenderer(),
  ...options
}: {
  content?: string
  renderer?: LivePreviewRenderer
} & Partial<
  Pick<LivePreviewNodeViewOptions, 'behavior' | 'defaultMode' | 'openOnMount'>
>) {
  const node = createNode(content)
  const view = createEditorView(node)
  const nodeView = new LivePreviewNodeView({
    getPos: () => 0,
    node,
    renderer,
    view,
    ...options,
  })
  nodeViews.push(nodeView)
  document.body.append(nodeView.dom)
  return { node, nodeView, view }
}

function getToolbarButtons(nodeView: LivePreviewNodeView) {
  const buttons = Array.from(
    nodeView.dom.querySelectorAll<HTMLButtonElement>('.mf-live-preview-toolbar button'),
  )
  expect(buttons).toHaveLength(3)
  return {
    copy: buttons[1]!,
    fullscreen: buttons[2]!,
    toggle: buttons[0]!,
  }
}

function setSearchActive(codemirror: MockMfCodemirrorInstance, active: boolean) {
  const onSearchActiveChange = codemirror.options.options.onSearchActiveChange
  expect(onSearchActiveChange).toBeTypeOf('function')
  onSearchActiveChange?.(active)
}

async function flushRender(delay = 0) {
  await vi.advanceTimersByTimeAsync(delay)
  await Promise.resolve()
  await Promise.resolve()
}

describe('LivePreviewNodeView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    codemirrorHarness.instances.length = 0
    document.body.replaceChildren()
  })

  afterEach(() => {
    for (const nodeView of nodeViews.splice(0)) {
      nodeView.destroy()
    }
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  test('defaults existing automatic blocks to preview mode', () => {
    const { nodeView } = createNodeView({ behavior: 'auto' })
    const { toggle } = getToolbarButtons(nodeView)

    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(toggle.type).toBe('button')
    expect(toggle.getAttribute('aria-label')).toBe('Edit source')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  test('shows source for an empty automatic block without stealing focus', () => {
    const { nodeView } = createNodeView({ behavior: 'auto', content: '' })

    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(codemirrorHarness.instances[0].cm.focus).not.toHaveBeenCalled()
  })

  test('honors an always-split behavior', () => {
    const { nodeView } = createNodeView({ behavior: 'always-split' })
    const { toggle } = getToolbarButtons(nodeView)

    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(toggle.getAttribute('aria-label')).toBe('Source always visible')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.disabled).toBe(true)
  })

  test('opens the source before focusing when openOnMount is requested', async () => {
    const { nodeView } = createNodeView({ openOnMount: true })
    const codemirror = codemirrorHarness.instances[0]

    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(codemirror.cm.requestMeasure).toHaveBeenCalled()
    expect(codemirror.cm.focus).toHaveBeenCalled()
    expect(codemirror.modeAtLastFocus).toBe('split')
    expect(codemirror.forwardSelection).toHaveBeenCalled()
  })

  test('toggles source with accessible state, measurement, and disclosure focus', async () => {
    const { nodeView, view } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    const { toggle } = getToolbarButtons(nodeView)

    toggle.click()
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(toggle.getAttribute('aria-label')).toBe('Hide source')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(codemirror.cm.requestMeasure).toHaveBeenCalled()
    expect(codemirror.cm.focus).toHaveBeenCalled()
    expect(codemirror.modeAtLastFocus).toBe('split')
    expect(codemirror.cm.requestMeasure.mock.invocationCallOrder[0]).toBeLessThan(
      codemirror.cm.focus.mock.invocationCallOrder[0],
    )

    toggle.focus()
    toggle.click()

    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(toggle.getAttribute('aria-label')).toBe('Edit source')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
    expect(view.focus).not.toHaveBeenCalled()
  })

  test('reveals the source before forwarding an outer editor selection', () => {
    const { nodeView } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]

    nodeView.setSelection(1, 4)

    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(codemirror.setSelection).toHaveBeenCalledWith(1, 4)
    expect(codemirror.modeAtLastSetSelection).toBe('split')
  })

  test('shows source only while an automatic block has an active search match', () => {
    const { nodeView } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    const { toggle } = getToolbarButtons(nodeView)

    expect(nodeView.dom.dataset.mode).toBe('preview')

    setSearchActive(codemirror, true)
    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(toggle.disabled).toBe(true)
    expect(toggle.getAttribute('aria-label')).toBe('Source shown for search result')

    setSearchActive(codemirror, false)
    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(toggle.disabled).toBe(false)
  })

  test('does not close a manually opened source when search becomes inactive', () => {
    const { nodeView } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    getToolbarButtons(nodeView).toggle.click()

    setSearchActive(codemirror, true)
    setSearchActive(codemirror, false)

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('does not close a selection-opened source when search becomes inactive', () => {
    const { nodeView } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    nodeView.setSelection(1, 1)

    setSearchActive(codemirror, true)
    setSearchActive(codemirror, false)

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('never closes an always-split source when search becomes inactive', () => {
    const { nodeView } = createNodeView({ behavior: 'always-split' })
    const codemirror = codemirrorHarness.instances[0]

    setSearchActive(codemirror, true)
    setSearchActive(codemirror, false)

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('updates mounted blocks when the behavior changes', () => {
    const { nodeView } = createNodeView({ behavior: 'auto' })

    nodeView.setBehavior('always-split')
    expect(nodeView.dom.dataset.mode).toBe('split')

    nodeView.setBehavior('auto')
    expect(nodeView.dom.dataset.mode).toBe('preview')
  })

  test('opens selected blocks with Enter', async () => {
    const { nodeView, view } = createNodeView({})
    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)),
    )
    const enter = new LivePreviewBlockExtension({}).createKeymap().Enter

    const handled = enter?.({
      dispatch: view.dispatch,
      next: () => false,
      state: view.state,
      tr: view.state.tr,
      view,
    })
    await flushRender(20)

    expect(handled).toBe(true)
    expect(nodeView.dom.dataset.mode).toBe('split')
    expect(codemirrorHarness.instances[0].cm.focus).toHaveBeenCalled()
  })

  test('collapses after focus and selection leave the block', async () => {
    const { node, nodeView, view } = createNodeView({})
    const outside = document.createElement('button')
    document.body.append(outside)
    getToolbarButtons(nodeView).toggle.click()
    await flushRender(20)

    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, node.nodeSize + 1)),
    )
    outside.focus()
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('preview')
  })

  test('collapses when editor focus leaves even if the outer selection is retained', async () => {
    const { nodeView } = createNodeView({})
    const outside = document.createElement('button')
    document.body.append(outside)
    getToolbarButtons(nodeView).toggle.click()
    await flushRender(20)

    outside.focus()
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('preview')
  })

  test('keeps source open while focus stays inside the block', async () => {
    const { nodeView } = createNodeView({})
    const { copy, toggle } = getToolbarButtons(nodeView)
    toggle.click()
    await flushRender(20)

    copy.focus()
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('keeps source open when the application loses focus', async () => {
    const { node, nodeView, view } = createNodeView({})
    const outside = document.createElement('button')
    document.body.append(outside)
    getToolbarButtons(nodeView).toggle.click()
    await flushRender(20)
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, node.nodeSize + 1)),
    )
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)

    outside.focus()
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('rechecks auto-collapse when focus returns to the application', async () => {
    const { node, nodeView, view } = createNodeView({})
    const outside = document.createElement('button')
    document.body.append(outside)
    getToolbarButtons(nodeView).toggle.click()
    await flushRender(20)
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, node.nodeSize + 1)),
    )
    let appFocused = false
    vi.spyOn(document, 'hasFocus').mockImplementation(() => appFocused)

    outside.focus()
    await flushRender(20)
    expect(nodeView.dom.dataset.mode).toBe('split')

    appFocused = true
    window.dispatchEvent(new Event('focus'))
    await flushRender(20)

    expect(nodeView.dom.dataset.mode).toBe('preview')
  })

  test('Escape closes source editing and restores outer editor focus', async () => {
    const { nodeView, view } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    const { toggle } = getToolbarButtons(nodeView)
    toggle.click()
    await flushRender(20)

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    })
    codemirror.cm.contentDOM.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(view.state.selection).toBeInstanceOf(NodeSelection)
    expect(view.state.selection.from).toBe(0)
    expect(view.focus).toHaveBeenCalled()
  })

  test('Escape exits fullscreen and returns automatic blocks to preview', async () => {
    const { nodeView } = createNodeView({})
    const codemirror = codemirrorHarness.instances[0]
    const { fullscreen, toggle } = getToolbarButtons(nodeView)
    toggle.click()
    await flushRender(20)
    fullscreen.click()

    const exitFullscreen = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    })
    codemirror.cm.contentDOM.dispatchEvent(exitFullscreen)

    expect(nodeView.dom.classList.contains('mf-live-preview-fullscreen')).toBe(false)
    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(document.activeElement).toBe(fullscreen)
  })

  test('does not enter fullscreen when interacting with rendered content', async () => {
    const onPreviewClick = vi.fn()
    const renderer = createRenderer({
      render: (_content, container) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Rendered action'
        button.addEventListener('click', onPreviewClick)
        container.append(button)
      },
    })
    const { nodeView } = createNodeView({ renderer })
    await flushRender()

    const renderedButton = nodeView.dom.querySelector<HTMLButtonElement>(
      '.mf-live-preview-render button',
    )
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
    renderedButton?.dispatchEvent(event)

    expect(onPreviewClick).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
    expect(nodeView.dom.classList.contains('mf-live-preview-fullscreen')).toBe(false)

    getToolbarButtons(nodeView).fullscreen.click()
    expect(nodeView.dom.classList.contains('mf-live-preview-fullscreen')).toBe(true)
    expect(nodeView.dom.dataset.mode).toBe('split')

    getToolbarButtons(nodeView).fullscreen.click()
    expect(nodeView.dom.classList.contains('mf-live-preview-fullscreen')).toBe(false)
    expect(nodeView.dom.dataset.mode).toBe('preview')
  })

  test('keeps an always-split preference when fullscreen exits', () => {
    const { nodeView } = createNodeView({ behavior: 'always-split' })
    const { fullscreen } = getToolbarButtons(nodeView)

    fullscreen.click()
    expect(nodeView.dom.dataset.mode).toBe('split')

    fullscreen.click()
    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('keeps render errors repairable from preview mode', async () => {
    const renderer = createRenderer({
      render: () => {
        throw new Error('Invalid diagram')
      },
    })
    const { nodeView } = createNodeView({ renderer })
    await flushRender()

    expect(nodeView.dom.dataset.mode).toBe('preview')
    expect(
      nodeView.dom.querySelector<HTMLElement>('.mf-live-preview-error')?.textContent,
    ).toBe('Invalid diagram')

    nodeView.dom
      .querySelector<HTMLButtonElement>('.mf-live-preview-error-action')
      ?.click()

    expect(nodeView.dom.dataset.mode).toBe('split')
  })

  test('does not let a stale async render mutate the latest preview', async () => {
    const oldRender = deferred()
    const newRender = deferred()
    const renderer = createRenderer({
      render: async (content, container) => {
        await (content === 'old' ? oldRender.promise : newRender.promise)
        container.textContent = content
      },
    })
    const { nodeView } = createNodeView({ content: 'old', renderer })
    const preview = nodeView.dom.querySelector<HTMLElement>('.mf-live-preview-render')

    await flushRender()
    nodeView.update(createNode('new'))
    await flushRender(120)
    newRender.resolve()
    await flushRender()
    expect(preview?.textContent).toBe('new')

    oldRender.resolve()
    await flushRender()
    expect(preview?.textContent).toBe('new')
  })

  test('does not let a stale rejection replace the latest successful preview', async () => {
    const oldRender = deferred()
    const newRender = deferred()
    const renderer = createRenderer({
      render: async (content, container) => {
        await (content === 'old' ? oldRender.promise : newRender.promise)
        container.textContent = content
      },
    })
    const { nodeView } = createNodeView({ content: 'old', renderer })
    const preview = nodeView.dom.querySelector<HTMLElement>('.mf-live-preview-render')

    await flushRender()
    nodeView.update(createNode('new'))
    await flushRender(120)
    newRender.resolve()
    await flushRender()

    oldRender.reject(new Error('stale error'))
    await flushRender()

    expect(preview?.textContent).toBe('new')
    expect(preview?.classList.contains('mf-live-preview-render-error')).toBe(false)
  })
})
