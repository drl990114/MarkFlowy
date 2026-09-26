import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LazyStore } from '@tauri-apps/plugin-store'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { savePathCoordinator } from '@/components/EditorArea/savePathCoordinator'
import useFileCacheStore, {
  delSaveOpenedEditorEntries,
  getFileObject,
  setSaveOpenedEditorEntries,
} from '@/helper/files'
import { createFile, readDirectory, updateFile, type IFile } from '@/helper/filesys'
import type * as FileSystem from '@/helper/filesys'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import { dialog } from './dialog'
import {
  createWorkspaceCachePersistence,
  restoreWorkspaceCache,
  type WorkspaceCache,
  type WorkspaceCachePersistence,
} from './workspace-cache'
import { attachWorkspaceSession, switchWorkspaceSession } from './workspace-session'
import { refreshWorkspaceDirectory } from './workspace-refresh'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(true) }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('./dialog', () => ({ dialog: { confirm: vi.fn() } }))
vi.mock('./windows', () => ({ currentWindow: { label: 'test-window' } }))
vi.mock('@/stores/useOpenedCacheStore', () => ({
  default: { getState: () => ({ addRecentWorkspaces: vi.fn().mockResolvedValue(undefined) }) },
}))
vi.mock('@/helper/filesys', async (importOriginal) => ({
  ...(await importOriginal<typeof FileSystem>()),
  readDirectory: vi.fn(),
}))

enableMapSet()

const folder = (path: string): IFile[] => [
  { id: path, name: path, kind: 'dir', path, children: [] },
]
const openedPaths = () => useEditorStore.getState().opened.map((id) => getFileObject(id)?.path)

