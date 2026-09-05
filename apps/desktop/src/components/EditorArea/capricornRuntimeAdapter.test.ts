import { describe, expect, it, vi } from 'vitest'
import {
  createCapricornRuntimeAdapter,
  createCapricornRuntimeAdapterAsync,
  getCapricornFirstPaintBlockSize,
  requiresAsyncCapricornOpen,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
  type CapricornUiState,
} from './capricornRuntimeAdapter'

describe('Capricorn opening policy', () => {
  it('passes clipboard capabilities through without changing document subscriptions', () => {
    const harness = createRuntimeHarness()
    const clipboard = { writeText: vi.fn(async () => {}) }
    const onClipboardResult = vi.fn()
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial', clipboard, onClipboardResult },
    })
    expect(harness.createRuntime).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ clipboard, onClipboardResult }),
    )
    expect(onChange).not.toHaveBeenCalled()
    adapter.destroy()
  })
  it('uses the exact UTF-8 threshold, including non-ASCII Markdown', () => {
    expect(requiresAsyncCapricornOpen('a'.repeat(256 * 1024 - 1))).toBe(false)
    expect(requiresAsyncCapricornOpen('a'.repeat(256 * 1024))).toBe(true)
    expect(requiresAsyncCapricornOpen('中'.repeat(87_381))).toBe(false)
    expect(requiresAsyncCapricornOpen('中'.repeat(87_382))).toBe(true)
    expect(requiresAsyncCapricornOpen('😀'.repeat(65_536))).toBe(true)
  })

  it('sizes the initial viewport without changing the scroll buffer', () => {
    expect(getCapricornFirstPaintBlockSize(240)).toBe(12)
    expect(getCapricornFirstPaintBlockSize(900)).toBe(40)
    expect(getCapricornFirstPaintBlockSize(2000)).toBe(40)
  })

  it('adapts async sessions with the existing change and snapshot ownership', async () => {
    const harness = createRuntimeHarness('# Initial', true)
    const onChange = vi.fn()
    const adapter = await createCapricornRuntimeAdapterAsync({
      container: document.createElement('div'),
      createRuntime: vi.fn(async () => harness.session),
      onChange,
      options: { markdown: '# Initial' },
    })
    expect(adapter.getMarkdown()).toBe('# Initial')
    expect(harness.session.getMarkdown).not.toHaveBeenCalled()
    adapter.setMarkdown('# Replaced')
    expect(onChange).not.toHaveBeenCalled()
    adapter.destroy()
    expect(harness.session.destroy).toHaveBeenCalledOnce()
  })

  it('destroys a session returned after cancellation without subscribing to it', async () => {
    const harness = createRuntimeHarness()
    const abort = new AbortController()
    let complete!: (session: CapricornRuntimeSession) => void
    const opening = createCapricornRuntimeAdapterAsync({
      container: document.createElement('div'),
      createRuntime: () =>
        new Promise((resolve) => {
          complete = resolve
        }),
      onChange: vi.fn(),
      options: { signal: abort.signal },
    })
    abort.abort()
    complete(harness.session)
    await expect(opening).rejects.toMatchObject({ name: 'AbortError' })
    expect(harness.session.destroy).toHaveBeenCalledOnce()
    expect(harness.session.subscribe).not.toHaveBeenCalled()
  })
})

