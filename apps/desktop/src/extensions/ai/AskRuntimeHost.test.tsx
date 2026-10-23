import {
  AuiProvider,
  ComposerPrimitive,
  ExportedMessageRepository,
  ThreadPrimitive,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from '@assistant-ui/react'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AskRuntimeHost, useAskRuntimeSession } from './AskRuntimeHost'
import type { AskRuntimeSession } from './AskWorkspaceRuntime'
import { TauriAskThreadHistoryAdapter } from './askHistory'

const mocks = vi.hoisted(() => ({
  workspace: '/workspace/a',
  createModel: vi.fn(),
  run: vi.fn<(options: ChatModelRunOptions) => AsyncGenerator<ChatModelRunResult>>(),
  confirm: vi.fn(),
  store: new Map<string, unknown>(),
}))

vi.mock('@/stores/useEditorStore', () => ({
  default: (select: (state: { folderData: { path: string }[] }) => unknown) =>
    select({ folderData: [{ path: mocks.workspace }] }),
}))
vi.mock('@/commands', () => ({ commandRegistry: { execute: vi.fn() } }))
vi.mock('@/helper/files', () => ({ getFileObject: vi.fn() }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm, info: vi.fn() } }))
vi.mock('@/services/editor-file', () => ({ addNewMarkdownFileEdit: vi.fn() }))
vi.mock('./aiModelPreference', () => ({ setPreferredAIModelKey: vi.fn() }))
vi.mock('./askModelAdapter', () => ({
  createAskModelAdapter: () => {
    mocks.createModel()
    return { run: mocks.run }
  },
}))
vi.mock('./useAskModelCatalog', () => ({
  useAskModelCatalog: () => ({
    selectedModelKey: 'openai:test',
    selectedModel: { key: 'openai:test', status: 'ready' },
  }),
}))
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async get(key: string) { return mocks.store.get(key) }
    async set(key: string, value: unknown) { mocks.store.set(key, structuredClone(value)) }
    async save() {}
  },
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => { reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true })
afterAll(() => { delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('Ask runtime ownership', () => {
  let root: Root
  let container: HTMLDivElement
  let session: AskRuntimeSession | undefined
  let siblingMounts: number
  let runSignal: AbortSignal | undefined
  let finishRun: ReturnType<typeof deferred<void>>

  function StableSibling() {
    useEffect(() => { siblingMounts += 1 }, [])
    return <div>editor</div>
  }

  function Panel() {
    const current = useAskRuntimeSession()
    session = current
    if (!current) return null
    return (
      <AuiProvider value={current.aui}>
        <ThreadPrimitive.ViewportProvider>
          <ComposerPrimitive.Root onSubmit={current.handleComposerSubmit}>
            <ComposerPrimitive.Input data-testid='draft' />
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportProvider>
      </AuiProvider>
    )
  }

  async function render(side?: 'left' | 'right') {
    await act(async () => {
      root.render(
        <AskRuntimeHost>
          <StableSibling />
          <section data-side='left'>{side === 'left' ? <Panel /> : null}</section>
          <section data-side='right'>{side === 'right' ? <Panel /> : null}</section>
        </AskRuntimeHost>,
      )
      if (side) await import('./AskWorkspaceRuntime')
    })
  }

  async function open() {
    await render('right')
    await vi.waitFor(async () => {
      await act(async () => { await Promise.resolve() })
      expect(session).toBeDefined()
      expect(session!.runtime.thread.getState().isLoading).toBe(false)
    })
    return session!
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workspace = '/workspace/a'
    mocks.store.clear()
    localStorage.clear()
    session = undefined
    siblingMounts = 0
    runSignal = undefined
    finishRun = deferred<void>()
    mocks.run.mockImplementation(async function* ({ abortSignal }) {
      runSignal = abortSignal
      yield { content: [{ type: 'text', text: 'partial' }] }
      await Promise.race([
        finishRun.promise,
        new Promise<void>((resolve) => abortSignal.addEventListener('abort', () => resolve(), { once: true })),
      ])
      if (!abortSignal.aborted) {
        yield { content: [{ type: 'text', text: 'complete' }], status: { type: 'complete', reason: 'stop' } }
      }
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('starts lazily and retains the draft and editor attachments when the view moves or hides', async () => {
    await render()
    expect(mocks.createModel).not.toHaveBeenCalled()
    const first = await open()
    const reference = { id: 'note', name: 'note.md', path: '/workspace/a/note.md' }
    await act(async () => {
      first.runtime.thread.composer.setText('unfinished question')
      await first.runtime.thread.composer.addAttachment(first.attachmentAdapter.createFile(reference))
    })
    const attachmentId = first.runtime.thread.composer.getState().attachments[0].id

    await render('left')
    expect(session!.runtime).toBe(first.runtime)
    expect((container.querySelector('[data-testid=draft]') as HTMLTextAreaElement).value).toBe('unfinished question')
    await render()
    await render('right')
    expect(session!.runtime).toBe(first.runtime)
    expect(first.runtime.thread.composer.getState().attachments).toHaveLength(1)
    expect(session!.attachmentAdapter.getReference(attachmentId)).toEqual(reference)
    expect(mocks.createModel).toHaveBeenCalledTimes(1)
    expect(siblingMounts).toBe(1)
  })

  it('continues an active response while the view moves and while it is absent', async () => {
    const first = await open()
    await act(async () => first.runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'question' }] }))
    expect(runSignal?.aborted).toBe(false)
    await render('left')
    await render()
    expect(runSignal?.aborted).toBe(false)
    await act(async () => finishRun.resolve())
    await render('right')
    expect(session!.runtime).toBe(first.runtime)
    expect(session!.runtime.thread.getState().messages.at(-1)?.content).toEqual([{ type: 'text', text: 'complete' }])
    expect(mocks.run).toHaveBeenCalledTimes(1)
  })

  it('finishes attachment preparation after view remount without dropping or sending the draft twice', async () => {
    const first = await open()
    const prepared = deferred<{ ok: true }>()
    vi.spyOn(first.attachmentAdapter, 'prepare').mockReturnValue(prepared.promise)
    await act(async () => first.runtime.thread.composer.setText('send after preparing'))
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(session!.isPreparing).toBe(true)
    await render('left')
    expect(session!.isPreparing).toBe(true)
    await render()
    await act(async () => prepared.resolve({ ok: true }))
    await render('right')
    expect(session!.isPreparing).toBe(false)
    expect(mocks.run).toHaveBeenCalledTimes(1)
    expect(session!.runtime.thread.getState().messages[0].content).toEqual([{ type: 'text', text: 'send after preparing' }])
  })

  it('finishes an in-flight history mutation after the view moves', async () => {
    const first = await open()
    await act(async () => {
      first.runtime.thread.import(ExportedMessageRepository.fromArray([
        { id: 'user', role: 'user', content: 'question' },
        { id: 'assistant', role: 'assistant', content: 'answer' },
      ]))
    })
    const deleted = deferred<void>()
    vi.spyOn(TauriAskThreadHistoryAdapter.prototype, 'delete').mockReturnValue(deleted.promise)
    await act(async () => first.handleDeleteTurn('assistant'))
    await render('left')
    expect(session!.isMutatingHistory).toBe(true)
    await act(async () => deleted.resolve())
    expect(session!.isMutatingHistory).toBe(false)
    expect(session!.runtime.thread.getState().messages).toEqual([])
  })

  it('cancels the old workspace run and creates a clean session when the workspace changes', async () => {
    const first = await open()
    await act(async () => first.runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'question' }] }))
    const previousSignal = runSignal
    await act(async () => first.runtime.thread.composer.setText('old workspace draft'))
    mocks.workspace = '/workspace/b'
    await render('right')
    expect(previousSignal?.aborted).toBe(true)
    expect(session!.runtime).not.toBe(first.runtime)
    expect(session!.runtime.thread.composer.getState().text).toBe('')
    expect(mocks.createModel).toHaveBeenCalledTimes(2)
  })

  it('invalidates pending preparation when the workspace host is destroyed', async () => {
    const first = await open()
    const prepared = deferred<{ ok: true }>()
    vi.spyOn(first.attachmentAdapter, 'prepare').mockReturnValue(prepared.promise)
    const reset = vi.spyOn(first.attachmentAdapter, 'reset')
    await act(async () => first.runtime.thread.composer.setText('do not send'))
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => root.render(null))
    await act(async () => prepared.resolve({ ok: true }))
    expect(reset).toHaveBeenCalledOnce()
    expect(mocks.run).not.toHaveBeenCalled()
  })
})
