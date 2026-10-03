import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { loadSnippets, mutateSnippet, subscribeSnippetLibrary, useSnippetStore } from './store'
import { getBuiltinSnippets, getVisibleSnippets } from './builtins'
import type { SnippetLibrary } from './types'

const native = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), unlisten: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }))
const snapshot = (revision = 0): SnippetLibrary => ({
  version: 1,
  revision,
  items: [],
  hiddenBuiltinIds: [],
})
const cleanup: (() => void)[] = []
beforeEach(() => {
  vi.clearAllMocks()
  useSnippetStore.setState({ library: snapshot(), loaded: false, error: null })
  native.listen.mockResolvedValue(native.unlisten)
})
afterEach(() => cleanup.splice(0).forEach((release) => release()))

describe('local snippet library', () => {
  it('retains a newer broadcast read that was started before the local write response arrived', async () => {
    let finishWrite!: (library: SnippetLibrary) => void
    let finishRead!: (library: SnippetLibrary) => void
    native.invoke.mockImplementationOnce(
      () =>
        new Promise<SnippetLibrary>((done) => {
          finishWrite = done
        }),
    )
    const write = mutateSnippet({ type: 'delete', id: 'one' }, 1)
    native.invoke.mockImplementationOnce(
      () =>
        new Promise<SnippetLibrary>((done) => {
          finishRead = done
        }),
    )
    const refresh = loadSnippets()
    finishWrite(snapshot(2))
    await write
    finishRead(snapshot(3))
    await refresh
    expect(useSnippetStore.getState().library.revision).toBe(3)
  })
  it('publishes only after a successful write and keeps the last snapshot on failure', async () => {
    native.invoke.mockResolvedValueOnce(snapshot(2))
    await loadSnippets()
    let resolve!: (library: SnippetLibrary) => void
    native.invoke.mockImplementationOnce(
      () =>
        new Promise<SnippetLibrary>((done) => {
          resolve = done
        }),
    )
    const write = mutateSnippet({ type: 'delete', id: 'one' }, 2)
    expect(useSnippetStore.getState().library.revision).toBe(2)
    resolve(snapshot(3))
    await write
    expect(useSnippetStore.getState().library.revision).toBe(3)
    native.invoke.mockRejectedValueOnce('disk full')
    await expect(mutateSnippet({ type: 'delete', id: 'one' }, 3)).rejects.toBe('disk full')
    expect(useSnippetStore.getState().library.revision).toBe(3)
  })

  it('refreshes conflicts without retrying or rebasing a stale mutation', async () => {
    native.invoke.mockRejectedValueOnce('snippets_conflict').mockResolvedValueOnce(snapshot(7))
    await expect(mutateSnippet({ type: 'delete', id: 'one' }, 4)).rejects.toBe('snippets_conflict')
    expect(native.invoke.mock.calls).toEqual([
      ['mutate_snippets', { mutation: { type: 'delete', id: 'one' }, expectedRevision: 4 }],
      ['get_snippets'],
    ])
    expect(useSnippetStore.getState().library.revision).toBe(7)
  })

  it('shares one listener, refreshes another window, and releases it after the last consumer', async () => {
    native.invoke.mockResolvedValue(snapshot(1))
    const first = subscribeSnippetLibrary()
    const last = subscribeSnippetLibrary()
    cleanup.push(last)
    await vi.waitFor(() => expect(useSnippetStore.getState().loaded).toBe(true))
    expect(native.listen).toHaveBeenCalledTimes(1)
    first()
    expect(native.unlisten).not.toHaveBeenCalled()
    native.invoke.mockResolvedValueOnce(snapshot(2))
    native.listen.mock.calls[0][1]({ payload: 2 })
    await vi.waitFor(() => expect(useSnippetStore.getState().library.revision).toBe(2))
  })

  it('ignores late reads and reports a corrupt file without erasing the last good library', async () => {
    let resolve!: (library: SnippetLibrary) => void
    native.invoke.mockImplementationOnce(
      () =>
        new Promise<SnippetLibrary>((done) => {
          resolve = done
        }),
    )
    const oldRead = loadSnippets()
    native.invoke.mockResolvedValueOnce(snapshot(5))
    await mutateSnippet({ type: 'builtinVisibility', id: 'builtin:math-fraction', hidden: true }, 4)
    resolve(snapshot(4))
    await oldRead
    native.invoke.mockRejectedValueOnce('snippets_invalid')
    await loadSnippets()
    expect(useSnippetStore.getState()).toMatchObject({
      loaded: true,
      error: 'snippets_invalid',
      library: { revision: 5 },
    })
  })

  it('merges one builtin per kind with custom items and restores hidden entries without changing sources', () => {
    const builtins = getBuiltinSnippets((key) => key)
    expect(builtins).toHaveLength(3)
    expect(new Set(builtins.map((item) => item.id)).size).toBe(3)
    for (const kind of ['math', 'mermaid', 'code'])
      expect(builtins.filter((item) => item.kind === kind)).toHaveLength(1)
    const library = {
      ...snapshot(),
      items: [{ id: 'one', kind: 'code' as const, title: 'Raw', source: '\n  ${value}\n' }],
      hiddenBuiltinIds: [builtins[0].id],
    }
    expect(getVisibleSnippets(library, (key) => key)).toHaveLength(3)
    expect(getVisibleSnippets({ ...library, hiddenBuiltinIds: [] }, (key) => key)).toHaveLength(4)
    expect(library.items[0].source).toBe('\n  ${value}\n')
  })
})
