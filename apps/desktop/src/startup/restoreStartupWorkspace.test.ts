import { enableMapSet } from 'immer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type * as MarkflowyInterface from '@markflowy/interface'
import type * as FileSystem from '@/helper/filesys'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { readDirectory, type IFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import { refreshWorkspaceDirectory, useWorkspaceDirectoryState } from '@/services/workspace-refresh'
import { restoreStartupWorkspace } from './restoreStartupWorkspace'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(true) }))
vi.mock('@/helper/filesys', async (original) => ({
  ...await original<typeof FileSystem>(),
  readDirectory: vi.fn(),
}))
vi.mock('@markflowy/interface', async (original) => ({
  ...await original<typeof MarkflowyInterface>(),
  fileTreeHandler: { clearLoadedDirsCache: vi.fn() },
}))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

enableMapSet()
const folder = (path: string): IFile[] => [{ id: path, path, name: path, kind: 'dir', children: [] }]
const cache = { openedFilePaths: ['/w/a.md', '/w/b.md'], activeFilePath: '/w/a.md' }

beforeEach(() => {
  vi.clearAllMocks()
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStore.getState().setFolderData([])
  useWorkspaceDirectoryState.setState({ root: undefined, status: 'idle', error: undefined })
})

describe('startup workspace restoration', () => {
  it('restores the selected document before directory enumeration and keeps it on completion', async () => {
    let finish!: (value: IFile[]) => void
    vi.mocked(readDirectory).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    await restoreStartupWorkspace('/w', Promise.resolve(cache), new AbortController().signal)
    const state = useEditorStore.getState()
    expect(getFileObject(state.activeId!).path).toBe('/w/a.md')
    expect(state.opened).toHaveLength(2)
    expect(useWorkspaceDirectoryState.getState().status).toBe('loading')
    expect(invoke).toHaveBeenCalledWith('activate_workspace_root', { rootPath: '/w' })

    finish(folder('/w'))
    await vi.waitFor(() => expect(useWorkspaceDirectoryState.getState().status).toBe('ready'))
    expect(useEditorStore.getState().editorLayout).toBe(state.editorLayout)
    expect(useEditorStore.getState().activeId).toBe(state.activeId)
  })

  it('isolates a directory failure and retries without resetting open documents', async () => {
    vi.mocked(readDirectory).mockRejectedValueOnce(new Error('Permission denied'))
    await restoreStartupWorkspace('/w', Promise.resolve(cache), new AbortController().signal)
    await vi.waitFor(() => expect(useWorkspaceDirectoryState.getState().status).toBe('error'))
    const state = useEditorStore.getState()
    expect(state.opened).toHaveLength(2)
    vi.mocked(readDirectory).mockResolvedValueOnce(folder('/w'))
    await refreshWorkspaceDirectory()
    expect(useWorkspaceDirectoryState.getState().status).toBe('ready')
    expect(useEditorStore.getState().editorLayout).toBe(state.editorLayout)
  })

  it('does not restore a canceled session', async () => {
    const controller = new AbortController()
    controller.abort()
    await restoreStartupWorkspace('/w', Promise.resolve(cache), controller.signal)
    expect(readDirectory).not.toHaveBeenCalled()
    expect(useEditorStore.getState().opened).toEqual([])
  })

  it('invalidates a pending scan before metadata hydration after a workspace switch', async () => {
    let finish!: (value: IFile[]) => void
    vi.mocked(readDirectory).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    await restoreStartupWorkspace('/w', Promise.resolve(cache), new AbortController().signal)
    const isCurrent = vi.mocked(readDirectory).mock.calls[0][1]?.isCurrent
    expect(isCurrent?.()).toBe(true)
    useEditorStore.getState().setFolderData(folder('/other'))
    expect(isCurrent?.()).toBe(false)
    finish(folder('/w'))
    await Promise.resolve()
    expect(useEditorStore.getState().getRootPath()).toBe('/other')
  })

  it('rejects an older refresh even when the root has not changed', async () => {
    let finish!: (value: IFile[]) => void
    vi.mocked(readDirectory).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    await restoreStartupWorkspace('/w', Promise.resolve(cache), new AbortController().signal)
    const isCurrent = vi.mocked(readDirectory).mock.calls[0][1]?.isCurrent
    vi.mocked(readDirectory).mockResolvedValueOnce(folder('/w'))
    await refreshWorkspaceDirectory()
    expect(isCurrent?.()).toBe(false)
    const state = useEditorStore.getState()
    finish(folder('/w'))
    await Promise.resolve()
    expect(useEditorStore.getState().folderData).toBe(state.folderData)
  })
})
