import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventCallback, Options } from '@tauri-apps/api/event'
import { SavePathCoordinator, savePathCoordinator } from '@/components/EditorArea/savePathCoordinator'
import { listenForUpdateSession, withPreservedUpdateSession } from './update-session'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), emitTo: vi.fn(), listen: vi.fn(), getAllWindows: vi.fn(), stop: vi.fn(),
  getEditorContent: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ emitTo: mocks.emitTo, listen: mocks.listen }))
vi.mock('@tauri-apps/api/window', () => ({ getAllWindows: mocks.getAllWindows }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ opened: ['document'], getEditorContent: mocks.getEditorContent }) },
}))

const REQUEST = 'mf-update-session-request'
const RESPONSE = 'mf-update-session-response'
const RELEASE = 'mf-update-session-release'
const HEARTBEAT = 'mf-update-session-heartbeat'
const disposers: (() => void)[] = []
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((finish) => { resolve = finish })
  return { promise, resolve }
}
function receive(event: string, payload: object): Promise<void> {
  const callback = mocks.listen.mock.calls.find(([name]) => name === event)?.[1]
  if (!callback) throw new Error(`No listener for ${event}`)
  return callback({ payload })
}
function request(id = 'request') {
  return { id, replyTo: 'main', expiresAt: Date.now() + 30_000 }
}
async function requestsSent() {
  await vi.waitFor(() => expect(mocks.emitTo.mock.calls.filter(([, event]) => event === REQUEST)).toHaveLength(2))
  return mocks.emitTo.mock.calls.find(([, event]) => event === REQUEST)![2]
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getAllWindows.mockResolvedValue([{ label: 'main' }, { label: 'main_two' }, { label: 'settings' }])
  mocks.listen.mockResolvedValue(mocks.stop)
  mocks.emitTo.mockResolvedValue(undefined)
})
afterEach(async () => {
  disposers.splice(0).forEach((dispose) => dispose())
  await Promise.resolve()
  vi.useRealTimers()
})

