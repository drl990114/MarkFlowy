import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import {
  checkRecentQuickOpenFiles,
  getOpenedQuickOpenFiles,
  getRecentQuickOpenFiles,
  loadQuickOpenFiles,
  mergeQuickOpenFiles,
  openQuickOpenFile,
  rankQuickOpenFiles,
  type QuickOpenFile,
} from './quickOpenFiles'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

function entry(path: string): QuickOpenFile {
  return {
    id: `path:${path}`,
    name: path.split('/').pop()!,
    path,
    relativePath: path.replace('/workspace/', ''),
    ext: path.split('.').pop(),
  }
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useRecentFilesStore.setState({ rootPath: '/workspace', entries: [], restoring: false })
  useEditorStore.setState({
    folderData: [{ id: 'root', kind: 'dir', name: 'workspace', path: '/workspace', children: [] }],
    opened: [],
    activeId: undefined,
    activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
})

describe('Quick Open file inventory', () => {
  it('scans names only with user exclusions and includes files from unopened directories', async () => {
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          name: 'notes',
          path: '/workspace/notes',
          relative_path: 'notes',
          is_folder: true,
          ext: '',
        },
        {
          name: 'note.md',
          path: '/workspace/notes/note.md',
          relative_path: 'notes/note.md',
          is_folder: false,
          ext: 'md',
        },
        {
          name: 'config.json',
          path: '/workspace/config.json',
          relative_path: 'config.json',
          is_folder: false,
          ext: 'json',
        },
      ],
    })

    const files = await loadQuickOpenFiles('/workspace', 'node_modules/\n*.tmp')

    expect(invoke).toHaveBeenCalledExactlyOnceWith('search_files_async', {
      query: { dir: '/workspace', name_text: '.*', contents_text: '' },
      options: { file_exclude_patterns: 'node_modules/\n*.tmp' },
    })
    expect(files.map((file) => file.relativePath)).toEqual(['notes/note.md', 'config.json'])
    expect(getFileObjectByPath('/workspace/notes/note.md')).toBeUndefined()
  })

  it('keeps opened and untitled files available without a workspace, excluding empty tabs', () => {
    const file = createFile({ name: 'Draft.md', content: 'unsaved' })
    const empty = createFile({ name: 'New Tab', kind: 'new_tab' })
    useEditorStore.setState({ opened: [empty.id, file.id], activeId: file.id, folderData: [] })

    expect(getOpenedQuickOpenFiles()).toEqual([
      expect.objectContaining({ fileId: file.id, name: 'Draft.md', path: undefined }),
    ])
    expect(invoke).not.toHaveBeenCalled()
  })

  it('deduplicates an opened file against the scan without losing its unsaved identity', () => {
    const file = createFile({ name: 'note.md', path: '/workspace/note.md', content: 'unsaved' })
    useEditorStore.setState({ opened: [file.id], activeId: file.id })
    const files = mergeQuickOpenFiles(getOpenedQuickOpenFiles('/workspace'), [entry(file.path!)])

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: file.id, relativePath: 'note.md' })
    expect(getFileObject(file.id).content).toBe('unsaved')
  })

  it('does not treat a sibling directory as a workspace child', () => {
    const file = createFile({ name: 'note.md', path: '/workspace-other/note.md' })
    useEditorStore.setState({ opened: [file.id] })
    expect(getOpenedQuickOpenFiles('/workspace')[0].relativePath).toBe('/workspace-other/note.md')
  })

  it('builds closed history without scanning or caching file contents and reuses open identities', () => {
    const open = createFile({ name: 'A.md', path: '/workspace/A.md', content: 'unsaved' })
    useEditorStore.setState({ opened: [open.id], activeId: open.id })
    useRecentFilesStore
      .getState()
      .replaceEntries([{ path: '/workspace/closed/B.md' }, { path: open.path! }])
    const history = getRecentQuickOpenFiles('/workspace')
    expect(history.map((file) => file.relativePath)).toEqual(['closed/B.md', 'A.md'])
    expect(history[0].fileId).toBeUndefined()
    expect(history[1].fileId).toBe(open.id)
    expect(getFileObjectByPath('/workspace/closed/B.md')).toBeUndefined()
    expect(invoke).not.toHaveBeenCalled()
    expect(getRecentQuickOpenFiles('/other')).toEqual([])
  })

  it('checks at most eight closed paths concurrently without deleting unavailable history', async () => {
    const closed = Array.from({ length: 20 }, (_, i) => entry(`/workspace/${i}.md`))
    const opened = createFile({ path: '/workspace/open.md', content: 'unsaved' })
    useEditorStore.setState({ opened: [opened.id], activeId: opened.id })
    useRecentFilesStore.getState().replaceEntries(closed.map((file) => ({ path: file.path! })))
    const history = useRecentFilesStore.getState().entries
    const pending: ((exists: boolean) => void)[] = []
    let concurrency = 0
    let maximum = 0
    vi.mocked(invoke).mockImplementation(async () => {
      concurrency++
      maximum = Math.max(maximum, concurrency)
      const exists = await new Promise<boolean>((resolve) => pending.push(resolve))
      concurrency--
      return exists
    })
    const unavailable = vi.fn()
    const check = checkRecentQuickOpenFiles(
      [...closed, ...getOpenedQuickOpenFiles('/workspace')],
      new AbortController().signal,
      unavailable,
    )
    expect(invoke).toHaveBeenCalledTimes(8)
    while (pending.length) {
      pending.splice(0).forEach((resolve) => resolve(false))
      await Promise.resolve()
      await Promise.resolve()
    }
    await check
    expect(maximum).toBe(8)
    expect(invoke).toHaveBeenCalledTimes(20)
    expect(unavailable).toHaveBeenCalledTimes(20)
    expect(useRecentFilesStore.getState().entries).toBe(history)
  })

  it('ignores late checks after cancellation and retains newly opened files', async () => {
    let resolve!: (exists: boolean) => void
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          resolve = done
        }),
    )
    const controller = new AbortController()
    const unavailable = vi.fn()
    const check = checkRecentQuickOpenFiles(
      [entry('/workspace/late.md')],
      controller.signal,
      unavailable,
    )
    controller.abort()
    resolve(false)
    await check
    expect(unavailable).not.toHaveBeenCalled()

    const reopened = checkRecentQuickOpenFiles(
      [entry('/workspace/late.md')],
      new AbortController().signal,
      unavailable,
    )
    openQuickOpenFile(entry('/workspace/late.md'))
    resolve(false)
    await reopened
    expect(unavailable).not.toHaveBeenCalled()
  })

  it('hides a failed existence check for the popup without erasing persistent history', async () => {
    useRecentFilesStore.getState().visit({ path: '/workspace/offline.md' })
    vi.mocked(invoke).mockRejectedValue(new Error('disconnected volume'))
    const unavailable = vi.fn()
    await checkRecentQuickOpenFiles(
      getRecentQuickOpenFiles('/workspace'),
      new AbortController().signal,
      unavailable,
    )
    expect(unavailable).toHaveBeenCalledWith('path:/workspace/offline.md')
    expect(useRecentFilesStore.getState().entries).toHaveLength(1)
  })
})

