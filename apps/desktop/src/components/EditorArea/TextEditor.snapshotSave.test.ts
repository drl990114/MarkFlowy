import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { debounce } from 'lodash'
import { EditorViewType } from '@/constants/editorViewType'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'
import { getEditorSnapshotTiming } from './editorSnapshotTiming'
import type { CapricornEditorChangeEvent } from './capricornRuntimeAdapter'
import { FileSaveCoordinator } from './fileSaveCoordinator'
import { EditorSnapshotRegistry } from './editorSnapshotRegistry'
import { runSaveOperation } from './runSaveOperation'
import textEditorSource from './TextEditor.tsx?raw'

// Run the actual host callbacks with its shared save/publisher helpers while
// keeping native file dialogs and disk writes outside this regression test.
const source = ts.createSourceFile(
  'TextEditor.tsx',
  textEditorSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const callbacks = new Map<string, ts.Expression>()
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    ['useCallback', 'useMemo'].includes(node.initializer.expression.getText(source))
  ) {
    callbacks.set(node.name.getText(source), node.initializer.arguments[0])
  }
  if (
    ts.isBinaryExpression(node) &&
    node.left.getText(source) === 'publishEditorSnapshotRef.current'
  ) {
    callbacks.set('publish', node.right)
  }
  if (
    ts.isBinaryExpression(node) &&
    node.left.getText(source) === 'snapshotDemandHandlerRef.current'
  ) {
    callbacks.set('demand', node.right)
  }
  ts.forEachChild(node, visit)
}
visit(source)

