import { enableMapSet } from 'immer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SavePathCoordinator } from '@/components/EditorArea/savePathCoordinator'
import { runQueuedFileWrite } from '@/components/EditorArea/runQueuedFileWrite'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import { isPristineDocument, markPristineDocument } from './pristine-document'
import { renameDocument, type RenameDocumentFileSystem } from './rename-document'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

enableMapSet()

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function setup(path: string | undefined = '/documents/note.md') {
  const file = createFile({ name: 'note.md', path, content: '# Current draft' })
  useEditorStore.getState().addOpenedFile(file.id)
  useEditorStore.getState().setActiveId(file.id)
  useEditorStateStore.getState().setIdStateMap(file.id, {
    hasUnsavedChanges: true,
    undoDepth: 4,
  })
  const coordinator = new SavePathCoordinator()
  const renameFile = vi.fn(async (oldPath: string, newPath: string) => ({
    old_path: oldPath,
    new_path: newPath,
    children: null,
    is_folder: false,
  }))
  const fileSystem: RenameDocumentFileSystem = {
    runFileMutation: (operation) => coordinator.runFileMutation(operation),
    pathJoin: vi.fn(async (parent, name) => `${parent.replace(/\/$/, '')}/${name}`),
    fileExists: vi.fn(async () => false),
    pathsReferToSameDirectoryEntry: vi.fn(async () => false),
    renameFile,
  }
  return { file, coordinator, fileSystem, renameFile }
}