describe('Quick Open matching', () => {
  it('ranks an exact filename ahead of fuzzy matches and distinguishes duplicate names by path', () => {
    const files = [
      entry('/workspace/docs/README.md'),
      entry('/workspace/readMore.md'),
      entry('/workspace/README.md'),
    ]
    expect(rankQuickOpenFiles(files, 'readme.md').map((file) => file.relativePath)).toEqual([
      'docs/README.md',
      'README.md',
      'readMore.md',
    ])
    expect(rankQuickOpenFiles(files, 'docs/readme')[0].relativePath).toBe('docs/README.md')
    expect(rankQuickOpenFiles(files, 'rdm').length).toBeGreaterThan(0)
    expect(rankQuickOpenFiles(files, 'not-present')).toEqual([])
  })

  it('handles literal punctuation, CJK text and Windows path separators', () => {
    const files = [entry('/workspace/notes/计划[1].md'), entry('/workspace/notes/plan.md')]
    expect(rankQuickOpenFiles(files, '计划[1]')[0].name).toBe('计划[1].md')
    expect(rankQuickOpenFiles(files, 'notes\\plan')[0].name).toBe('plan.md')
  })

  it('uses score, recency, opened status and path in that order', () => {
    const exact = entry('/workspace/exact/note.md')
    const recent = entry('/workspace/recent/note.md')
    const fuzzy = entry('/workspace/northern-temperate.md')
    const open = { ...entry('/workspace/z/note.md'), fileId: 'open' }
    const another = entry('/workspace/a/note.md')
    const ranks = rankQuickOpenFiles([fuzzy, exact, another, open, recent], 'note.md', [
      fuzzy.id,
      recent.id,
    ])
    expect(ranks.map((file) => file.id)).toEqual([
      recent.id,
      open.id,
      another.id,
      exact.id,
      fuzzy.id,
    ])
  })
})

describe('opening a Quick Open result', () => {
  it('registers a lazy file once and lets TextEditor load its content', () => {
    const result = entry('/workspace/unopened/note.md')
    const file = openQuickOpenFile(result)!
    expect(useEditorStore.getState().activeId).toBe(file.id)
    expect(getFileObjectByPath(result.path)).toBe(file)
    expect(file).toMatchObject({ name: 'note.md', path: result.path, ext: 'md' })
    expect(invoke).not.toHaveBeenCalled()

    expect(openQuickOpenFile(result)?.id).toBe(file.id)
    expect(useEditorStore.getState().opened).toEqual([file.id])
  })

  it('retains unsaved content when selecting an already-open file', () => {
    const file = createFile({
      name: 'note.md',
      path: '/workspace/note.md',
      content: 'unsaved changes',
    })
    openQuickOpenFile(entry(file.path!))
    expect(useEditorStore.getState().activeId).toBe(file.id)
    expect(getFileObject(file.id)).toBe(file)
    expect(file.content).toBe('unsaved changes')
  })

  it('reuses a Windows file across casing and separator aliases', () => {
    const file = createFile({ name: 'Note.md', path: 'C:\\Workspace\\Note.md', content: 'unsaved' })
    expect(openQuickOpenFile(entry('c:/workspace/note.md'))?.id).toBe(file.id)
    expect(getFileObject(file.id).content).toBe('unsaved')
  })

  it('does not open a directory or recreate a closed untitled document', () => {
    createFile({ name: 'notes', path: '/workspace/notes', kind: 'dir' })
    expect(openQuickOpenFile(entry('/workspace/notes'))).toBeUndefined()
    expect(
      openQuickOpenFile({ id: 'file:missing', fileId: 'missing', name: 'Draft', relativePath: '' }),
    ).toBeUndefined()
    expect(useEditorStore.getState().opened).toEqual([])
  })
})