function createRuntimeHarness(initialMarkdown = '# Initial', supportsDocumentChange = false) {
  let markdown = initialMarkdown
  let revision = 0
  let composing = false
  let documentListener:
    | Parameters<NonNullable<CapricornRuntimeSession['subscribeDocumentChange']>>[0]
    | undefined
  let listener: Parameters<CapricornRuntimeSession['subscribe']>[0] | undefined
  let uiListener: Parameters<CapricornRuntimeSession['subscribeUiState']>[0] | undefined
  let uiState: CapricornUiState = {
    canRedo: false,
    canUndo: false,
    currentBlockType: 'paragraph',
    listType: null,
    markStates: {},
    readOnly: false,
  }
  const session: CapricornRuntimeSession = {
    commands: {
      insertImage: vi.fn(),
      redo: vi.fn(),
      setBlockType: vi.fn(),
      toggleBlockquote: vi.fn(),
      toggleList: vi.fn(),
      toggleMark: vi.fn(),
      undo: vi.fn(),
    },
    destroy: vi.fn(),
    export: vi.fn(async () => '<h1>Initial</h1>'),
    find: {
      clear: vi.fn(),
      close: vi.fn(),
      getState: vi.fn(),
      next: vi.fn(),
      open: vi.fn(),
      previous: vi.fn(),
      replace: vi.fn(),
      replaceAll: vi.fn(),
      search: vi.fn(),
      subscribe: vi.fn(),
    } as CapricornRuntimeSession['find'],
    focus: vi.fn(),
    getMarkdown: vi.fn(() => markdown),
    isComposing: () => composing,
    getUiState: () => uiState,
    headings: {
      applyNumbering: vi.fn(),
      getAll: vi.fn(() => []),
      getNumbering: vi.fn(),
      jumpTo: vi.fn(),
      removeNumbering: vi.fn(),
      subscribe: vi.fn(),
    } as CapricornRuntimeSession['headings'],
    setMarkdown: vi.fn((nextMarkdown: string) => {
      markdown = nextMarkdown
      listener?.({ markdown, mode: 'edit', type: 'change' })
      documentListener?.({ revision: ++revision })
    }),
    subscribe: vi.fn((nextListener) => {
      listener = nextListener
      return () => {
        listener = undefined
      }
    }),
    subscribeUiState: vi.fn((nextListener) => {
      uiListener = nextListener
      return () => {
        uiListener = undefined
      }
    }),
    updateSettings: vi.fn(),
    waitForResources: vi.fn(async () => undefined),
  }
  if (supportsDocumentChange) {
    session.subscribeDocumentChange = vi.fn((nextListener) => {
      documentListener = nextListener
      return () => {
        documentListener = undefined
      }
    })
  }
  const createRuntime = vi.fn(() => session) as CapricornRuntimeFactory

  return {
    createRuntime,
    setComposing(value: boolean) {
      composing = value
      documentListener?.({ composing, pending: value, revision })
    },
    emitChange(nextMarkdown: string) {
      markdown = nextMarkdown
      listener?.({ markdown, mode: 'edit', type: 'change' })
      documentListener?.({ revision: ++revision })
    },
    emitPending(nextMarkdown: string) {
      markdown = nextMarkdown
      documentListener?.({ pending: true, revision: ++revision })
    },
    commit() {
      documentListener?.({ revision })
    },
    emitUiState(nextState: typeof uiState) {
      uiState = nextState
      uiListener?.(uiState)
    },
    session,
  }
}

