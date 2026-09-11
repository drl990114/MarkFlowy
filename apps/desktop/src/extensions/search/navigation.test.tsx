import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { enableMapSet } from 'immer'
import type { PropsWithChildren } from 'react'
import type { MfCodemirrorView } from 'rme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EditorViewType } from '@/constants/editorViewType'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, hydrateDirectoryEntries } from '@/helper/filesys'
import { closeEditorSearch, useEditorSearchStore } from '@/components/EditorArea/editorSearchStore'
import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { setSourceCodeEditor } from '@/components/EditorArea/sourceCodeEditorRegistry'
import { Search } from '.'
import { getSearchStore } from './useSearchStore'
const useSearchStore = getSearchStore('/workspace')

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}))
vi.mock('./styles', () => {
  const Box = ({ children, ...props }: PropsWithChildren) => <div {...props}>{children}</div>
  return {
    SearchContainer: Box,
    SearchInfoBox: Box,
    SearchInput: Box,
    SearchList: Box,
    SearchMeta: Box,
    SearchStateBox: Box,
  }
})
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 30,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 30,
        size: 30,
      })),
    scrollToIndex: vi.fn(),
  }),
}))
enableMapSet()
const originalEditorState = useEditorStore.getState()
const originalViewState = useEditorViewTypeStore.getState()
const originalCacheState = useFileCacheStore.getState()
const sources = new Map<string, EditorView>()
beforeEach(() => {
  useEditorStore.getState().setEditorLayout({ type: 'leaf', id: 'main', opened: [] }, 'main')
  useEditorStore.setState({
    folderData: [{ id: 'folder', path: '/workspace', name: 'workspace', kind: 'dir' }],
  })
})
afterEach(() => {
  cleanup()
  sources.forEach((cm, id) => {
    setSourceCodeEditor(id, undefined)
    cm.destroy()
  })
  sources.clear()
  useEditorStore.setState(originalEditorState, true)
  useEditorViewTypeStore.setState(originalViewState, true)
  useFileCacheStore.setState(originalCacheState, true)
  useSearchStore.setState({
    hasSearched: false,
    expandedPaths: {},
    searchKeyword: '',
    resultQuery: '',
    resultList: [],
    caseSensitive: false,
    resultCaseSensitive: false,
    activeIndex: 0,
    activeMatch: undefined,
  })
  closeEditorSearch()
  vi.clearAllMocks()
})

describe('global search result coordinates', () => {
  it('opens a result from an unexpanded directory and reuses its file identity when the tree loads later', async () => {
    const path = '/workspace/unexpanded/中文😀.md'
    useSearchStore.setState({ searchKeyword: 'foo' })
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          id: 'result',
          path,
          name: '中文😀.md',
          ext: 'md',
          is_folder: false,
          relative_path: 'unexpanded/中文😀.md',
          matches: [{ id: 'line', line: 4, content: '中文😀 foo foo' }],
        },
      ],
    })
    expect(getFileObjectByPath(path)).toBeUndefined()
    render(
      <TooltipProvider>
        {Search.components}
        <FindReplace />
      </TooltipProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'search.text' }))
    await waitFor(() => expect(document.querySelectorAll('button.search-info')).toHaveLength(2))
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('button.search-info')[1])

    const navigation = useEditorSearchStore.getState().navigation
    expect(navigation).toMatchObject({ path, line: 4, startColumn: 9, endColumn: 12 })
    const fileId = navigation!.fileId
    expect(useEditorStore.getState().activeId).toBe(fileId)
    expect(useEditorStore.getState().getGroup('main')?.opened).toEqual([fileId])
    expect(getFileObject(fileId)).toMatchObject({
      path,
      name: '中文😀.md',
      kind: 'file',
      ext: 'md',
    })
    expect(screen.queryByText('find_replace.navigation_stale')).toBeNull()
    expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual(['search_files_async'])

    // Complete editor readiness after clicking, then verify the actual selection.
    const cm = new EditorView({
      state: EditorState.create({ doc: '\n\n\n中文😀 foo foo' }),
      parent: document.body,
    })
    sources.set(fileId, cm)
    act(() => {
      useEditorViewTypeStore.getState().setEditorViewType(fileId, EditorViewType.SOURCECODE)
      setSourceCodeEditor(fileId, { cm, setSearchState: vi.fn() } as unknown as MfCodemirrorView)
    })
    await waitFor(() => expect(cm.state.selection.main.from).toBe(12))
    expect(cm.state.selection.main.to).toBe(15)

    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('button.search-info')[0])
    expect(useEditorSearchStore.getState().navigation?.fileId).toBe(fileId)
    await waitFor(() => expect(cm.state.selection.main.from).toBe(8))
    expect(useEditorStore.getState().getGroup('main')?.opened).toEqual([fileId])
    const [loaded] = hydrateDirectoryEntries([
      { name: '中文😀.md', path, kind: 'file', ext: 'md', children: null },
    ])
    expect(loaded.id).toBe(fileId)
  })

  it('reuses a loaded file across Windows path spelling without replacing unsaved content', async () => {
    const path = 'c:/workspace/notes/file.md'
    const existing = createFile({
      id: 'existing',
      path: 'C:\\Workspace\\Notes\\File.md',
      name: 'File.md',
      content: 'unsaved text',
    })
    useEditorStore.setState({
      folderData: [
        { id: 'root', path: 'C:\\Workspace', name: 'Workspace', kind: 'dir', children: [existing] },
      ],
    })
    getSearchStore('C:\\Workspace').setState({ searchKeyword: 'foo' })
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          id: 'result',
          path,
          name: 'file.md',
          ext: 'md',
          is_folder: false,
          relative_path: 'notes/file.md',
          matches: [{ id: 'line', line: 1, content: 'foo' }],
        },
      ],
    })
    render(<TooltipProvider>{Search.components}</TooltipProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'search.text' }))
    await waitFor(() => expect(document.querySelectorAll('button.search-info')).toHaveLength(1))
    fireEvent.click(document.querySelector<HTMLButtonElement>('button.search-info')!)
    expect(useEditorSearchStore.getState().navigation?.fileId).toBe(existing.id)
    expect(getFileObject(existing.id).content).toBe('unsaved text')
  })

  it('uses the executed literal query and UTF-16 occurrence instead of the result ordinal or later draft', async () => {
    const lineText = '中文😀 a.b aXb a.b'
    createFile({ id: 'first', path: '/first.md', name: 'first.md' })
    useEditorStore.setState({
      activeId: 'first',
      activeGroupId: 'main',
      folderData: [{ id: 'folder', path: '/workspace', name: 'workspace', kind: 'dir' }],
      addOpenedFile: vi.fn(),
      setActiveId: (activeId) => useEditorStore.setState({ activeId }),
    })
    useSearchStore.setState({ searchKeyword: ' a.b ', caseSensitive: true })
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          id: 'result',
          name: 'first.md',
          path: '/first.md',
          relative_path: 'first.md',
          ext: 'md',
          is_folder: false,
          matches: [{ id: 'line', line: 3, content: lineText + '\r' }],
        },
      ],
    })
    render(<TooltipProvider>{Search.components}</TooltipProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'search.text' }))
    await waitFor(() => expect(document.querySelectorAll('button.search-info')).toHaveLength(2))
    expect(vi.mocked(invoke).mock.calls[0][1]).toMatchObject({
      query: { contents_text: 'a\\.b' },
      options: { content_case_sensitive: true },
    })
    act(() => useSearchStore.setState({ searchKeyword: 'later draft', caseSensitive: false }))
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('button.search-info')[1])
    expect(getFileObjectByPath('/first.md')?.id).toBe('first')
    expect(useEditorSearchStore.getState().navigation).toMatchObject({
      fileId: 'first',
      groupId: 'main',
      path: '/first.md',
      query: 'a.b',
      caseSensitive: true,
      line: 3,
      lineText,
      startColumn: lineText.lastIndexOf('a.b'),
      endColumn: lineText.length,
    })
    expect(useSearchStore.getState().activeIndex).toBe(1)
    act(() => useEditorSearchStore.setState({ owner: 'document', query: 'kept' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'search.text' }), {
      target: { value: 'new global query' },
    })
    expect(useEditorSearchStore.getState().owner).toBe('document')
    expect(useEditorSearchStore.getState().query).toBe('kept')
  })
})

