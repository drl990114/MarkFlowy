import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, {
  deleteFileObjectsByPathPrefix,
  getFileObject,
  moveFileObjectsByPathPrefix,
  setFileObject,
} from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore, { parseRecentFilePaths } from '@/stores/useRecentFilesStore'
import { restoreRecentFileHistory, startRecentFileTracking } from './recent-files'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

let stopTracking: (() => void) | undefined
const paths = () =>
  useRecentFilesStore.getState().entries.map((entry) => entry.path ?? entry.fileId)
const visit = (path: string) => useRecentFilesStore.getState().visit({ path })

beforeEach(() => {
  vi.mocked(invoke).mockReset().mockResolvedValue(undefined)
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStore.setState({
    folderData: [{ id: 'root', kind: 'dir', name: 'workspace', path: '/workspace' }],
    opened: [],
    activeId: undefined,
    activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
  useRecentFilesStore.setState({ rootPath: '/workspace', entries: [], restoring: false })
})
afterEach(() => {
  stopTracking?.()
  stopTracking = undefined
})

describe('recent file sequence', () => {
  it('deduplicates visits and evicts only the oldest entries beyond 200', () => {
    for (const path of ['A', 'B', 'C', 'A']) visit(path)
    expect(paths()).toEqual(['A', 'C', 'B'])
    for (let index = 0; index < 201; index++) visit(`/workspace/${index}.md`)
    expect(paths()).toHaveLength(200)
    expect(paths()[0]).toBe('/workspace/200.md')
    expect(paths().at(-1)).toBe('/workspace/1.md')
  })

  it('filters individual invalid persisted values and normalizes Windows aliases', () => {
    expect(
      parseRecentFilePaths([
        null,
        5,
        {},
        '',
        '  ',
        'bad\0path',
        'C:\\Workspace\\A.md',
        'c:/workspace/a.md/',
        '/workspace/B.md',
        '/workspace/b.md',
      ]),
    ).toEqual([
      { path: 'C:\\Workspace\\A.md' },
      { path: '/workspace/B.md' },
      { path: '/workspace/b.md' },
    ])
    expect(parseRecentFilePaths('invalid')).toEqual([])
  })

  it('migrates closed descendants at the same position, deduplicating targets and retaining siblings', () => {
    useRecentFilesStore
      .getState()
      .replaceEntries(
        parseRecentFilePaths([
          '/workspace/old/nested/a.md',
          '/workspace/other.md',
          '/workspace/new/nested/a.md',
          '/workspace/older/b.md',
        ]),
      )
    moveFileObjectsByPathPrefix('/workspace/old', '/workspace/new')
    expect(paths()).toEqual([
      '/workspace/new/nested/a.md',
      '/workspace/other.md',
      '/workspace/older/b.md',
    ])
    deleteFileObjectsByPathPrefix('/workspace/new')
    expect(paths()).toEqual(['/workspace/other.md', '/workspace/older/b.md'])
  })

  it('moves Windows aliases in both the cache and closed history without losing content', () => {
    const file = createFile({ path: 'C:\\Workspace\\Old\\A.md', content: 'unsaved' })
    useRecentFilesStore
      .getState()
      .replaceEntries([{ path: file.path!, fileId: file.id }, { path: 'C:\\Workspace\\Old\\B.md' }])
    stopTracking = startRecentFileTracking()
    moveFileObjectsByPathPrefix('c:/workspace/old', 'C:\\Workspace\\New')
    expect(paths()).toEqual(['C:\\Workspace\\New\\A.md', 'C:\\Workspace\\New\\B.md'])
    expect(getFileObject(file.id).content).toBe('unsaved')
    setFileObject(file.id, { ...getFileObject(file.id), name: 'A.md' })
    expect(paths()[0]).toBe('C:\\Workspace\\New\\A.md')
  })
})

describe('application-owned visit tracking', () => {
  const open = (id: string) => {
    useEditorStore.getState().addOpenedFile(id)
    useEditorStore.getState().setActiveId(id)
  }

  it('records opens, tab switches and close fallback, while ignoring background work and tab order', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((name) =>
      createFile({ name, path: `/workspace/${name}.md` }),
    )
    stopTracking = startRecentFileTracking()
    open(a.id)
    open(b.id)
    open(c.id)
    useEditorStore.getState().setActiveId(a.id)
    expect(paths()).toEqual([a.path, c.path, b.path])
    const sequence = useRecentFilesStore.getState().entries
    setFileObject(a.id, { ...a, content: 'edited' })
    useEditorStore.getState().moveFileToGroup('group', 'group', a.id, 2)
    const background = createFile({ name: 'background.md', path: '/workspace/background.md' })
    useEditorStore.getState().openFileInGroup('group', background.id, { activate: false })
    expect(useRecentFilesStore.getState().entries).toBe(sequence)
    useEditorStore.getState().closeFileInGroup('group', a.id)
    expect(paths()[0]).toBe(getFileObject(useEditorStore.getState().activeId!).path)
    expect(paths()).toContain(a.path)
  })

  it('records switching panes and keeps ordinary closed files, but discards closed drafts', () => {
    const a = createFile({ path: '/workspace/A.md' })
    const b = createFile({ path: '/workspace/B.md' })
    const draft = createFile({ name: 'Draft.md', content: 'draft' })
    restoreRecentFileHistory(() =>
      useEditorStore.getState().setEditorLayout(
        {
          type: 'branch',
          id: 'split',
          direction: 'horizontal',
          sizes: [50, 50],
          children: [
            { type: 'leaf', id: 'left', opened: [a.id, draft.id], activeId: a.id },
            { type: 'leaf', id: 'right', opened: [b.id], activeId: b.id },
          ],
        },
        'left',
      ),
    )
    stopTracking = startRecentFileTracking()
    useEditorStore.getState().setActiveGroupId('right')
    expect(paths()[0]).toBe(b.path)
    useEditorStore.getState().setActiveGroupId('left')
    expect(paths()[0]).toBe(a.path)
    useEditorStore.getState().setActiveId(draft.id)
    expect(paths()[0]).toBe(draft.id)
    useEditorStore.getState().closeFileInGroup('left', draft.id)
    expect(paths()).not.toContain(draft.id)
    useEditorStore.getState().closeAllFilesInGroup('left')
    expect(paths()).toContain(a.path)
  })

  it('suppresses restore visits and only seeds active plus tabs when history is absent', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((name) => createFile({ path: `/workspace/${name}.md` }))
    stopTracking = startRecentFileTracking()
    const restore = () => {
      open(a.id)
      open(b.id)
      open(c.id)
      useEditorStore.getState().setActiveId(b.id)
    }
    restoreRecentFileHistory(restore, [{ path: c.path! }, { path: a.path! }])
    expect(paths()).toEqual([c.path, a.path])
    restoreRecentFileHistory(restore)
    expect(paths()).toEqual([b.path, a.path, c.path])
    restoreRecentFileHistory(restore, [])
    expect(paths()).toEqual([])
  })

  it('keeps Save As in place and clears session history when the workspace changes', () => {
    const draft = createFile({ name: 'Draft.md' })
    const other = createFile({ path: '/workspace/other.md' })
    stopTracking = startRecentFileTracking()
    open(draft.id)
    open(other.id)
    setFileObject(draft.id, { ...draft, path: '/workspace/saved.md' })
    expect(paths()).toEqual([other.path, '/workspace/saved.md'])
    useEditorStore.getState().setFolderData([])
    expect(paths()).toEqual([])
    expect(useRecentFilesStore.getState().rootPath).toBeUndefined()
    stopTracking()
    stopTracking = undefined
    open(other.id)
    expect(paths()).toEqual([])
  })

  it.each(['deleteNode', 'trashNode'] as const)(
    'only removes confirmed files and retains close fallback for %s',
    async (method) => {
      const a = createFile({ name: 'A.md', path: '/workspace/A.md' })
      const b = createFile({ name: 'B.md', path: '/workspace/B.md' })
      useEditorStore.setState({
        folderData: [
          { id: 'root', kind: 'dir', name: 'workspace', path: '/workspace', children: [a, b] },
        ],
      })
      stopTracking = startRecentFileTracking()
      open(a.id)
      open(b.id)
      vi.mocked(invoke).mockImplementation(async (command) =>
        command === 'delete_file' ? 'OK' : command === 'file_exists',
      )
      await expect(useEditorStore.getState()[method](b)).rejects.toThrow()
      expect(paths()).toEqual([b.path, a.path])
      expect(useEditorStore.getState().activeId).toBe(b.id)
      vi.mocked(invoke).mockImplementation(async (command) =>
        command === 'delete_file' ? 'OK' : command === 'trash_delete',
      )
      await useEditorStore.getState()[method](b)
      // Explorer removes the cache only after the disk operation succeeds.
      deleteFileObjectsByPathPrefix(b.path!)
      expect(paths()).toEqual([a.path])
      expect(useEditorStore.getState().activeId).toBe(a.id)
      expect(useEditorStore.getState().getActiveGroup()?.activeId).toBe(a.id)
    },
  )
})