beforeEach(() => {
  vi.clearAllMocks()
  useFileCacheStore.setState({ entries: {}, contentEntries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorStore.setState({
    folderData: null,
    opened: [],
    activeId: undefined,
    activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
})

describe('standalone document rename', () => {
  it('preserves the live draft and undo state while rebasing queued writes to the new path', async () => {
    const { file, coordinator, fileSystem, renameFile } = setup()
    const wait = deferred()
    renameFile.mockImplementation(async (oldPath, newPath) => {
      expect(coordinator.isFileReserved(file.id, oldPath)).toBe(true)
      expect(coordinator.isFileReserved('other', newPath)).toBe(true)
      await wait.promise
      return { old_path: oldPath, new_path: newPath, children: null, is_folder: false }
    })
    const renaming = renameDocument(file, 'renamed', fileSystem)
    await vi.waitFor(() => expect(renameFile).toHaveBeenCalled())
    updateFile({ id: file.id, content: '# Latest input' })
    const write = vi.fn(async () => true)
    const saving = runQueuedFileWrite({
      coordinator,
      getCurrentPath: () => getFileObject(file.id)?.path,
      write,
    })
    expect(write).not.toHaveBeenCalled()
    wait.resolve()
    expect(await renaming).toBe('renamed')
    await saving

    expect(renameFile).toHaveBeenCalledWith('/documents/note.md', '/documents/renamed.md')
    expect(write).toHaveBeenCalledWith('/documents/renamed.md')
    expect(getFileObject(file.id)).toMatchObject({
      id: file.id, name: 'renamed.md', path: '/documents/renamed.md', content: '# Latest input',
    })
    expect(getFileObjectByPath('/documents/note.md')).toBeUndefined()
    expect(getFileObjectByPath('/documents/renamed.md')?.id).toBe(file.id)
    expect(useEditorStateStore.getState().idStateMap.get(file.id)).toEqual({
      hasUnsavedChanges: true, undoDepth: 4,
    })
    expect(useEditorStore.getState().opened).toEqual([file.id])
    expect(coordinator.isFileReserved(file.id, file.path)).toBe(false)
  })

  it('keeps a clean saved document clean and updates an explicitly changed extension', async () => {
    const { file, fileSystem } = setup()
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false })
    expect(await renameDocument(file, 'notes.txt', fileSystem)).toBe('renamed')
    expect(getFileObject(file.id)).toMatchObject({ name: 'notes.txt', ext: 'txt' })
    expect(useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges).toBe(false)
  })

  it('does not invent an extension for a document that has none', async () => {
    const { file, fileSystem } = setup('/documents/README')
    updateFile({ id: file.id, name: 'README', ext: '' })
    expect(await renameDocument(getFileObject(file.id), 'NOTES', fileSystem)).toBe('renamed')
    expect(getFileObject(file.id)).toMatchObject({ name: 'NOTES', path: '/documents/NOTES', ext: '' })
  })

  it('turns a named empty draft into a saveable document without filesystem I/O', async () => {
    const { file, fileSystem } = setup()
    updateFile({ id: file.id, path: undefined, content: '' })
    const draft = getFileObject(file.id)
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false, undoDepth: 0 })
    markPristineDocument(file.id)

    expect(await renameDocument(draft, 'Ideas', fileSystem)).toBe('renamed')
    expect(getFileObject(file.id)).toMatchObject({ name: 'Ideas.md', path: undefined, content: '' })
    expect(useEditorStateStore.getState().idStateMap.get(file.id)).toEqual({
      hasUnsavedChanges: true, undoDepth: 0,
    })
    expect(isPristineDocument(file.id)).toBe(false)
    expect(fileSystem.pathJoin).not.toHaveBeenCalled()
    expect(fileSystem.fileExists).not.toHaveBeenCalled()
    expect(fileSystem.renameFile).not.toHaveBeenCalled()
  })

  it.each([
    ['', 'empty'], ['  ', 'empty'], ['../other', 'invalid'], ['folder\\note', 'invalid'],
    ['.', 'invalid'], ['..', 'invalid'], ['note.', 'invalid'], ['bad\u0000name', 'invalid'],
    ['bad\nname', 'invalid'], ['bad:name', 'invalid'],
  ])('rejects invalid filename %j before touching the filesystem', async (name, code) => {
    const { file, fileSystem } = setup()
    await expect(renameDocument(file, name, fileSystem)).rejects.toMatchObject({ code })
    expect(fileSystem.renameFile).not.toHaveBeenCalled()
    expect(getFileObject(file.id)).toEqual(file)
  })

  it('rejects a different existing directory entry without overwriting it', async () => {
    const { file, fileSystem, coordinator } = setup()
    vi.mocked(fileSystem.fileExists).mockResolvedValue(true)
    await expect(renameDocument(file, 'other.md', fileSystem)).rejects.toMatchObject({ code: 'exists' })
    expect(fileSystem.pathsReferToSameDirectoryEntry).toHaveBeenCalledWith(file.path, '/documents/other.md')
    expect(fileSystem.renameFile).not.toHaveBeenCalled()
    expect(getFileObject(file.id)).toEqual(file)
    expect(coordinator.isFileReserved(file.id, file.path)).toBe(false)
  })

  it('allows a case-only rename that resolves to the same directory entry', async () => {
    const { file, fileSystem } = setup()
    vi.mocked(fileSystem.fileExists).mockResolvedValue(true)
    vi.mocked(fileSystem.pathsReferToSameDirectoryEntry).mockResolvedValue(true)
    expect(await renameDocument(file, 'Note.md', fileSystem)).toBe('renamed')
    expect(fileSystem.renameFile).toHaveBeenCalledWith(file.path, '/documents/Note.md')
  })

  it.each(['renamed', 'closed', 'workspace'] as const)(
    'abandons a queued rename when its target has been %s',
    async (change) => {
      const { file, coordinator, fileSystem } = setup()
      const wait = deferred()
      const earlier = coordinator.runFileMutation(() => wait.promise)
      const renaming = renameDocument(file, 'new.md', fileSystem)
      if (change === 'renamed') updateFile({ id: file.id, path: '/documents/saved-as.md', name: 'saved-as.md' })
      if (change === 'closed') useEditorStore.getState().delOpenedFile(file.id)
      if (change === 'workspace') {
        useEditorStore.getState().setFolderDataPure([
          { id: 'root', kind: 'dir', name: 'documents', path: '/documents', children: [] },
        ])
      }
      wait.resolve()
      await earlier
      expect(await renaming).toBe('stale')
      expect(fileSystem.renameFile).not.toHaveBeenCalled()
    },
  )

  it('rechecks a closed document after asynchronous conflict detection', async () => {
    const { file, fileSystem } = setup()
    const wait = deferred()
    vi.mocked(fileSystem.fileExists).mockImplementation(async () => { await wait.promise; return false })
    const renaming = renameDocument(file, 'new.md', fileSystem)
    await vi.waitFor(() => expect(fileSystem.fileExists).toHaveBeenCalled())
    useEditorStore.getState().delOpenedFile(file.id)
    wait.resolve()
    expect(await renaming).toBe('stale')
    expect(fileSystem.renameFile).not.toHaveBeenCalled()
  })

  it('leaves metadata intact and releases reservations when the backend rejects the rename', async () => {
    const { file, fileSystem, coordinator, renameFile } = setup()
    renameFile.mockRejectedValue(new Error('Permission denied'))
    await expect(renameDocument(file, 'new.md', fileSystem)).rejects.toThrow('Permission denied')
    expect(getFileObject(file.id)).toEqual(file)
    expect(coordinator.isFileReserved(file.id, file.path)).toBe(false)
  })

  it('does no filesystem work when the normalized name is unchanged', async () => {
    const { file, fileSystem } = setup()
    expect(await renameDocument(file, ' note ', fileSystem)).toBe('unchanged')
    expect(fileSystem.pathJoin).not.toHaveBeenCalled()
    expect(fileSystem.renameFile).not.toHaveBeenCalled()
  })

  it.each([
    ['/note.md', '/'], ['C:\\note.md', 'C:\\'],
    ['C:\\docs\\note.md', 'C:\\docs'], ['\\\\server\\share\\note.md', '\\\\server\\share'],
  ])('uses the correct containing directory for %s', async (path, parent) => {
    const { file, fileSystem } = setup(path)
    await renameDocument(file, 'new.md', fileSystem)
    expect(fileSystem.pathJoin).toHaveBeenCalledWith(parent, 'new.md')
  })
})