describe('search session recovery', () => {
  it('restores the selected occurrence by coordinates when preceding results have changed', async () => {
    const file = createFile({ name: 'note.md', path: '/workspace/note.md', ext: 'md' })
    useEditorStore.getState().addOpenedFile(file.id)
    useEditorStore.getState().setActiveId(file.id)
    useSearchStore.setState({
      searchKeyword: 'foo',
      hasSearched: true,
      activeIndex: 4,
      activeMatch: { path: file.path!, line: 8, startColumn: 4 },
    })
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          id: 'new-file-id',
          path: file.path,
          name: 'note.md',
          ext: 'md',
          is_folder: false,
          relative_path: 'note.md',
          matches: [{ id: 'new-line-id', line: 8, content: 'foo foo' }],
        },
      ],
    })
    render(<TooltipProvider>{Search.components}</TooltipProvider>)
    await waitFor(() => expect(document.querySelectorAll('button.search-info')).toHaveLength(2))
    expect(useSearchStore.getState().activeIndex).toBe(1)
    expect(document.querySelectorAll('button.search-info')[1].getAttribute('aria-current')).toBe(
      'true',
    )
    expect(useEditorSearchStore.getState().navigation).toBeNull()
  })

  it('requeries a restored search and keeps collapsed files despite new result IDs', async () => {
    useSearchStore.setState({
      searchKeyword: 'foo',
      hasSearched: true,
      expandedPaths: { '/workspace/note.md': false },
    })
    vi.mocked(invoke).mockResolvedValue({
      data: [
        {
          id: 'new-result-id',
          path: '/workspace/note.md',
          name: 'note.md',
          ext: 'md',
          is_folder: false,
          relative_path: 'note.md',
          matches: [{ id: 'new-match-id', line: 1, content: 'foo' }],
        },
      ],
    })
    render(<TooltipProvider>{Search.components}</TooltipProvider>)
    await waitFor(() => expect(document.querySelector('.search-info__path')).toBeTruthy())
    expect(invoke).toHaveBeenCalledWith(
      'search_files_async',
      expect.objectContaining({ query: expect.objectContaining({ contents_text: 'foo' }) }),
    )
    expect(document.querySelector('.search-info__path')?.getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(document.querySelectorAll('button.search-info')).toHaveLength(0)
  })

  it('discards a pending response after leaving the workspace', async () => {
    useSearchStore.setState({ searchKeyword: 'foo', hasSearched: true })
    let resolve!: (value: { data: unknown[] }) => void
    vi.mocked(invoke).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    render(<TooltipProvider>{Search.components}</TooltipProvider>)
    act(() =>
      useEditorStore.setState({
        folderData: [{ id: 'other', kind: 'dir', path: '/other', name: 'Other' }],
      }),
    )
    await act(async () => resolve({ data: [{ id: 'old' }] }))
    expect(getSearchStore('/other').getState().resultList).toEqual([])
    expect(useSearchStore.getState().resultList).toEqual([])
  })
})
