import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType, isCapricornView } from '@/constants/editorViewType'
import bus from '@/helper/eventBus'
import useFileCacheStore, { getFileObject, updateFileObject } from '@/helper/files'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import type { CapricornDocumentStatistics } from './capricornRuntimeAdapter'
import { createCapricornStatisticsScheduler } from './capricornStatisticsScheduler'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'
import { FileSaveCoordinator } from './fileSaveCoordinator'
import { EditorSnapshotRegistry } from './editorSnapshotRegistry'
import { runSaveOperation } from './runSaveOperation'
import textEditorSource from './TextEditor.tsx?raw'

// Exercise the actual host callbacks without mounting unrelated native app
// services. Both synchronization and save/export read the production code.
const source = ts.createSourceFile(
  'TextEditor.tsx',
  textEditorSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const expressions = new Map<string, ts.Expression>()
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    node.initializer.expression.getText(source) === 'useCallback'
  ) {
    expressions.set(node.name.getText(source), node.initializer.arguments[0])
  }
  if (ts.isCallExpression(node) && node.arguments[0]) {
    const hook = node.expression.getText(source)
    const body = node.arguments[0].getText(source)
    if (
      hook === 'useLayoutEffect' &&
      body.includes('needsMountedContentSyncRef') &&
      body.includes('queueMicrotask')
    ) {
      expressions.set('reveal', node.arguments[0])
    }
    if (hook === 'useEffect' && body.includes('isUnmountingRef.current = true')) {
      expressions.set('lifecycle', node.arguments[0])
    }
    if (hook === 'useEffect' && body.includes('bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT')) {
      expressions.set('externalContentSync', node.arguments[0])
    }
    if (hook === 'createCapricornStatisticsScheduler') {
      expressions.set('publishStatistics', node.arguments[0])
    }
  }
  ts.forEachChild(node, visit)
}
visit(source)

const externalListenerCleanups: (() => void)[] = []