describe('createCapricornRuntimeAdapter', () => {
  it('exposes cooperative statistics without falling back to a full text export', async () => {
    const harness = createRuntimeHarness()
    const statistics = {
      characterCount: 18,
      nonWhitespaceCharacterCount: 15,
      wordCount: 3,
    }
    const getStatistics = vi.fn(async () => statistics)
    Object.assign(harness.session, { getStatistics })
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: {},
    })
    const abort = new AbortController()

    await expect(adapter.getStatistics?.({ signal: abort.signal })).resolves.toEqual(statistics)
    expect(getStatistics).toHaveBeenCalledWith({ signal: abort.signal })
    expect(harness.session.export).not.toHaveBeenCalled()

    adapter.destroy()
    await expect(adapter.getStatistics?.()).rejects.toMatchObject({ name: 'AbortError' })
    expect(getStatistics).toHaveBeenCalledOnce()
  })

  it('does not advertise statistics when the runtime cannot provide them', () => {
    const harness = createRuntimeHarness()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: {},
    })

    expect(adapter.getStatistics).toBeUndefined()
    expect(harness.session.export).not.toHaveBeenCalled()
  })

  it('routes runtime clicks and toolbar requests through session-owned selection bookmarks', () => {
    const harness = createRuntimeHarness()
    const bookmark = {
      id: 'target',
      text: 'selected',
      isCollapsed: false,
      canInsertInline: true,
      link: null,
      image: null,
    }
    const selection = {
      capture: vi.fn(() => bookmark),
      release: vi.fn(),
      restore: vi.fn(),
      isValid: vi.fn(() => true),
      getRect: () => null,
    }
    Object.assign(harness.session, { selection })
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: {},
    })
    const listener = vi.fn()
    adapter.subscribeInlineEdit!(listener)
    expect(adapter.requestInlineEdit!('link')).toBe(true)
    expect(listener).toHaveBeenLastCalledWith({ kind: 'link', bookmark, focus: true })
    const options = vi.mocked(harness.createRuntime).mock.calls[0][1]!
    expect(options.linkOpenMode).toBe('button')
    options.onEditInline!({ kind: 'image', key: 'image-node', focus: false })
    expect(selection.capture).toHaveBeenLastCalledWith('image-node')
    expect(listener).toHaveBeenLastCalledWith({ kind: 'image', bookmark, focus: false })
    selection.isValid.mockReturnValue(false)
    harness.emitChange('changed with the same toolbar state')
    expect(listener).toHaveBeenLastCalledWith(null)
    adapter.destroy()
    expect(selection.release).toHaveBeenCalledOnce()
    expect(adapter.requestInlineEdit!('image')).toBe(false)
  })

  it('destroys the session if reading its initial UI state fails', () => {
    const harness = createRuntimeHarness()
    const error = new Error('Initial UI state failed')
    vi.spyOn(harness.session, 'getUiState').mockImplementation(() => {
      throw error
    })

    expect(() =>
      createCapricornRuntimeAdapter({
        container: document.createElement('div'),
        createRuntime: harness.createRuntime,
        onChange: vi.fn(),
        options: { markdown: '# Initial' },
      }),
    ).toThrow(error)

    expect(harness.session.subscribe).not.toHaveBeenCalled()
    expect(harness.session.subscribeUiState).not.toHaveBeenCalled()
    expect(harness.session.destroy).toHaveBeenCalledOnce()
  })

  it.each([false, true])(
    'releases the first subscription if UI subscription fails (document events=%s)',
    (supportsDocumentChange) => {
      const harness = createRuntimeHarness('# Initial', supportsDocumentChange)
      const error = new Error('UI subscription failed')
      const unsubscribe = vi.fn()
      const subscribe = harness.session.subscribeDocumentChange ?? harness.session.subscribe
      vi.mocked(subscribe).mockReturnValue(unsubscribe)
      vi.mocked(harness.session.subscribeUiState).mockImplementation(() => {
        throw error
      })

      expect(() =>
        createCapricornRuntimeAdapter({
          container: document.createElement('div'),
          createRuntime: harness.createRuntime,
          onChange: vi.fn(),
          options: { markdown: '# Initial' },
        }),
      ).toThrow(error)

      expect(unsubscribe).toHaveBeenCalledOnce()
      expect(harness.session.destroy).toHaveBeenCalledOnce()
    },
  )

  it('preserves the initialization error even if cleanup and destruction also fail', () => {
    const harness = createRuntimeHarness()
    const error = new Error('UI subscription failed')
    const unsubscribe = vi.fn(() => {
      throw new Error('Subscription cleanup failed')
    })
    vi.mocked(harness.session.subscribe).mockReturnValue(unsubscribe)
    vi.mocked(harness.session.subscribeUiState).mockImplementation(() => {
      throw error
    })
    vi.mocked(harness.session.destroy).mockImplementation(() => {
      throw new Error('Session destruction failed')
    })

    expect(() =>
      createCapricornRuntimeAdapter({
        container: document.createElement('div'),
        createRuntime: harness.createRuntime,
        onChange: vi.fn(),
        options: { markdown: '# Initial' },
      }),
    ).toThrow(error)

    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(harness.session.destroy).toHaveBeenCalledOnce()
  })

  it('finishes destruction after a subscription cleanup error and does not destroy twice', () => {
    const harness = createRuntimeHarness()
    const error = new Error('Subscription cleanup failed')
    const unsubscribe = vi.fn(() => {
      throw error
    })
    const unsubscribeUiState = vi.fn()
    vi.mocked(harness.session.subscribe).mockReturnValue(unsubscribe)
    vi.mocked(harness.session.subscribeUiState).mockReturnValue(unsubscribeUiState)
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: { markdown: '# Initial' },
    })

    expect(() => adapter.destroy()).toThrow(error)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(unsubscribeUiState).toHaveBeenCalledOnce()
    expect(harness.session.destroy).toHaveBeenCalledOnce()

    expect(() => adapter.destroy()).not.toThrow()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(unsubscribeUiState).toHaveBeenCalledOnce()
    expect(harness.session.destroy).toHaveBeenCalledOnce()
  })

  it('exposes composition boundaries without marking the unchanged document revision dirty', () => {
    const harness = createRuntimeHarness('# Initial', true)
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })
    harness.setComposing(true)
    expect(adapter.isComposing()).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith({
      composing: true,
      documentChanged: false,
      pending: true,
    })
    harness.setComposing(false)
    expect(adapter.isComposing()).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith({
      composing: false,
      documentChanged: false,
      pending: false,
    })
    expect(adapter.getMarkdown()).toBe('# Initial')
    expect(harness.session.getMarkdown).not.toHaveBeenCalled()
    adapter.destroy()
  })
  it('exposes pending input immediately and reuses its snapshot when the same revision commits', () => {
    const harness = createRuntimeHarness('# Initial', true)
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })

    harness.emitPending('# Pending')
    expect(onChange).toHaveBeenLastCalledWith({ documentChanged: true, pending: true })
    expect(harness.session.getMarkdown).not.toHaveBeenCalled()
    expect(adapter.getMarkdown()).toBe('# Pending')
    harness.commit()
    expect(onChange).toHaveBeenLastCalledWith({ documentChanged: false, pending: undefined })
    expect(adapter.getMarkdown()).toBe('# Pending')
    expect(harness.session.getMarkdown).toHaveBeenCalledOnce()

    harness.emitPending('# Next')
    expect(onChange).toHaveBeenLastCalledWith({ documentChanged: true, pending: true })
    harness.commit()
    expect(adapter.getMarkdown()).toBe('# Next')
    expect(harness.session.getMarkdown).toHaveBeenCalledTimes(2)
    adapter.destroy()
  })

  it('publishes editor changes but suppresses host setMarkdown echoes', () => {
    const harness = createRuntimeHarness()
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })

    harness.emitChange('# Local edit')
    expect(onChange).toHaveBeenCalledOnce()

    adapter.setMarkdown('# External edit')
    expect(harness.session.setMarkdown).toHaveBeenCalledWith('# External edit')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('adopts a host replacement revision before a composition boundary', () => {
    const harness = createRuntimeHarness('# Initial', true)
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })

    adapter.setMarkdown('# Remote replacement')
    expect(onChange).not.toHaveBeenCalled()

    harness.setComposing(true)
    expect(onChange).toHaveBeenLastCalledWith({
      composing: true,
      documentChanged: false,
      pending: true,
    })
    harness.setComposing(false)
    expect(onChange).toHaveBeenLastCalledWith({
      composing: false,
      documentChanged: false,
      pending: false,
    })
    expect(adapter.getMarkdown()).toBe('# Remote replacement')
    expect(harness.session.getMarkdown).not.toHaveBeenCalled()
  })

  it('defers Markdown serialization when the runtime exposes document revisions', () => {
    const harness = createRuntimeHarness('# Initial', true)
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })

    expect(harness.session.subscribe).not.toHaveBeenCalled()
    harness.emitChange('# Local edit')
    harness.emitChange('# Latest local edit')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(harness.session.getMarkdown).not.toHaveBeenCalled()

    expect(adapter.getMarkdown()).toBe('# Latest local edit')
    expect(harness.session.getMarkdown).toHaveBeenCalledOnce()
    expect(adapter.getMarkdown()).toBe('# Latest local edit')
    expect(harness.session.getMarkdown).toHaveBeenCalledOnce()

    adapter.setMarkdown('# Latest local edit')
    expect(harness.session.setMarkdown).not.toHaveBeenCalled()
  })

  it('skips identical content and releases the subscription before destroying', () => {
    const harness = createRuntimeHarness()
    const onChange = vi.fn()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange,
      options: { markdown: '# Initial' },
    })

    adapter.setMarkdown('# Initial')
    expect(harness.session.setMarkdown).not.toHaveBeenCalled()

    adapter.destroy()
    harness.emitChange('# Late edit')
    expect(onChange).not.toHaveBeenCalled()
    expect(harness.session.destroy).toHaveBeenCalledOnce()
  })

  it('adapts host image selection and runtime HTML export', async () => {
    const harness = createRuntimeHarness()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: {
        imageInsertHandler: async () => ({ alt: 'Diagram', src: 'diagram.png' }),
        markdown: '# Initial',
      },
    })

    await expect(adapter.requestImageInsert()).resolves.toBe(true)
    expect(harness.session.commands.insertImage).toHaveBeenCalledWith({
      alt: 'Diagram',
      src: 'diagram.png',
    })
    await expect(adapter.export('html')).resolves.toBe('<h1>Initial</h1>')
  })

  it('keeps a cached UI snapshot for React external-store subscribers', () => {
    const harness = createRuntimeHarness()
    const adapter = createCapricornRuntimeAdapter({
      container: document.createElement('div'),
      createRuntime: harness.createRuntime,
      onChange: vi.fn(),
      options: { markdown: '# Initial' },
    })
    const listener = vi.fn()
    const unsubscribe = adapter.subscribeUiState(listener)
    const initialSnapshot = adapter.getUiState()

    expect(adapter.getUiState()).toBe(initialSnapshot)
    harness.emitUiState({ ...initialSnapshot, canUndo: true })
    expect(adapter.getUiState()).toMatchObject({ canUndo: true })
    expect(listener).toHaveBeenCalledOnce()

    unsubscribe()
  })
})