function getCallback<T>(name: string, bindings: Record<string, unknown>): T {
  const expression = callbacks.get(name)
  expect(expression, name).toBeDefined()
  const compiled = ts.transpileModule(`(${expression!.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return runInNewContext(compiled, bindings) as T
}

function createHarness(initialContent = 'A', visibleSibling = false) {
  const state = {
    file: { id: 'file', path: '/synthetic/file.md', content: initialContent },
    dirty: true,
    editorContent: initialContent,
    composing: false,
  }
  const coordinator = new FileSaveCoordinator()
  const registry = new EditorSnapshotRegistry()
  coordinator.recordContent('file', initialContent)
  coordinator.setDiskRevision('file', 'disk:A')
  const written: string[] = []
  let finishFirstWrite: (() => void) | undefined
  const autosave = vi.fn()
  const getMarkdown = vi.fn(() => state.editorContent)
  const capricornStatisticsScheduler = { cancel: vi.fn(), schedule: vi.fn() }
  const capricornRuntimeAdapter = {}
  const bindings: Record<string, unknown> = {
    groupId: 'group',
    id: 'file',
    EditorViewType,
    currentViewType: EditorViewType.WYSIWYG,
    active: true,
    curFile: state.file,
    delegate: null,
    runSaveOperation,
    getFileObject: () => state.file,
    useEditorStateStore: {
      getState: () => ({
        idStateMap: new Map([['file', { hasUnsavedChanges: state.dirty }]]),
        setIdStateMap: (_id: string, update: { hasUnsavedChanges: boolean }) => {
          state.dirty = update.hasUnsavedChanges
        },
      }),
    },
    fileSaveCoordinator: coordinator,
    savePathCoordinator: {},
    isExternalFileSaveBlocked: () => false,
    editorContextRef: { current: null },
    editorSnapshotRegistry: registry,
    instanceIdRef: { current: 'source' },
    hasVisibleSiblingRef: { current: visibleSibling },
    compositionDirtyRef: { current: null },
    runQueuedFileWrite: async ({ write }: { write: (path: string) => Promise<unknown> }) => ({
      status: 'success',
      value: await write(state.file.path),
    }),
    conditionalWriteExpectedIfAllowed: async (_path: string, content: string) => {
      written.push(content)
      if (written.length === 1) {
        await new Promise<void>((resolve) => {
          finishFirstWrite = resolve
        })
      }
      return { status: 'success', revision: `disk:${content}` }
    },
    latestContentRef: { current: initialContent },
    setContent: vi.fn(),
    updateFileObject: (_id: string, value: typeof state.file) => {
      state.file = value
    },
    updateFile: (value: typeof state.file) => {
      state.file = value
    },
    captureException: vi.fn(),
    toast: {
      error: (message: string) => {
        throw new Error(message)
      },
    },
    measureEditorSnapshot: (_id: string, _size: number, _mode: string, serialize: () => string) =>
      serialize(),
    isUnmountingRef: { current: false },
    emitContentSync: vi.fn(),
    activeRef: { current: true },
    autosave: true,
    debounceSaveHandler: autosave,
    debounceSave: { cancel: vi.fn() },
    isApplyingRemoteContentRef: { current: false },
    savePathReserved: false,
    externalChangeResolving: false,
    capricornEditorRef: { current: { getMarkdown, isComposing: () => state.composing } },
    capricornRuntimeAdapterRef: { current: capricornRuntimeAdapter },
    capricornStatisticsScheduler,
    recordEditorInteractionMeasurement: vi.fn(),
    interactionStartedAtRef: { current: undefined },
    interactionOpenRequestIdRef: { current: undefined },
  }
  bindings.updateCachedFileContent = getCallback('updateCachedFileContent', bindings)
  bindings.createDeferredLatestPublisher = createDeferredLatestPublisher
  bindings.getEditorSnapshotTiming = getEditorSnapshotTiming
  bindings.publishEditorSnapshotRef = {
    current: getCallback<(snapshot: unknown) => boolean>('publish', bindings),
  }
  const publisher = getCallback<() => ReturnType<typeof createDeferredLatestPublisher>>(
    'snapshotPublisher',
    bindings,
  )()
  bindings.snapshotPublisher = publisher
  registry.register('file', 'source', {
    canRead: () => !state.composing,
    flush: publisher.flush,
    hasPending: publisher.hasPending,
    isVisible: () => true,
    onSyncDemandChanged: () => {},
  })
  return {
    state,
    written,
    autosave,
    capricornStatisticsScheduler,
    publisher,
    getMarkdown,
    registry,
    coordinator,
    addVisibleSibling() {
      const sibling = { content: initialContent, composing: false }
      const siblingRead = vi.fn(() => sibling.content)
      const siblingBindings: Record<string, unknown> = {
        ...bindings,
        instanceIdRef: { current: 'sibling' },
        hasVisibleSiblingRef: { current: true },
        compositionDirtyRef: { current: null },
        latestContentRef: { current: initialContent },
        capricornEditorRef: {
          current: { getMarkdown: siblingRead, isComposing: () => sibling.composing },
        },
      }
      siblingBindings.publishEditorSnapshotRef = {
        current: getCallback('publish', siblingBindings),
      }
      const siblingPublisher = getCallback<() => ReturnType<typeof createDeferredLatestPublisher>>(
        'snapshotPublisher',
        siblingBindings,
      )()
      siblingBindings.snapshotPublisher = siblingPublisher
      registry.register('file', 'source', {
        canRead: () => !state.composing,
        flush: publisher.flush,
        hasPending: publisher.hasPending,
        isVisible: () => true,
        onSyncDemandChanged: getCallback('demand', bindings),
      })
      registry.register('file', 'sibling', {
        canRead: () => !sibling.composing,
        flush: siblingPublisher.flush,
        hasPending: siblingPublisher.hasPending,
        isVisible: () => true,
        onSyncDemandChanged: getCallback('demand', siblingBindings),
      })
      return {
        read: siblingRead,
        change(event: CapricornEditorChangeEvent) {
          if (event.composing !== undefined) sibling.composing = event.composing
          getCallback<(event: CapricornEditorChangeEvent) => void>(
            'handleCapricornChange',
            siblingBindings,
          )(event)
        },
      }
    },
    setAutosave(enabled: boolean) {
      bindings.autosave = enabled
    },
    setAutosaveScheduler(schedule: () => void, cancel: () => void) {
      bindings.debounceSaveHandler = schedule
      bindings.debounceSave = { cancel }
    },
    read() {
      registry.flushForRead('file')
      return state.file.content
    },
    save: getCallback<(params?: { onSuccess?: () => void }) => Promise<boolean>>(
      'saveHandler',
      bindings,
    ),
    change(content: string, event?: CapricornEditorChangeEvent) {
      state.editorContent = content
      if (event?.composing !== undefined) state.composing = event.composing
      getCallback<(change?: CapricornEditorChangeEvent) => void>(
        'handleCapricornChange',
        bindings,
      )(event)
    },
    finishFirstWrite: () => {
      expect(finishFirstWrite).toBeDefined()
      finishFirstWrite!()
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('TextEditor deferred snapshots during saving', () => {
  it('does not let obsolete runtime progress replace the pane current open request', () => {
    const beginEditorOpenMeasurement = vi.fn(() => 'obsolete-request')
    const recordEditorOpenStage = vi.fn()
    const handleProgress = getCallback<
      (
        progress: { stage: 'parse'; elapsedMs: number },
        identity: { contentRevision: number; runtimeRequestSequence: number },
      ) => void
    >('handleCapricornOpenProgress', {
      beginEditorOpenMeasurement,
      capricornRuntimeEntrySha256: 'sha',
      capricornRuntimeVersion: 'version',
      EditorViewType,
      fileSaveCoordinator: { getRevision: () => 1 },
      getEditorOpenMeasurement: () => undefined,
      groupId: 'group',
      id: 'obsolete-file',
      latestContentRef: { current: 'old' },
      recordEditorOpenContent: vi.fn(),
      recordEditorOpenStage,
    })

    handleProgress(
      { stage: 'parse', elapsedMs: 12 },
      { contentRevision: 1, runtimeRequestSequence: 2 },
    )
    handleProgress(
      { stage: 'parse', elapsedMs: 20 },
      { contentRevision: 0, runtimeRequestSequence: 1 },
    )

    expect(beginEditorOpenMeasurement).not.toHaveBeenCalled()
    expect(recordEditorOpenStage).toHaveBeenCalledWith(
      undefined,
      'parse',
      expect.objectContaining({ contentRevision: 1, runtimeElapsedMs: 12 }),
    )
    expect(recordEditorOpenStage).toHaveBeenCalledOnce()
  })

  it('requests post-paint Capricorn statistics only for document changes', () => {
    const harness = createHarness()

    harness.change('B', { documentChanged: true, pending: true })
    harness.change('B', { documentChanged: false })

    expect(harness.capricornStatisticsScheduler.schedule).toHaveBeenCalledOnce()
  })

  it('coalesces repeated large-document commits while publishing at the maximum wait', () => {
    vi.useFakeTimers()
    const content = 'x'.repeat(2 * 1024 * 1024)
    const harness = createHarness(content, true)
    for (let index = 0; index < 20; index += 1) {
      harness.change(`${content}\n${index}`, { documentChanged: true })
      vi.advanceTimersByTime(100)
    }
    expect(harness.getMarkdown).toHaveBeenCalledTimes(2)
    expect(harness.state.file.content).toBe(`${content}\n19`)
    expect(harness.autosave).toHaveBeenCalledTimes(20)
    expect(harness.publisher.hasPending()).toBe(false)
  })

  it('bounds large-document publication across repeated native pending/commit pairs', () => {
    vi.useFakeTimers()
    const content = 'x'.repeat(2 * 1024 * 1024)
    const harness = createHarness(content, true)
    for (let index = 0; index < 20; index += 1) {
      harness.change(`${content}\n${index}`, { documentChanged: true, pending: true })
      harness.change(`${content}\n${index}`, { documentChanged: false })
      vi.advanceTimersByTime(100)
    }
    expect(harness.getMarkdown).toHaveBeenCalledTimes(2)
    expect(harness.state.file.content).toBe(`${content}\n19`)
    expect(harness.autosave).toHaveBeenCalledTimes(40)
    expect(harness.publisher.hasPending()).toBe(false)
  })

  it('saves the latest large-document edit immediately without waiting for publication', async () => {
    vi.useFakeTimers()
    const content = 'x'.repeat(2 * 1024 * 1024)
    const harness = createHarness(content)
    harness.change(`${content}\nlatest`, { documentChanged: true })
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    const saving = harness.save()
    await Promise.resolve()
    harness.finishFirstWrite()
    await expect(saving).resolves.toBe(true)
    expect(harness.written).toEqual([`${content}\nlatest`])
    vi.advanceTimersByTime(1000)
    expect(harness.getMarkdown).toHaveBeenCalledOnce()
    expect(harness.state.dirty).toBe(false)
  })

  it('saves the first native character before the runtime commit and remains clean afterward', async () => {
    vi.useFakeTimers()
    const harness = createHarness('A', true)
    harness.state.dirty = false
    harness.change('B', { documentChanged: true, pending: true })
    expect(harness.state.dirty).toBe(true)
    expect(harness.publisher.hasPending()).toBe(true)
    expect(harness.getMarkdown).not.toHaveBeenCalled()

    const saving = harness.save()
    await Promise.resolve()
    harness.finishFirstWrite()
    await expect(saving).resolves.toBe(true)
    expect(harness.written).toEqual(['B'])
    expect(harness.state.dirty).toBe(false)

    harness.change('B', { documentChanged: false })
    vi.advanceTimersByTime(50)
    expect(harness.state.dirty).toBe(false)
    await expect(harness.save()).resolves.toBe(true)
    expect(harness.written).toEqual(['B'])
  })

  it('does not serialize consecutive pending keystrokes at the host debounce or maximum wait', () => {
    vi.useFakeTimers()
    const harness = createHarness('A', true)
    for (let index = 0; index < 20; index += 1) {
      harness.change(`B${index}`, { documentChanged: true, pending: true })
      vi.advanceTimersByTime(120)
    }
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    expect(harness.autosave).toHaveBeenCalledTimes(20)
    expect(harness.publisher.hasPending()).toBe(true)
    harness.change('B19', { documentChanged: false })
    vi.advanceTimersByTime(50)
    expect(harness.getMarkdown).toHaveBeenCalledOnce()
    expect(harness.state.file.content).toBe('B19')
    expect(harness.autosave).toHaveBeenCalledTimes(21)
  })

  it('keeps a new unpublished edit dirty and does not report the older write as complete', async () => {
    vi.useFakeTimers()
    const harness = createHarness('A', true)
    const onSuccess = vi.fn()
    const saving = harness.save({ onSuccess })
    await Promise.resolve()
    harness.change('B', { documentChanged: true, pending: true })
    harness.finishFirstWrite()

    await expect(saving).resolves.toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(harness.state.dirty).toBe(true)
    expect(harness.publisher.hasPending()).toBe(true)

    harness.change('B', { documentChanged: false })
    vi.advanceTimersByTime(50)
    expect(harness.state.file.content).toBe('B')
    expect(harness.state.dirty).toBe(true)
    expect(harness.autosave).toHaveBeenCalledTimes(2)
    await expect(harness.save({ onSuccess })).resolves.toBe(true)
    expect(harness.written).toEqual(['A', 'B'])
    expect(harness.state.dirty).toBe(false)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('retries the existing save when the newer edit is already published', async () => {
    vi.useFakeTimers()
    const harness = createHarness('A', true)
    const onSuccess = vi.fn()
    const saving = harness.save({ onSuccess })
    await Promise.resolve()
    harness.change('B')
    vi.advanceTimersByTime(50)
    harness.finishFirstWrite()

    await expect(saving).resolves.toBe(true)
    expect(harness.written).toEqual(['A', 'B'])
    expect(harness.state.file.content).toBe('B')
    expect(harness.state.dirty).toBe(false)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('flushes the latest pending snapshot before an explicit save begins', async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.change('B')
    const saving = harness.save()
    await Promise.resolve()
    harness.finishFirstWrite()

    await expect(saving).resolves.toBe(true)
    expect(harness.written).toEqual(['B'])
    expect(harness.getMarkdown).toHaveBeenCalledOnce()
    expect(harness.state.dirty).toBe(false)
    expect(harness.publisher.hasPending()).toBe(false)
  })

  it('does no full-document reads during large-document input without consumers', () => {
    vi.useFakeTimers()
    const content = 'x'.repeat(2 * 1024 * 1024)
    const harness = createHarness(content)
    harness.setAutosave(false)
    for (let index = 0; index < 20; index += 1) {
      harness.change(`${content}\n中文 ${index}`, { documentChanged: true, pending: true })
      harness.change(`${content}\n中文 ${index}`, { documentChanged: false })
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(10_000)
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    expect(harness.autosave).not.toHaveBeenCalled()
    expect(harness.state.dirty).toBe(true)
    expect(harness.read()).toBe(`${content}\n中文 19`)
    expect(harness.getMarkdown).toHaveBeenCalledOnce()
  })

  it('keeps a failed deferred read pending instead of returning the previous shared cache', () => {
    const harness = createHarness()
    harness.change('最新中文')
    harness.getMarkdown.mockImplementationOnce(() => {
      throw new Error('read failed')
    })
    expect(() => harness.read()).toThrow('Could not read the latest editor content')
    expect(harness.publisher.hasPending()).toBe(true)
    expect(harness.state.file.content).toBe('A')
    expect(harness.read()).toBe('最新中文')
    expect(harness.publisher.hasPending()).toBe(false)
  })

  it('blocks saving and reading a clean file while composing, and restores clean on cancellation', async () => {
    const harness = createHarness()
    harness.state.dirty = false
    harness.change('A', { composing: true, documentChanged: false, pending: true })
    expect(harness.state.dirty).toBe(true)
    await expect(harness.save()).resolves.toBe(false)
    expect(() => harness.read()).toThrow('Finish composing')
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    harness.change('A', { composing: false, documentChanged: false })
    expect(harness.state.dirty).toBe(false)
    expect(harness.publisher.hasPending()).toBe(false)
    expect(harness.autosave).not.toHaveBeenCalled()
    expect(harness.written).toEqual([])
  })

  it('does not clear a sibling publication when a previously clean composition is canceled', () => {
    const harness = createHarness()
    harness.state.dirty = false
    harness.change('A', { composing: true, documentChanged: false, pending: true })
    harness.coordinator.recordContent('file', 'sibling real edit')
    harness.state.file.content = 'sibling real edit'
    harness.change('A', { composing: false, documentChanged: false })
    expect(harness.state.dirty).toBe(true)
    expect(harness.publisher.hasPending()).toBe(false)
    expect(harness.state.file.content).toBe('sibling real edit')
    expect(harness.getMarkdown).not.toHaveBeenCalled()
  })

  it('resumes the real author after another visible instance composes and cancels its old draft', () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.change('A 的真实新稿', { documentChanged: true, pending: true })
    const sibling = harness.addVisibleSibling()
    sibling.change({ composing: true, documentChanged: false, pending: true })
    vi.advanceTimersByTime(2000)
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    expect(sibling.read).not.toHaveBeenCalled()
    sibling.change({ composing: false, documentChanged: false })
    vi.advanceTimersByTime(1000)
    expect(harness.state.file.content).toBe('A 的真实新稿')
    expect(harness.state.dirty).toBe(true)
    expect(harness.getMarkdown).toHaveBeenCalledOnce()
    expect(sibling.read).not.toHaveBeenCalled()
    expect(harness.registry.hasPending('file')).toBe(false)
  })

  it('does not complete an older write after new Chinese composition starts', async () => {
    const harness = createHarness()
    const onSuccess = vi.fn()
    const saving = harness.save({ onSuccess })
    await Promise.resolve()
    harness.change('A', { composing: true, documentChanged: false, pending: true })
    harness.finishFirstWrite()
    await expect(saving).resolves.toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(harness.state.dirty).toBe(true)
    harness.change('A中文', { composing: true, documentChanged: true, pending: true })
    expect(harness.getMarkdown).not.toHaveBeenCalled()
    harness.change('A中文', { composing: false, documentChanged: false })
    await expect(harness.save({ onSuccess })).resolves.toBe(true)
    expect(harness.written).toEqual(['A', 'A中文'])
    expect(harness.state.dirty).toBe(false)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('restarts autosave after a read followed by composition cancellation', async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    let saving: Promise<boolean> | undefined
    const autosave = debounce(() => {
      saving = harness.save()
    }, 1000)
    harness.setAutosaveScheduler(autosave, autosave.cancel)
    harness.change('A中文', { documentChanged: true })
    expect(harness.read()).toBe('A中文')
    harness.change('A中文', { composing: true, documentChanged: false, pending: true })
    vi.advanceTimersByTime(2000)
    expect(harness.written).toEqual([])
    harness.change('A中文', { composing: false, documentChanged: false })
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
    harness.finishFirstWrite()
    await expect(saving).resolves.toBe(true)
    expect(harness.written).toEqual(['A中文'])
    expect(harness.state.dirty).toBe(false)
  })
})