describe('update session coordinator', () => {
  it('routes requests to each window once with Tauri global-listener semantics', async () => {
    const listeners = new Set<{ event: string; callback: EventCallback<object>; options?: Options }>()
    const handlers: Promise<void>[] = []
    mocks.listen.mockImplementation(async (event: string, callback: EventCallback<object>, options?: Options) => {
      const listener = { event, callback, options }
      listeners.add(listener)
      return () => listeners.delete(listener)
    })
    mocks.emitTo.mockImplementation(async (label: string, event: string, payload: object) => {
      for (const listener of listeners) {
        const target = listener.options?.target
        // Tauri's default Any listeners receive emitTo events for every window.
        const matchesTarget = !target || (typeof target === 'string'
          ? target === label
          : target.kind === 'Any' || ('label' in target && target.label === label))
        if (listener.event === event && matchesTarget) {
          handlers.push(Promise.resolve(listener.callback({ event, id: 0, payload })))
        }
      }
    })
    // Each real webview has its own module instance and file-mutation queue.
    const coordinators: SavePathCoordinator[] = []
    const exclusive = vi.spyOn(savePathCoordinator, 'runExclusive').mockImplementation((queue, owner, operation) => {
      const coordinator = new SavePathCoordinator()
      coordinators.push(coordinator)
      return coordinator.runExclusive(queue, owner, operation)
    })
    const prepare = vi.fn(async () => {})
    const flush = vi.fn(async () => {})
    for (const label of ['main', 'main_two']) {
      disposers.push(await listenForUpdateSession(label, { prepare, flush }))
    }
    const operation = vi.fn(async () => {
      expect(coordinators).toHaveLength(2)
      expect(coordinators.every((coordinator) => coordinator.isFileReserved('document'))).toBe(true)
      return 'installed'
    })
    try {
      await expect(withPreservedUpdateSession('main', operation)).resolves.toBe('installed')
      await Promise.all(handlers)
      expect(prepare).toHaveBeenCalledTimes(2)
      expect(flush).toHaveBeenCalledTimes(2)
      expect(operation).toHaveBeenCalledOnce()
      expect(coordinators.every((coordinator) => !coordinator.isFileReserved('document'))).toBe(true)
      expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RESPONSE))
        .toEqual([
          ['main', RESPONSE, { id: expect.any(String), label: 'main' }],
          ['main', RESPONSE, { id: expect.any(String), label: 'main_two' }],
        ])
    } finally {
      disposers.splice(0).forEach((dispose) => dispose())
      await Promise.all(handlers)
      exclusive.mockRestore()
    }
  })

  it('holds every editor until all have saved and the installation finishes', async () => {
    const installed = deferred()
    const operation = vi.fn(() => installed.promise)
    const saving = withPreservedUpdateSession('main', operation)
    const { id } = await requestsSent()
    receive(RESPONSE, { id: 'old', label: 'main' })
    receive(RESPONSE, { id, label: 'settings' })
    receive(RESPONSE, { id, label: 'main' })
    expect(mocks.invoke).not.toHaveBeenCalled()
    receive(RESPONSE, { id, label: 'main_two' })
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce())
    expect(mocks.invoke).toHaveBeenCalledWith('preserve_update_session', { id, labels: ['main', 'main_two'] })
    expect(mocks.emitTo.mock.calls.some(([, event]) => event === RELEASE)).toBe(false)
    installed.resolve()
    await saving
    expect(mocks.invoke).toHaveBeenLastCalledWith('release_update_session', { id })
    expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RELEASE).map(([label]) => label))
      .toEqual(['main', 'main_two'])
    expect(mocks.stop).toHaveBeenCalledOnce()
  })

  it('releases all requested windows when one flush fails', async () => {
    const operation = vi.fn()
    const saving = withPreservedUpdateSession('main', operation)
    const rejected = expect(saving).rejects.toThrow('disk full')
    const { id } = await requestsSent()
    receive(RESPONSE, { id, label: 'main_two', error: 'disk full' })
    await rejected
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(operation).not.toHaveBeenCalled()
    expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RELEASE)).toHaveLength(2)
  })

  it.each(['manifest', 'install'])('releases held editors if %s fails', async (failure) => {
    const operation = vi.fn(async () => {
      if (failure === 'install') throw new Error('install failed')
    })
    mocks.invoke.mockImplementation(async (command) => {
      if (failure === 'manifest' && command === 'preserve_update_session') throw new Error('manifest failed')
    })
    const saving = withPreservedUpdateSession('main', operation)
    const rejected = expect(saving).rejects.toThrow(`${failure} failed`)
    const { id } = await requestsSent()
    receive(RESPONSE, { id, label: 'main' })
    receive(RESPONSE, { id, label: 'main_two' })
    await rejected
    expect(mocks.invoke).toHaveBeenLastCalledWith('release_update_session', { id })
    expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RELEASE)).toHaveLength(2)
  })

  it('holds renderer barriers until the native window guard is released', async () => {
    const releasing = deferred()
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'release_update_session') await releasing.promise
    })
    const operation = vi.fn(async () => {})
    const saving = withPreservedUpdateSession('main', operation)
    const { id } = await requestsSent()
    receive(RESPONSE, { id, label: 'main' })
    receive(RESPONSE, { id, label: 'main_two' })
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('release_update_session', { id }))
    expect(operation).toHaveBeenCalledOnce()
    expect(mocks.emitTo.mock.calls.some(([, event]) => event === RELEASE)).toBe(false)
    releasing.resolve()
    await saving
    expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RELEASE)).toHaveLength(2)
  })

  it('still releases renderer barriers if native guard release fails', async () => {
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'release_update_session') throw new Error('release failed')
    })
    const saving = withPreservedUpdateSession('main', async () => {})
    const rejected = expect(saving).rejects.toThrow('release failed')
    const { id } = await requestsSent()
    receive(RESPONSE, { id, label: 'main' })
    receive(RESPONSE, { id, label: 'main_two' })
    await rejected
    expect(mocks.emitTo.mock.calls.filter(([, event]) => event === RELEASE)).toHaveLength(2)
    expect(mocks.stop).toHaveBeenCalledOnce()
  })

  it('does not send late requests after listener registration times out', async () => {
    vi.useFakeTimers()
    const registration = deferred()
    mocks.listen.mockImplementation(() => registration.promise.then(() => mocks.stop))
    const operation = vi.fn()
    const saving = withPreservedUpdateSession('main', operation)
    const rejected = expect(saving).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
    registration.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.emitTo.mock.calls.some(([, event]) => event === REQUEST)).toBe(false)
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(operation).not.toHaveBeenCalled()
  })
})