describe('workspace editor sessions', () => {
  let persistence: WorkspaceCachePersistence
  let data: Map<string, WorkspaceCache>
  const cleanups: (() => void)[] = []

  const openDocument = (path?: string) => {
    const file = createFile({ name: 'Note.md', path, content: 'saved content' })
    useEditorStore.getState().addOpenedFile(file.id)
    useEditorStore.getState().setActiveId(file.id)
    return file
  }
  const editDocument = (file: IFile, content = 'unsaved content') => {
    updateFile({ id: file.id, content })
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dialog.confirm).mockResolvedValue('cancel')
    vi.mocked(readDirectory).mockImplementation(async (path) => folder(path))
    useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
    useEditorStateStore.setState({ idStateMap: new Map() })
    useEditorStore.setState({
      folderData: [],
      opened: [],
      activeId: undefined,
      activeGroupId: 'group',
      editorLayout: { type: 'leaf', id: 'group', opened: [] },
    })
    useRecentFilesStore.setState({ rootPath: undefined, entries: [], restoring: false })
    data = new Map()
    const disk: Pick<LazyStore, 'get' | 'set' | 'save' | 'close'> = {
      get: async <T>(key: string) => data.get(key) as T | undefined,
      set: async (key, value) => {
        data.set(key, value as WorkspaceCache)
      },
      save: async () => {},
      close: async () => {},
    }
    persistence = createWorkspaceCachePersistence(disk as LazyStore)
    restoreWorkspaceCache(undefined, folder('/one'))
  })

  afterEach(async () => {
    cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup())
    await persistence.dispose()
  })

  it('attaches a folder and merges its history without prompting or replacing edited documents', async () => {
    useEditorStore.getState().setFolderData(null)
    const draft = openDocument()
    editDocument(draft)
    const saved = openDocument('/two/existing.md')
    useEditorStore.getState().setActiveId(draft.id)
    const revision = useEditorStore.getState().editorSessionRevision
    data.set('/two', { openedFilePaths: ['/two/existing.md', '/two/other.md'], activeFilePath: '/two/other.md' })
    expect(await switchWorkspaceSession('/two', persistence)).toBe(true)
    expect(dialog.confirm).not.toHaveBeenCalled()
    expect(useEditorStore.getState().activeId).toBe(draft.id)
    expect(useEditorStore.getState().editorSessionRevision).toBe(revision)
    expect(useEditorStore.getState().opened).toContain(saved.id)
    expect(openedPaths()).toEqual([undefined, '/two/existing.md', '/two/other.md'])
    expect(getFileObject(draft.id).content).toBe('unsaved content')
    expect(useEditorStateStore.getState().idStateMap.get(draft.id)?.hasUnsavedChanges).toBe(true)
  })

  it('closes only the folder and keeps the split layout and dirty document identities', async () => {
    const first = openDocument('/one/first.md')
    const second = openDocument()
    editDocument(second)
    useEditorStore.getState().setEditorLayout({ type: 'branch', id: 'split', direction: 'horizontal', sizes: [40, 60], children: [
      { type: 'leaf', id: 'a', opened: [first.id], activeId: first.id },
      { type: 'leaf', id: 'b', opened: [second.id], activeId: second.id },
    ] }, 'b')
    const previous = useEditorStore.getState()
    await attachWorkspaceSession(undefined, persistence)
    expect(useEditorStore.getState().getRootPath()).toBeUndefined()
    expect(useEditorStore.getState().editorLayout).toBe(previous.editorLayout)
    expect(useEditorStore.getState().activeId).toBe(second.id)
    expect(useEditorStore.getState().editorSessionRevision).toBe(previous.editorSessionRevision)
    expect(dialog.confirm).not.toHaveBeenCalled()
    expect(getFileObject(second.id).content).toBe('unsaved content')
  })

  it('leaves a standalone document usable when opening the folder fails', async () => {
    useEditorStore.getState().setFolderData(null)
    const draft = openDocument()
    editDocument(draft)
    const layout = useEditorStore.getState().editorLayout
    vi.mocked(readDirectory).mockRejectedValueOnce(new Error('permission denied'))
    await expect(switchWorkspaceSession('/missing', persistence)).rejects.toThrow('permission denied')
    expect(useEditorStore.getState().editorLayout).toBe(layout)
    expect(useEditorStore.getState().getRootPath()).toBeUndefined()
    expect(getFileObject(draft.id).content).toBe('unsaved content')
  })

  it('restores each workspace tab order, selected tab, split layout and active group independently', async () => {
    const first = openDocument('/one/first.md')
    const second = openDocument('/one/second.md')
    const shared = openDocument('/shared/reference.md')
    useEditorStore.getState().setEditorLayout(
      {
        type: 'branch',
        id: 'split',
        direction: 'horizontal',
        sizes: [35, 65],
        children: [
          { type: 'leaf', id: 'left', opened: [second.id, first.id], activeId: second.id },
          { type: 'leaf', id: 'right', opened: [shared.id, first.id], activeId: first.id },
        ],
      },
      'right',
    )
    const originalLayout = useEditorStore.getState().editorLayout

    expect(await switchWorkspaceSession('/two', persistence)).toBe(true)
    expect(openedPaths()).toEqual([])
    const next = openDocument('/two/only.md')

    expect(await switchWorkspaceSession('/one', persistence)).toBe(true)
    expect(useEditorStore.getState().editorLayout).toEqual(originalLayout)
    expect(useEditorStore.getState().activeGroupId).toBe('right')
    expect(useEditorStore.getState().activeId).toBe(first.id)
    expect(await switchWorkspaceSession('/two', persistence)).toBe(true)
    expect(openedPaths()).toEqual(['/two/only.md'])
    expect(useEditorStore.getState().activeId).toBe(next.id)
    expect(dialog.confirm).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'unsaved', 'save'] as const)(
    'uses the existing unsaved dialog for %s',
    async (action) => {
      const file = openDocument()
      editDocument(file)
      vi.mocked(dialog.confirm).mockResolvedValue(action)
      const save = vi.fn(async () => {
        updateFile({ id: file.id, path: '/one/saved.md' })
        useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false })
        return true
      })
      setSaveOpenedEditorEntries(file.id, save)
      cleanups.push(() => delSaveOpenedEditorEntries(file.id))

      expect(await switchWorkspaceSession('/two', persistence)).toBe(action !== 'cancel')
      expect(dialog.confirm).toHaveBeenCalledOnce()
      expect(save).toHaveBeenCalledTimes(action === 'save' ? 1 : 0)
      if (action === 'cancel') {
        expect(useEditorStore.getState().getRootPath()).toBe('/one')
        expect(useEditorStore.getState().opened).toEqual([file.id])
        expect(readDirectory).not.toHaveBeenCalled()
      } else {
        expect(useEditorStore.getState().getRootPath()).toBe('/two')
        expect(useEditorStore.getState().opened).toEqual([])
        expect(data.get('/one')?.openedFilePaths).toEqual(
          action === 'save' ? ['/one/saved.md'] : [],
        )
      }
    },
  )

  it('keeps the original tabs when saving is cancelled or fails', async () => {
    const file = openDocument()
    editDocument(file)
    vi.mocked(dialog.confirm).mockResolvedValue('save')
    setSaveOpenedEditorEntries(file.id, async () => false)
    cleanups.push(() => delSaveOpenedEditorEntries(file.id))

    expect(await switchWorkspaceSession('/two', persistence)).toBe(false)
    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().opened).toEqual([file.id])
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('discards the dirty state of a file also open in the destination workspace', async () => {
    const file = openDocument('/shared/note.md')
    editDocument(file)
    data.set('/two', { openedFilePaths: ['/shared/note.md'] })
    vi.mocked(dialog.confirm).mockResolvedValue('unsaved')

    expect(await switchWorkspaceSession('/two', persistence)).toBe(true)
    expect(openedPaths()).toEqual(['/shared/note.md'])
    expect(useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges).not.toBe(true)
  })

  it('flushes pending editor input before deciding whether to show the unsaved dialog', async () => {
    const file = openDocument('/one/note.md')
    let pending = true
    cleanups.push(
      editorSnapshotRegistry.register(file.id, 'pending-editor', {
        canRead: () => true,
        flush: () => {
          editDocument(file, 'latest input')
          pending = false
          return true
        },
        hasPending: () => pending,
        isVisible: () => true,
        onSyncDemandChanged: () => {},
      }),
    )

    expect(await switchWorkspaceSession('/two', persistence)).toBe(false)
    expect(dialog.confirm).toHaveBeenCalledOnce()
    expect(getFileObject(file.id)?.content).toBe('latest input')
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('allows Save As to use the shared mutation queue before switching', async () => {
    const file = openDocument()
    editDocument(file)
    vi.mocked(dialog.confirm).mockResolvedValue('save')
    setSaveOpenedEditorEntries(file.id, () =>
      savePathCoordinator.runFileMutation(async () => {
        updateFile({ id: file.id, path: '/one/saved.md' })
        useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false })
        return true
      }),
    )
    cleanups.push(() => delSaveOpenedEditorEntries(file.id))

    expect(await switchWorkspaceSession('/two', persistence)).toBe(true)
    expect(data.get('/one')?.openedFilePaths).toEqual(['/one/saved.md'])
  })

  it('checks again for edits made while a preceding file operation is still running', async () => {
    const file = openDocument('/one/note.md')
    let release!: () => void
    const pendingMutation = savePathCoordinator.runFileMutation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
    })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const switching = switchWorkspaceSession('/two', persistence)
    editDocument(file)
    release()
    await pendingMutation

    expect(await switching).toBe(false)
    expect(dialog.confirm).toHaveBeenCalledOnce()
    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().opened).toEqual([file.id])
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('does not restore an outdated tab snapshot when a queued switch fails', async () => {
    openDocument('/one/first.md')
    let release!: () => void
    const pendingMutation = savePathCoordinator.runFileMutation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
    })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const switching = switchWorkspaceSession('/two', persistence)
    openDocument('/one/second.md')
    const originalLayout = useEditorStore.getState().editorLayout
    vi.mocked(readDirectory).mockRejectedValueOnce(new Error('Directory unavailable'))
    const failure = expect(switching).rejects.toThrow('Directory unavailable')
    release()
    await pendingMutation
    await failure

    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().editorLayout).toEqual(originalLayout)
    expect(openedPaths()).toEqual(['/one/first.md', '/one/second.md'])
  })

  it('asks again when a discarded document changes while the switch is queued', async () => {
    const file = openDocument('/one/note.md')
    editDocument(file)
    vi.mocked(dialog.confirm).mockResolvedValueOnce('unsaved').mockResolvedValue('cancel')
    let release!: () => void
    const pendingMutation = savePathCoordinator.runFileMutation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
    })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const switching = switchWorkspaceSession('/two', persistence)
    await vi.waitFor(() => expect(dialog.confirm).toHaveBeenCalledOnce())
    editDocument(file, 'newer edits')
    release()
    await pendingMutation

    expect(await switching).toBe(false)
    expect(dialog.confirm).toHaveBeenCalledTimes(2)
    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(getFileObject(file.id)?.content).toBe('newer edits')
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('retains discarded documents when the destination cannot be opened', async () => {
    const file = openDocument('/one/note.md')
    editDocument(file)
    vi.mocked(dialog.confirm).mockResolvedValue('unsaved')
    vi.mocked(readDirectory).mockRejectedValueOnce(new Error('Directory unavailable'))

    await expect(switchWorkspaceSession('/two', persistence)).rejects.toThrow(
      'Directory unavailable',
    )
    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().opened).toEqual([file.id])
    expect(getFileObject(file.id)?.content).toBe('unsaved content')
    expect(useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges).toBe(true)
  })

  it('protects documents opened while the destination is still loading', async () => {
    openDocument('/one/first.md')
    let finishRead!: (files: IFile[]) => void
    vi.mocked(readDirectory).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve
      }),
    )
    const switching = switchWorkspaceSession('/two', persistence)
    await vi.waitFor(() => expect(readDirectory).toHaveBeenCalledWith('/two'))
    const draft = openDocument()
    editDocument(draft)
    finishRead(folder('/two'))

    expect(await switching).toBe(false)
    expect(dialog.confirm).toHaveBeenCalledOnce()
    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().opened).toContain(draft.id)
  })

  it('preserves tab changes made while a failed directory read is pending', async () => {
    openDocument('/one/first.md')
    let failRead!: (error: Error) => void
    vi.mocked(readDirectory).mockReturnValueOnce(
      new Promise((_, reject) => {
        failRead = reject
      }),
    )
    const switching = switchWorkspaceSession('/two', persistence)
    await vi.waitFor(() => expect(readDirectory).toHaveBeenCalledWith('/two'))
    const latest = openDocument('/one/latest.md')
    const failure = expect(switching).rejects.toThrow('Directory unavailable')
    failRead(new Error('Directory unavailable'))
    await failure

    expect(useEditorStore.getState().getRootPath()).toBe('/one')
    expect(useEditorStore.getState().activeId).toBe(latest.id)
    expect(openedPaths()).toEqual(['/one/first.md', '/one/latest.md'])
  })

  it.each([false, true])(
    'ignores a stale tree refresh after switching workspaces (return to original: %s)',
    async (returnToOriginal) => {
      openDocument('/one/first.md')
      let finishRefresh!: (files: IFile[]) => void
      vi.mocked(readDirectory).mockReturnValueOnce(
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
      )
      const refreshing = refreshWorkspaceDirectory()

      await switchWorkspaceSession('/two', persistence)
      openDocument('/two/second.md')
      if (returnToOriginal) await switchWorkspaceSession('/one', persistence)
      const current = useEditorStore.getState()
      finishRefresh(folder('/one'))
      await refreshing

      expect(useEditorStore.getState().folderData).toBe(current.folderData)
      expect(useEditorStore.getState().editorLayout).toBe(current.editorLayout)
      expect(openedPaths()).toEqual(returnToOriginal ? ['/one/first.md'] : ['/two/second.md'])
      await persistence.flush()
      expect(data.get('/one')?.openedFilePaths).toEqual(['/one/first.md'])
      expect(data.get('/two')?.openedFilePaths).toEqual(['/two/second.md'])
    },
  )
})
