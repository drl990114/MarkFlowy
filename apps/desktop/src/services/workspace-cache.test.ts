import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LazyStore } from '@tauri-apps/plugin-store'
import useFileCacheStore, { getFileObject, setFileObject } from '@/helper/files'
import { createFile, type IFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import {
  createWorkspaceCachePersistence,
  restoreWorkspaceCache,
  type WorkspaceCache,
  type WorkspaceCachePersistence,
} from './workspace-cache'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))

const folder = (path: string): IFile[] => [
  { id: path, name: path, kind: 'dir', path, children: [] },
]
const paths = () => useRecentFilesStore.getState().entries.map((entry) => entry.path)
const openedPaths = () => useEditorStore.getState().opened.map((id) => getFileObject(id).path)

describe('workspace cache and recent files', () => {
  let persistence: WorkspaceCachePersistence
  let data: Map<string, WorkspaceCache>
  let disk: Pick<LazyStore, 'get' | 'set' | 'save' | 'close'>

  beforeEach(() => {
    vi.useFakeTimers()
    useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
    useEditorStore.setState({
      folderData: [],
      opened: [],
      activeId: undefined,
      activeGroupId: 'group',
      editorLayout: { type: 'leaf', id: 'group', opened: [] },
    })
    useRecentFilesStore.setState({ rootPath: undefined, entries: [], restoring: false })
    data = new Map()
    disk = {
      get: async <T>(key: string) => data.get(key) as T | undefined,
      set: vi.fn(async (key: string, value: unknown) => {
        data.set(key, value as WorkspaceCache)
      }),
      save: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    persistence = createWorkspaceCachePersistence(disk as LazyStore)
  })

  afterEach(async () => {
    await persistence.dispose()
    vi.useRealTimers()
  })

  it('preserves persisted order across layout restoration and after closing every tab', async () => {
    restoreWorkspaceCache(
      {
        openedFilePaths: ['/w/A.md', '/w/B.md'],
        activeFilePath: '/w/A.md',
        recentFilePaths: ['/w/closed.md', '/w/B.md', '/w/A.md'],
      },
      folder('/w'),
    )
    expect(paths()).toEqual(['/w/closed.md', '/w/B.md', '/w/A.md'])
    expect(openedPaths()).toEqual(['/w/A.md', '/w/B.md'])
    await vi.advanceTimersByTimeAsync(799)
    expect(disk.set).not.toHaveBeenCalled()
    useEditorStore.getState().closeAllFilesInGroup(useEditorStore.getState().activeGroupId!)
    await persistence.flush()
    const cached = data.get('/w')!
    expect(cached.openedFilePaths).toEqual([])
    expect(cached.recentFilePaths).toEqual(['/w/closed.md', '/w/B.md', '/w/A.md'])

    await persistence.dispose()
    useRecentFilesStore.setState({ entries: [], rootPath: undefined })
    persistence = createWorkspaceCachePersistence(disk as LazyStore)
    restoreWorkspaceCache(cached, folder('/w'))
    expect(paths()).toEqual(cached.recentFilePaths)
    expect(openedPaths()).toEqual([])
  })

  it('migrates legacy cache once using active file then tab order, and respects an empty history', async () => {
    restoreWorkspaceCache(
      { openedFilePaths: ['/w/A.md', '/w/B.md'], activeFilePath: '/w/B.md' },
      folder('/w'),
    )
    expect(paths()).toEqual(['/w/B.md', '/w/A.md'])
    await vi.advanceTimersByTimeAsync(800)
    expect(data.get('/w')?.recentFilePaths).toEqual(['/w/B.md', '/w/A.md'])
    restoreWorkspaceCache({ ...data.get('/w'), recentFilePaths: [] }, folder('/w'))
    expect(paths()).toEqual([])
    expect(openedPaths()).toEqual(['/w/A.md', '/w/B.md'])
  })

  it('restores history-only caches and filters malformed entries independently from editor layout', () => {
    restoreWorkspaceCache({ recentFilePaths: ['/w/closed.md'] }, folder('/w'))
    expect(paths()).toEqual(['/w/closed.md'])
    const malformed = JSON.parse(
      '{"recentFilePaths":[null,42,"","C:\\\\Notes\\\\A.md","c:/notes/a.md"],"openedFilePaths":["/w/active.md"]}',
    ) as WorkspaceCache
    restoreWorkspaceCache(malformed, folder('/w'))
    expect(paths()).toEqual(['C:\\Notes\\A.md'])
    expect(openedPaths()).toEqual(['/w/active.md'])
  })

  it('flushes pending old-workspace history before loading another workspace', async () => {
    restoreWorkspaceCache({ recentFilePaths: ['/one/old.md'] }, folder('/one'))
    useRecentFilesStore.getState().visit({ path: '/one/recent.md' })
    data.set('/two', { recentFilePaths: ['/two/closed.md'] })
    const next = await persistence.getWorkspaceCache('/two')
    expect(data.get('/one')?.recentFilePaths).toEqual(['/one/recent.md', '/one/old.md'])
    restoreWorkspaceCache(next, folder('/two'))
    expect(paths()).toEqual(['/two/closed.md'])
    await persistence.flush()
    expect(data.get('/two')?.recentFilePaths).toEqual(['/two/closed.md'])
    restoreWorkspaceCache(await persistence.getWorkspaceCache('/one'), folder('/one'))
    expect(paths()).toEqual(['/one/recent.md', '/one/old.md'])
  })

  it('does not persist drafts or no-workspace sessions, and ignores content-only updates', async () => {
    const draft = createFile({ content: 'draft' })
    useEditorStore.getState().addOpenedFile(draft.id)
    useEditorStore.getState().setActiveId(draft.id)
    await persistence.flush()
    expect(disk.set).not.toHaveBeenCalled()

    restoreWorkspaceCache(undefined, folder('/w'))
    useEditorStore.getState().addOpenedFile(draft.id)
    useEditorStore.getState().setActiveId(draft.id)
    await persistence.flush()
    expect(data.get('/w')?.recentFilePaths).toEqual([])
    vi.mocked(disk.set).mockClear()
    setFileObject(draft.id, { ...draft, content: 'more typing' })
    await vi.advanceTimersByTimeAsync(800)
    expect(disk.set).not.toHaveBeenCalled()
    setFileObject(draft.id, { ...draft, path: '/w/saved.md' })
    await persistence.flush()
    expect(data.get('/w')?.recentFilePaths).toEqual(['/w/saved.md'])
  })

  it('serializes overlapping saves and flushes the final history on disposal', async () => {
    let release!: () => void
    const firstSave = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.mocked(disk.save).mockReturnValueOnce(firstSave)
    restoreWorkspaceCache({ recentFilePaths: ['/w/A.md'] }, folder('/w'))
    await vi.advanceTimersByTimeAsync(800)
    useRecentFilesStore.getState().visit({ path: '/w/B.md' })
    const dispose = persistence.dispose()
    expect(disk.set).toHaveBeenCalledTimes(1)
    expect(disk.close).not.toHaveBeenCalled()
    release()
    await dispose
    expect(data.get('/w')?.recentFilePaths).toEqual(['/w/B.md', '/w/A.md'])
    expect(disk.close).toHaveBeenCalledTimes(1)
    useRecentFilesStore.getState().visit({ path: '/w/C.md' })
    await vi.advanceTimersByTimeAsync(800)
    expect(disk.set).toHaveBeenCalledTimes(2)
  })

  it('retains restored order across subscription restarts and Save As metadata changes', async () => {
    restoreWorkspaceCache(
      {
        openedFilePaths: ['/w/A.md'],
        activeFilePath: '/w/A.md',
        recentFilePaths: ['/w/closed.md', '/w/A.md'],
      },
      folder('/w'),
    )
    await persistence.dispose()
    persistence = createWorkspaceCachePersistence(disk as LazyStore)
    expect(paths()).toEqual(['/w/closed.md', '/w/A.md'])
    const active = getFileObject(useEditorStore.getState().activeId!)
    setFileObject(active.id, { ...active, path: '/w/renamed.md' })
    expect(paths()).toEqual(['/w/closed.md', '/w/renamed.md'])
    await persistence.flush()
    expect(data.get('/w')?.recentFilePaths).toEqual(paths())
  })

  it('keeps the old history when malformed layout restoration fails', async () => {
    restoreWorkspaceCache({ recentFilePaths: ['/w/A.md', '/w/B.md'] }, folder('/w'))
    const corrupt = JSON.parse(
      '{"recentFilePaths":["/next/C.md"],"editorLayout":{"type":"branch"}}',
    ) as WorkspaceCache
    expect(() => restoreWorkspaceCache(corrupt, folder('/next'))).toThrow()
    expect(paths()).toEqual(['/w/A.md', '/w/B.md'])
    expect(useRecentFilesStore.getState().restoring).toBe(false)
    await persistence.flush()
    expect(data.get('/w')?.recentFilePaths).toEqual(paths())
    expect(data.has('/next')).toBe(false)
  })
})