describe('window update session barrier', () => {
  it('flushes deferred input before locking and keeps edits and Save As blocked after ACK', async () => {
    mocks.getEditorContent.mockImplementation(() => {
      expect(savePathCoordinator.isFileReserved('document')).toBe(false)
    })
    const flush = vi.fn(async () => {
      expect(savePathCoordinator.isFileReserved('document')).toBe(true)
    })
    disposers.push(await listenForUpdateSession('main_two', { prepare: async () => {}, flush }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    await vi.waitFor(() => expect(mocks.emitTo).toHaveBeenCalledWith('main', RESPONSE, {
      id: payload.id, label: 'main_two',
    }))
    expect(mocks.getEditorContent).toHaveBeenCalledWith('document')
    expect(savePathCoordinator.isFileReserved('new-document')).toBe(true)
    const mutation = vi.fn(async () => {})
    const queued = savePathCoordinator.runFileMutation(mutation)
    await Promise.resolve()
    expect(mutation).not.toHaveBeenCalled()
    receive(RELEASE, payload)
    await handling
    await queued
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
    expect(mutation).toHaveBeenCalledOnce()
  })

  it('cancels an in-flight prepare without acquiring a late barrier', async () => {
    const preparing = deferred()
    const flush = vi.fn()
    disposers.push(await listenForUpdateSession('main_two', { prepare: () => preparing.promise, flush }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    receive(RELEASE, payload)
    await handling
    preparing.resolve()
    await Promise.resolve()
    expect(flush).not.toHaveBeenCalled()
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
    expect(mocks.emitTo).not.toHaveBeenCalled()
  })

  it('ignores requests whose cancellation arrived first', async () => {
    const prepare = vi.fn()
    disposers.push(await listenForUpdateSession('main_two', { prepare, flush: vi.fn() }))
    const payload = request()
    receive(RELEASE, payload)
    await receive(REQUEST, payload)
    expect(prepare).not.toHaveBeenCalled()
  })

  it('does not acquire a canceled barrier after an earlier Save As completes', async () => {
    const saving = deferred()
    const priorSave = savePathCoordinator.runFileMutation(() => saving.promise)
    const prepare = vi.fn(async () => {})
    const flush = vi.fn()
    disposers.push(await listenForUpdateSession('main_two', { prepare, flush }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce())
    receive(RELEASE, payload)
    saving.resolve()
    await priorSave
    await handling
    expect(flush).not.toHaveBeenCalled()
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
  })

  it('releases the local barrier and reports persistence failures', async () => {
    disposers.push(await listenForUpdateSession('main_two', {
      prepare: async () => {}, flush: async () => { throw new Error('disk full') },
    }))
    const payload = request()
    await receive(REQUEST, payload)
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
    expect(mocks.emitTo).toHaveBeenCalledWith('main', RESPONSE, {
      id: payload.id, label: 'main_two', error: 'Error: disk full',
    })
  })

  it('rejects concurrent request IDs instead of deadlocking on a second lock', async () => {
    disposers.push(await listenForUpdateSession('main_two', { prepare: async () => {}, flush: async () => {} }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    await vi.waitFor(() => expect(mocks.emitTo).toHaveBeenCalledOnce())
    await receive(REQUEST, request('other'))
    expect(mocks.emitTo).toHaveBeenCalledWith('main', RESPONSE, {
      id: 'other', label: 'main_two', error: 'Another update is already preserving this window',
    })
    receive(RELEASE, request('other'))
    expect(savePathCoordinator.isFileReserved('document')).toBe(true)
    receive(RELEASE, payload)
    await handling
  })

  it('releases even a pending flush on abort and never acknowledges it later', async () => {
    const flushing = deferred()
    disposers.push(await listenForUpdateSession('main_two', {
      prepare: async () => {}, flush: () => flushing.promise,
    }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    await vi.waitFor(() => expect(savePathCoordinator.isFileReserved('document')).toBe(true))
    receive(RELEASE, payload)
    await handling
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
    flushing.resolve()
    await Promise.resolve()
    expect(mocks.emitTo).not.toHaveBeenCalled()
  })

  it('renews the lease while the requester is alive and releases after it disappears', async () => {
    vi.useFakeTimers()
    disposers.push(await listenForUpdateSession('main_two', { prepare: async () => {}, flush: async () => {} }))
    const payload = request()
    const handling = receive(REQUEST, payload)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(savePathCoordinator.isFileReserved('document')).toBe(true)
    receive(HEARTBEAT, { id: payload.id })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(savePathCoordinator.isFileReserved('document')).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    await handling
    expect(savePathCoordinator.isFileReserved('document')).toBe(false)
  })
})
