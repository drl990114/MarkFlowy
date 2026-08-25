import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useEditorStore } from '@/stores'
import type { IFile } from '@/helper/filesys'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceWatcher } from './useWorkspaceWatcher'

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  handleExternalWatchEvent: vi.fn(),
  invoke: vi.fn(),
  resetExternalFileChanges: vi.fn(),
  watch: vi.fn(),
}))

vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  handleExternalWatchEvent: mocks.handleExternalWatchEvent,
  resetExternalFileChanges: mocks.resetExternalFileChanges,
}))
vi.mock('@/helper/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))
vi.mock('@/services/windows', () => ({ currentWindow: { label: 'main' } }))
vi.mock('@/services/workspace', () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-fs', () => ({ watch: mocks.watch }))
vi.mock('hox', () => ({ createGlobalStore: (hook: unknown) => [hook] }))

const root = (path: string): IFile => ({
  children: [],
  ext: '',
  id: path,
  kind: 'dir',
  name: path,
  path,
})

describe('useWorkspaceWatcher', () => {
  beforeEach(() => {
    mocks.getWorkspace.mockResolvedValue({})
    mocks.invoke.mockResolvedValue(undefined)
    mocks.watch.mockReset()
    mocks.resetExternalFileChanges.mockClear()
    useEditorStore.setState({ folderData: [root('/workspace/one')] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses a window-local official watcher and replaces it when the root changes', async () => {
    const unwatchFirst = vi.fn()
    const unwatchSecond = vi.fn()
    mocks.watch
      .mockResolvedValueOnce(unwatchFirst)
      .mockResolvedValueOnce(unwatchSecond)

    const { unmount } = renderHook(() => useWorkspaceWatcher())

    await waitFor(() => {
      expect(mocks.watch).toHaveBeenCalledWith(
        '/workspace/one',
        expect.any(Function),
        { delayMs: 1000, recursive: true },
      )
    })

    act(() => {
      useEditorStore.setState({ folderData: [root('/workspace/two')] })
    })

    await waitFor(() => {
      expect(unwatchFirst).toHaveBeenCalledOnce()
      expect(mocks.watch).toHaveBeenLastCalledWith(
        '/workspace/two',
        expect.any(Function),
        { delayMs: 1000, recursive: true },
      )
    })

    unmount()
    expect(unwatchSecond).toHaveBeenCalledOnce()
  })

  it('disposes a watcher that resolves after the hook has already unmounted', async () => {
    let resolveWatch: ((unwatch: () => void) => void) | undefined
    const unwatch = vi.fn()
    mocks.watch.mockReturnValue(
      new Promise((resolve) => {
        resolveWatch = resolve
      }),
    )

    const { unmount } = renderHook(() => useWorkspaceWatcher())
    await waitFor(() => expect(mocks.watch).toHaveBeenCalledOnce())
    unmount()

    resolveWatch?.(unwatch)
    await waitFor(() => expect(unwatch).toHaveBeenCalledOnce())
  })
})