function callback<T>(name: string, bindings: Record<string, unknown>): T {
  const expression = expressions.get(name)
  expect(expression, name).toBeDefined()
  const compiled = ts.transpileModule(`(${expression!.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return runInNewContext(compiled, bindings) as T
}

function createHarness({
  active = false,
  visible = active,
  wysiwyg = true,
  preview = false,
}: {
  active?: boolean
  visible?: boolean
  wysiwyg?: boolean
  preview?: boolean
} = {}) {
  const state = {
    dirty: true,
    file: {
      id: 'file',
      name: 'file.md',
      kind: 'file' as const,
      path: '/synthetic/file.md',
      content: 'A',
    },
    pending: false,
    runtimeContent: 'A',
    content: 'A',
  }
  const latestContentRef = { current: 'A' }
  const currentViewType = preview
    ? EditorViewType.PREVIEW
    : wysiwyg
      ? EditorViewType.WYSIWYG
      : EditorViewType.SOURCECODE
  useEditorCounterStore.setState({
    editorCounterMap: {
      file: { characterCount: 1, nonWhitespaceCharacterCount: 1, wordCount: 1 },
    },
  })
  useFileCacheStore.setState({
    entries: { file: state.file },
    metadataRevision: 0,
    pathEntries: {},
  })
  const needsMountedContentSyncRef = { current: false }
  const isApplyingRemoteContentRef = { current: false }
  const coordinator = new FileSaveCoordinator()
  coordinator.recordContent('file', 'A')
  coordinator.setDiskRevision('file', 'disk:A')
  const getMarkdown = vi.fn(() => state.runtimeContent)
  const setMarkdown = vi.fn((content: string) => {
    state.runtimeContent = content
  })
  const getStatistics = vi.fn(async (options?: { signal?: AbortSignal }) => {
    void options
    return {
      characterCount: state.runtimeContent.length,
      nonWhitespaceCharacterCount: state.runtimeContent.replace(/\s/g, '').length,
      wordCount: state.runtimeContent.trim().split(/\s+/).filter(Boolean).length,
    }
  })
  let nextHandle = 0
  const frames = new Map<number, FrameRequestCallback>()
  const idles = new Map<number, () => void>()
  const written: string[] = []
  const publisher = {
    hasPending: () => state.pending,
    cancel: vi.fn(() => {
      state.pending = false
    }),
    pause: vi.fn(),
    flush: vi.fn(() => {
      if (state.pending) throw new Error('Unexpected stale runtime publication')
      return true
    }),
  }
  const registry = new EditorSnapshotRegistry()
  const bindings: Record<string, unknown> = {
    active,
    activeRef: { current: active },
    visible,
    visibleRef: { current: visible },
    currentViewType,
    currentViewTypeRef: { current: currentViewType },
    EditorViewType,
    isCapricornView,
    id: 'file',
    instanceIdRef: { current: 'source' },
    editorSnapshotRegistry: registry,
    snapshotDemandHandlerRef: { current: () => {} },
    curFile: state.file,
    content: 'A',
    delegate: null,
    editorRef: { current: null },
    editorContextRef: { current: null },
    capricornEditorRef: { current: { getMarkdown, setMarkdown, isComposing: () => false } },
    capricornRuntimeAdapterRef: { current: { getStatistics } },
    latestContentRef,
    needsMountedContentSyncRef,
    isApplyingRemoteContentRef,
    interactionStartedAtRef: { current: undefined },
    interactionOpenRequestIdRef: { current: undefined },
    remoteContentResetHandleRef: { current: null },
    snapshotPublisher: publisher,
    isUnmountingRef: { current: false },
    setContent: (content: string) => {
      state.content = content
    },
    getFileObject,
    updateFileObject: (_id: string, file: typeof state.file) => {
      updateFileObject(_id, file)
      state.file = getFileObject(_id) as typeof state.file
    },
    updateFile: (file: typeof state.file) => {
      state.file = file
    },
    fileSaveCoordinator: coordinator,
    historyFileSaved: vi.fn(),
    endHistoryBatch: vi.fn().mockResolvedValue(undefined),
    useEditorStateStore: {
      getState: () => ({
        idStateMap: new Map([['file', { hasUnsavedChanges: state.dirty }]]),
        setIdStateMap: (_id: string, value: { hasUnsavedChanges: boolean }) => {
          state.dirty = value.hasUnsavedChanges
        },
      }),
    },
    useEditorStore: {
      getState: () => ({
        getEditorContent: () => {
          registry.flushForRead('file')
          return getFileObject('file')?.content ?? ''
        },
      }),
    },
    useEditorCounterStore,
    bus,
    EXTERNAL_FILE_CONTENT_SYNC_EVENT,
    setStatus: vi.fn(),
    TextEditorStatus: { SUCCESS: 1 },
    window,
    queueMicrotask,
    runSaveOperation,
    isExternalFileSaveBlocked: () => false,
    savePathCoordinator: {},
    runQueuedFileWrite: async ({ write }: { write: (path: string) => Promise<unknown> }) => ({
      status: 'success',
      value: await write(state.file.path),
    }),
    conditionalWriteExpectedIfAllowed: async (_path: string, content: string) => {
      written.push(content)
      return { status: 'success', revision: `disk:${content}` }
    },
    captureException: (error: unknown) => {
      throw error
    },
    toast: {
      error: (message: string) => {
        throw new Error(message)
      },
    },
  }
  bindings.capricornStatisticsScheduler = createCapricornStatisticsScheduler(
    callback('publishStatistics', bindings),
    {
      requestAnimationFrame: (frame) => {
        const handle = ++nextHandle
        frames.set(handle, frame)
        return handle
      },
      cancelAnimationFrame: (handle) => {
        frames.delete(handle)
      },
      requestIdle: (idle) => {
        const handle = ++nextHandle
        idles.set(handle, idle)
        return handle
      },
      cancelIdle: (handle) => {
        idles.delete(handle)
      },
    },
  )
  bindings.setMountedEditorContent = callback('setMountedEditorContent', bindings)
  bindings.updateCachedFileContent = callback('updateCachedFileContent', bindings)
  const sync = callback<(content: string, force?: boolean) => void>('applySyncedContent', bindings)
  bindings.applySyncedContent = sync
  externalListenerCleanups.push(callback<() => () => void>('externalContentSync', bindings)())
  const unmount = callback<() => () => void>('lifecycle', bindings)()
  return {
    state,
    sync,
    setMarkdown,
    getMarkdown,
    getStatistics,
    publisher,
    latestContentRef,
    needsMountedContentSyncRef,
    isApplyingRemoteContentRef,
    written,
    unmount,
    externalSync(content: string) {
      bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, { fileId: 'file', content })
    },
    runStatistics() {
      for (const [handle, frame] of frames) {
        frames.delete(handle)
        frame(performance.now())
      }
      for (const [handle, idle] of idles) {
        idles.delete(handle)
        idle()
      }
    },
    counter: () => useEditorCounterStore.getState().editorCounterMap.file,
    exportContent: callback<() => string>('getExportContent', bindings),
    publishToCache: callback<(content: string) => void>('updateCachedFileContent', bindings),
    getSaveRevision: () => coordinator.getRevision('file'),
    save: callback<(params: { active: boolean }) => Promise<boolean>>('saveHandler', bindings),
    lateCommit: callback<() => void>('handleCapricornChange', bindings),
    reveal(nextActive = true, nextVisible = nextActive) {
      bindings.active = nextActive
      bindings.visible = nextVisible
      ;(bindings.activeRef as { current: boolean }).current = nextActive
      ;(bindings.visibleRef as { current: boolean }).current = nextVisible
      return callback<() => (() => void) | undefined>('reveal', bindings)()
    },
  }
}

afterEach(() => {
  externalListenerCleanups.splice(0).forEach((cleanup) => cleanup())
  vi.useRealTimers()
})

describe('TextEditor statistics after restored or externally loaded content', () => {
  it('updates all counts through the shared external-content listener, including empty content', async () => {
    const harness = createHarness({ active: true })
    harness.state.pending = true
    harness.state.runtimeContent = 'unpublished local edit'

    harness.externalSync('two words\n中')
    expect(harness.setMarkdown).toHaveBeenCalledExactlyOnceWith('two words\n中', 2)
    expect(harness.state.pending).toBe(false)
    harness.runStatistics()
    await vi.waitFor(() =>
      expect(harness.counter()).toEqual({
        characterCount: 11,
        nonWhitespaceCharacterCount: 9,
        wordCount: 3,
      }),
    )
    expect(harness.getStatistics).toHaveBeenCalledOnce()

    harness.externalSync('')
    expect(harness.setMarkdown).toHaveBeenLastCalledWith('', 3)
    harness.runStatistics()
    await vi.waitFor(() =>
      expect(harness.counter()).toEqual({
        characterCount: 0,
        nonWhitespaceCharacterCount: 0,
        wordCount: 0,
      }),
    )
    expect(harness.getStatistics).toHaveBeenCalledTimes(2)
    expect(harness.getMarkdown).not.toHaveBeenCalled()
  })

  it('aborts an in-flight count and ignores its late result after a replacement', async () => {
    const harness = createHarness({ active: true })
    let resolveObsolete!: (statistics: CapricornDocumentStatistics) => void
    const obsolete = new Promise<CapricornDocumentStatistics>((resolve) => {
      resolveObsolete = resolve
    })
    harness.getStatistics.mockReturnValueOnce(obsolete)
    harness.externalSync('A')
    harness.runStatistics()
    await Promise.resolve()
    expect(harness.getStatistics).toHaveBeenCalledOnce()
    const oldSignal = harness.getStatistics.mock.calls[0][0]?.signal
    expect(oldSignal?.aborted).toBe(false)

    harness.externalSync('new content')
    expect(oldSignal?.aborted).toBe(true)
    harness.runStatistics()
    const expected = { characterCount: 11, nonWhitespaceCharacterCount: 10, wordCount: 2 }
    await vi.waitFor(() => expect(harness.counter()).toEqual(expected))
    resolveObsolete({ characterCount: 100, nonWhitespaceCharacterCount: 99, wordCount: 20 })
    await obsolete
    await Promise.resolve()
    expect(harness.counter()).toEqual(expected)
    expect(harness.getMarkdown).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'counts only the latest hidden replacement on active reveal (preview=%s)',
    async (preview) => {
      const harness = createHarness({ preview })
      harness.externalSync('obsolete')
      harness.externalSync('latest 内容')
      harness.runStatistics()
      expect(harness.setMarkdown).not.toHaveBeenCalled()
      expect(harness.getStatistics).not.toHaveBeenCalled()
      expect(harness.counter()).toEqual({
        characterCount: 1,
        nonWhitespaceCharacterCount: 1,
        wordCount: 1,
      })

      harness.reveal()
      await Promise.resolve()
      harness.runStatistics()
      await vi.waitFor(() =>
        expect(harness.counter()).toEqual({
          characterCount: 9,
          nonWhitespaceCharacterCount: 8,
          wordCount: 2,
        }),
      )
      expect(harness.getStatistics).toHaveBeenCalledOnce()
      expect(harness.getMarkdown).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['non-active sibling', { active: false, visible: true }],
    ['hidden active pane', { active: true, visible: false }],
    ['SourceCode', { active: true, wysiwyg: false }],
  ])('does not request Capricorn statistics for %s', async (_name, options) => {
    const harness = createHarness(options)
    harness.externalSync('replacement')
    harness.runStatistics()
    await Promise.resolve()
    expect(harness.setMarkdown).toHaveBeenCalledOnce()
    expect(harness.getStatistics).not.toHaveBeenCalled()
    expect(harness.counter()).toEqual({
      characterCount: 1,
      nonWhitespaceCharacterCount: 1,
      wordCount: 1,
    })
  })
})

describe('TextEditor hidden content synchronization', () => {
  it('publishes each shared snapshot once across source and sibling cache writes', () => {
    const harness = createHarness()
    const listener = vi.fn()
    const unsubscribe = useFileCacheStore.subscribe(listener)
    try {
      for (let index = 1; index <= 20; index += 1) {
        harness.publishToCache(`remote ${index}`)
        const published = useFileCacheStore.getState()
        harness.sync(`remote ${index}`)
        expect(useFileCacheStore.getState()).toBe(published)
      }
      expect(listener).toHaveBeenCalledTimes(20)
      expect(harness.getSaveRevision()).toBe(21)
      expect(harness.state.file.content).toBe('remote 20')
      expect(harness.state.dirty).toBe(true)
      expect(harness.setMarkdown).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })

  it.each([false, true])(
    'coalesces hidden sibling updates before revealing (preview=%s)',
    async (preview) => {
      vi.useFakeTimers()
      const harness = createHarness({ preview })
      for (let index = 1; index <= 20; index += 1) harness.sync(`remote ${index}`)
      vi.runAllTimers()
      expect(harness.setMarkdown).not.toHaveBeenCalled()
      expect(harness.state.content).toBe('remote 20')
      expect(harness.latestContentRef.current).toBe('remote 20')
      expect(harness.isApplyingRemoteContentRef.current).toBe(true)

      // An old commit/blur callback must not publish the hidden runtime's A.
      harness.lateCommit()
      expect(harness.getMarkdown).not.toHaveBeenCalled()
      expect(harness.state.file.content).toBe('remote 20')

      harness.reveal()
      expect(harness.setMarkdown).not.toHaveBeenCalled()
      await Promise.resolve()
      expect(harness.setMarkdown).toHaveBeenCalledExactlyOnceWith('remote 20', 21)
      expect(harness.needsMountedContentSyncRef.current).toBe(false)
      vi.runAllTimers()
      expect(harness.isApplyingRemoteContentRef.current).toBe(false)
      harness.reveal()
      expect(harness.setMarkdown).toHaveBeenCalledOnce()
    },
  )

  it('keeps visible split panes and RME instances synchronized immediately', () => {
    vi.useFakeTimers()
    const split = createHarness({ visible: true })
    split.sync('B')
    expect(split.setMarkdown).toHaveBeenCalledExactlyOnceWith('B', 2)
    expect(split.needsMountedContentSyncRef.current).toBe(false)

    const rme = createHarness({ wysiwyg: false })
    rme.sync('B')
    expect(rme.setMarkdown).toHaveBeenCalledExactlyOnceWith('B', 2)
    expect(rme.needsMountedContentSyncRef.current).toBe(false)
  })

  it('preserves pending local edits but lets forced same-value reloads replace them', async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.state.pending = true
    harness.state.runtimeContent = 'local pending'
    harness.sync('remote')
    expect(harness.latestContentRef.current).toBe('A')
    expect(harness.publisher.cancel).not.toHaveBeenCalled()

    harness.sync('A', true)
    expect(harness.state.pending).toBe(false)
    expect(harness.setMarkdown).not.toHaveBeenCalled()
    harness.reveal(false, true)
    await Promise.resolve()
    expect(harness.setMarkdown).toHaveBeenCalledExactlyOnceWith('A', 1)
  })

  it('cancels a reveal superseded by hiding or unmounting', async () => {
    const harness = createHarness()
    harness.sync('B')
    const cleanup = harness.reveal()
    cleanup?.()
    harness.reveal(false)
    await Promise.resolve()
    expect(harness.setMarkdown).not.toHaveBeenCalled()
    expect(harness.needsMountedContentSyncRef.current).toBe(true)
    const unmountReveal = harness.reveal()
    unmountReveal?.()
    harness.unmount()
    await Promise.resolve()
    expect(harness.setMarkdown).not.toHaveBeenCalled()
  })

  it('saves, exports and unmounts a hidden instance using the latest shared content', async () => {
    const harness = createHarness()
    harness.sync('latest shared content')
    expect(harness.exportContent()).toBe('latest shared content')
    await expect(harness.save({ active: true })).resolves.toBe(true)
    expect(harness.written).toEqual(['latest shared content'])
    expect(harness.state.dirty).toBe(false)
    harness.unmount()
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    expect(harness.setMarkdown).not.toHaveBeenCalled()
    expect(harness.state.file.content).toBe('latest shared content')
  })
})
