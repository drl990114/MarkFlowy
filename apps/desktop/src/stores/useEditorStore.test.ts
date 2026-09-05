import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFileObject, getFileObject, setFileObject } from '@/helper/files'
import type { EditorDelegate } from 'rme'
import useEditorStore, { type EditorLayoutNode } from './useEditorStore'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { finishEditorOpenMeasurement, getEditorOpenMeasurement } from '@/components/EditorArea/editorPerformanceDiagnostics'
import { toast } from 'zens'
import { isEmptyEditor } from '@/services/editor-file'

vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

vi.mock('@/helper/filesys', () => ({
  createFile: vi.fn(),
  getFolderPathFromPath: (path: string) => path.replace(/[\\/][^\\/]+$/, ''),
  isMdFile: (name?: string) => !!name?.endsWith('.md'),
  releaseSecurityScope: vi.fn(),
}))

vi.mock('@/services/editor-file', () => ({
  isEmptyEditor: vi.fn(() => false),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const root = () => ({
  id: 'root',
  name: 'workspace',
  kind: 'dir' as const,
  path: '/workspace',
  children: [
    {
      id: 'target-old',
      name: 'target.md',
      kind: 'file' as const,
      path: '/workspace/target.md',
      content: 'old',
    },
  ],
})

const splitLayout = (): EditorLayoutNode => ({
  type: 'branch',
  id: 'layout',
  direction: 'horizontal',
  sizes: [50, 50],
  children: [
    {
      type: 'leaf',
      id: 'source-group',
      opened: ['source'],
      activeId: 'source',
    },
    {
      type: 'leaf',
      id: 'target-group',
      opened: ['target-old', 'other'],
      activeId: 'target-old',
    },
  ],
})

const tabLayout = (): EditorLayoutNode => ({
  type: 'leaf',
  id: 'tab-group',
  opened: ['a', 'b', 'c', 'd'],
  activeId: 'a',
})

describe('useEditorStore open measurement identity', () => {
  afterEach(() => {
    for (const sample of window.__MF_EDITOR_PERFORMANCE__?.opens ?? []) {
      finishEditorOpenMeasurement(sample.openRequestId, 'canceled')
    }
    window.localStorage.removeItem('mf:editor-performance')
    delete window.__MF_EDITOR_PERFORMANCE__
    vi.mocked(isEmptyEditor).mockReturnValue(false)
  })

  it.each(['setActiveId', 'openFileInGroup'] as const)('uses the actual fallback group for %s', (method) => {
    window.localStorage.setItem('mf:editor-performance', '1')
    useEditorStore.setState({ editorLayout: tabLayout(), activeGroupId: 'missing', activeId: 'a', opened: ['a', 'b', 'c', 'd'] })
    if (method === 'setActiveId') useEditorStore.getState().setActiveId('b')
    else useEditorStore.getState().openFileInGroup('missing', 'b')
    expect(getEditorOpenMeasurement('b', 'missing')).toBeUndefined()
    expect(getEditorOpenMeasurement('b', 'tab-group')).toBeDefined()
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens).toHaveLength(1)
    finishEditorOpenMeasurement(getEditorOpenMeasurement('b', 'tab-group'), 'ready')
  })

  it('starts exactly one command trace when an open replaces the empty tab', () => {
    window.localStorage.setItem('mf:editor-performance', '1')
    vi.mocked(isEmptyEditor).mockImplementation((id) => id === 'empty')
    useEditorStore.setState({
      editorLayout: { type: 'leaf', id: 'tab-group', opened: ['empty'], activeId: 'empty' },
      activeGroupId: 'tab-group', activeId: 'empty', opened: ['empty'],
    })
    useEditorStore.getState().addOpenedFile('new-file')
    useEditorStore.getState().setActiveId('new-file')
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens).toHaveLength(1)
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens?.[0]).toMatchObject({
      fileId: 'new-file', viewId: 'tab-group', origin: 'command', kind: 'open',
    })
  })
})

describe('useEditorStore.moveFileToGroup', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeGroupId: 'tab-group',
      activeId: 'a',
      editorLayout: tabLayout(),
      opened: ['a', 'b', 'c', 'd'],
    })
  })

  it('reorders a tab into an insertion slot in the same group', () => {
    useEditorStore.getState().moveFileToGroup('tab-group', 'tab-group', 'b', 3)

    expect(useEditorStore.getState().getGroup('tab-group')).toMatchObject({
      opened: ['a', 'c', 'b', 'd'],
      activeId: 'b',
    })
  })

  it('moves a tab left and keeps drops beside itself stable', () => {
    const editorStore = useEditorStore.getState()
    editorStore.moveFileToGroup('tab-group', 'tab-group', 'c', 0)
    expect(useEditorStore.getState().getGroup('tab-group')?.opened).toEqual([
      'c',
      'a',
      'b',
      'd',
    ])

    useEditorStore.getState().moveFileToGroup('tab-group', 'tab-group', 'c', 1)
    expect(useEditorStore.getState().getGroup('tab-group')?.opened).toEqual([
      'c',
      'a',
      'b',
      'd',
    ])
  })

  it('inserts a moved tab at the requested position in another group', () => {
    useEditorStore.setState({
      activeGroupId: 'source-group',
      activeId: 'source',
      editorLayout: splitLayout(),
      opened: ['source', 'target-old', 'other'],
    })

    useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source', 1)

    expect(useEditorStore.getState().getGroup('target-group')).toMatchObject({
      opened: ['target-old', 'source', 'other'],
      activeId: 'source',
    })
  })
})

describe('useEditorStore layout remount snapshots', () => {
  const unregisterReaders: (() => void)[] = []
  const registerReader = (fileId: string, options: { composing?: boolean; failed?: boolean } = {}) => {
    const state = { composing: false, failed: false, pending: true, ...options }
    const flush = vi.fn(() => {
      if (state.failed) return false
      setFileObject(fileId, {
        id: fileId, name: `${fileId}.md`, kind: 'file', content: `latest ${fileId} 中文`,
      })
      state.pending = false
      return true
    })
    unregisterReaders.push(editorSnapshotRegistry.register(fileId, `layout-${fileId}`, {
      canRead: () => !state.composing,
      hasPending: () => state.pending,
      flush,
      isVisible: () => false,
      onSyncDemandChanged: () => {},
    }))
    return { state, flush }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.setState({
      activeGroupId: 'source-group', activeId: 'source',
      editorLayout: splitLayout(), opened: ['source', 'target-old', 'other'],
    })
  })

  afterEach(() => {
    unregisterReaders.splice(0).forEach((unregister) => unregister())
  })

  it('keeps same-group reordering lightweight even while composing', () => {
    useEditorStore.setState({
      activeGroupId: 'tab-group', activeId: 'a',
      editorLayout: tabLayout(), opened: ['a', 'b', 'c', 'd'],
    })
    const reader = registerReader('b', { composing: true })

    useEditorStore.getState().moveFileToGroup('tab-group', 'tab-group', 'b', 3)

    expect(useEditorStore.getState().getGroup('tab-group')?.opened).toEqual(['a', 'c', 'b', 'd'])
    expect(reader.flush).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('preserves the entire layout after a failed moved-file read and publishes before a successful retry', () => {
    const reader = registerReader('source', { failed: true })
    const before = useEditorStore.getState()
    useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source', 1)

    expect(useEditorStore.getState()).toBe(before)
    expect(reader.state.pending).toBe(true)
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not read'))

    reader.state.failed = false
    const contentsAtRemount: (string | undefined)[] = []
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.editorLayout !== before.editorLayout) {
        contentsAtRemount.push(getFileObject('source')?.content)
      }
    })
    try {
      useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source', 1)
      expect(contentsAtRemount).toEqual(['latest source 中文'])
      expect(useEditorStore.getState().getGroup('target-group')?.opened).toEqual([
        'target-old', 'source', 'other',
      ])
      expect(reader.state.pending).toBe(false)
    } finally {
      unsubscribe()
    }
  })

  it('protects surviving hidden tabs when moving the last tab collapses a branch', () => {
    const reader = registerReader('other', { composing: true })
    const before = useEditorStore.getState()

    useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source')

    expect(useEditorStore.getState()).toBe(before)
    expect(reader.flush).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Finish composing'))
  })

  it('does not read unrelated composing groups when a cross-group move preserves their ancestry', () => {
    const layout = splitLayout()
    if (layout.type !== 'branch' || layout.children[0].type !== 'leaf') throw new Error('fixture')
    layout.children[0].opened.push('keep-source-group')
    useEditorStore.setState({ editorLayout: layout, opened: ['source', 'keep-source-group', 'target-old', 'other'] })
    const moved = registerReader('source')
    const unrelated = registerReader('other', { composing: true })

    useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source')

    expect(useEditorStore.getState().getGroup('source-group')?.opened).toEqual(['keep-source-group'])
    expect(moved.flush).toHaveBeenCalledOnce()
    expect(unrelated.flush).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('blocks splitting a clean active tab while a hidden source tab is composing, then catches up before remount', () => {
    useEditorStore.setState({
      activeGroupId: 'tab-group', activeId: 'a',
      editorLayout: tabLayout(), opened: ['a', 'b', 'c', 'd'],
    })
    const hidden = registerReader('d', { composing: true })
    const before = useEditorStore.getState()

    expect(useEditorStore.getState().splitGroup('tab-group', 'vertical')).toBeUndefined()
    expect(useEditorStore.getState()).toBe(before)
    expect(hidden.flush).not.toHaveBeenCalled()

    hidden.state.composing = false
    const newGroup = useEditorStore.getState().splitGroup('tab-group', 'vertical')
    expect(newGroup).toBeTypeOf('string')
    expect(useEditorStore.getState().getGroup(newGroup!)?.opened).toEqual(['a'])
    expect(getFileObject('d')?.content).toBe('latest d 中文')
    expect(hidden.flush).toHaveBeenCalledOnce()
  })

  it.each([
    ['closing its last tab', () => useEditorStore.getState().closeFileInGroup('source-group', 'source')],
    ['closing all its tabs', () => useEditorStore.getState().closeAllFilesInGroup('source-group')],
    ['closing the group', () => useEditorStore.getState().closeGroup('source-group')],
    ['closing the file globally', () => useEditorStore.getState().delOpenedFile('source')],
  ])('protects survivors when %s collapses their ancestor, without reading the discarded file', (_name, close) => {
    const discarded = registerReader('source', { composing: true })
    const survivor = registerReader('other', { composing: true })
    const before = useEditorStore.getState()

    close()

    expect(useEditorStore.getState()).toBe(before)
    expect(discarded.flush).not.toHaveBeenCalled()
    expect(survivor.flush).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Finish composing'))

    survivor.state.composing = false
    close()

    expect(useEditorStore.getState().editorLayout.type).toBe('leaf')
    expect(useEditorStore.getState().opened).toEqual(['target-old', 'other'])
    expect(getFileObject('other')?.content).toBe('latest other 中文')
    expect(survivor.flush).toHaveBeenCalledOnce()
    expect(discarded.flush).not.toHaveBeenCalled()
  })

  it('does not overwrite a newer layout selected by a synchronous publication subscriber', () => {
    const replacement = tabLayout()
    unregisterReaders.push(editorSnapshotRegistry.register('source', 'reentrant-layout', {
      canRead: () => true,
      hasPending: () => useEditorStore.getState().editorLayout !== replacement,
      flush: () => {
        useEditorStore.setState({ editorLayout: replacement, activeGroupId: 'tab-group', activeId: 'a' })
        return true
      },
      isVisible: () => true,
      onSyncDemandChanged: () => {},
    }))

    useEditorStore.getState().moveFileToGroup('source-group', 'target-group', 'source')

    expect(useEditorStore.getState().editorLayout).toBe(replacement)
    expect(useEditorStore.getState().activeGroupId).toBe('tab-group')
  })
})

describe('useEditorStore.insertNodeToFolderData', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeGroupId: 'source-group',
      activeId: 'source',
      editorLayout: splitLayout(),
      folderData: [root()],
      opened: ['source', 'target-old', 'other'],
    })
  })

  it('replaces a conflicting tree id and removes that id from every editor group', () => {
    useEditorStore.getState().insertNodeToFolderData({
      id: 'source',
      name: 'target.md',
      kind: 'file',
      path: '/workspace/target.md',
      content: 'new',
    })

    expect(useEditorStore.getState().getFileNodeByPath('/workspace/target.md')).toMatchObject({
      id: 'source',
      content: 'new',
    })
    expect(useEditorStore.getState().opened).toEqual(['source', 'other'])
    expect(useEditorStore.getState().activeGroupId).toBe('source-group')
    expect(useEditorStore.getState().activeId).toBe('source')
    expect(useEditorStore.getState().getGroup('source-group')).toMatchObject({
      opened: ['source'],
      activeId: 'source',
    })
    expect(useEditorStore.getState().getGroup('target-group')).toMatchObject({
      opened: ['other'],
      activeId: 'other',
    })
  })

  it('updates the same tree id without closing its tab', () => {
    useEditorStore.getState().insertNodeToFolderData({
      id: 'target-old',
      name: 'target.md',
      kind: 'file',
      path: '/workspace/target.md',
      content: 'updated',
    })

    expect(useEditorStore.getState().opened).toEqual(['source', 'target-old', 'other'])
    expect(useEditorStore.getState().getGroup('target-group')).toMatchObject({
      opened: ['target-old', 'other'],
      activeId: 'target-old',
    })
  })

  it('inserts a new path without changing the editor layout', () => {
    const layoutBefore = useEditorStore.getState().editorLayout

    useEditorStore.getState().insertNodeToFolderData({
      id: 'new',
      name: 'new.md',
      kind: 'file',
      path: '/workspace/new.md',
      content: '',
    })

    expect(useEditorStore.getState().getFileNodeByPath('/workspace/new.md')?.id).toBe('new')
    expect(useEditorStore.getState().editorLayout).toBe(layoutBefore)
    expect(useEditorStore.getState().opened).toEqual(['source', 'target-old', 'other'])
  })

  it('replaces a physical-path alias by id when parent path casing differs', () => {
    useEditorStore.getState().insertNodeToFolderData(
      {
        id: 'source',
        name: 'TARGET.md',
        kind: 'file',
        path: '/WORKSPACE/TARGET.md',
        content: 'new',
      },
      ['target-old'],
    )

    expect(useEditorStore.getState().folderData?.[0].children).toEqual([
      expect.objectContaining({
        id: 'source',
        path: '/WORKSPACE/TARGET.md',
      }),
    ])
    expect(useEditorStore.getState().opened).toEqual(['source', 'other'])
  })
})

describe('useEditorStore.getEditorContent', () => {
  const fileId = 'preview-file'

  beforeEach(() => {
    deleteFileObject(fileId)
    setFileObject(fileId, {
      id: fileId,
      name: 'preview.md',
      kind: 'file',
      path: '/workspace/preview.md',
      content: 'cached markdown',
    })
    useEditorStore.setState({
      editorCtxMap: new Map(),
      editorDelegateMap: new Map(),
    })
  })

  it('returns cached Markdown when Preview has no mounted delegate', () => {
    expect(useEditorStore.getState().getEditorContent(fileId)).toBe('cached markdown')
  })

  it('flushes the live Capricorn reader before returning cache and never falls back after failure', () => {
    let pending = true
    let readable = false
    const flush = vi.fn(() => {
      if (!readable) return false
      setFileObject(fileId, {
        id: fileId, name: 'preview.md', kind: 'file', path: '/workspace/preview.md',
        content: 'latest 中文',
      })
      pending = false
      return true
    })
    const unregister = editorSnapshotRegistry.register(fileId, 'runtime', {
      canRead: () => true,
      flush,
      hasPending: () => pending,
      isVisible: () => true,
      onSyncDemandChanged: () => {},
    })
    try {
      expect(() => useEditorStore.getState().getEditorContent(fileId)).toThrow('Could not read')
      expect(pending).toBe(true)
      readable = true
      expect(useEditorStore.getState().getEditorContent(fileId)).toBe('latest 中文')
      expect(pending).toBe(false)
      expect(flush).toHaveBeenCalledTimes(2)
    } finally {
      unregister()
    }
  })

  it('does not read state from an unmounted delegate', () => {
    const getState = vi.fn(() => {
      throw new Error('manager phase error')
    })
    const delegate = {
      manager: { getState, mounted: false },
      docToString: vi.fn(),
      stringToDoc: vi.fn(),
      view: 'Wysiwyg',
    } as unknown as EditorDelegate
    useEditorStore.getState().setEditorDelegate(fileId, delegate)

    expect(useEditorStore.getState().getEditorContent(fileId)).toBe('cached markdown')
    expect(getState).not.toHaveBeenCalled()
  })

  it('prefers live content from a mounted editor delegate', () => {
    const doc = {}
    const docToString = vi.fn(() => 'live markdown')
    const delegate = {
      manager: {
        mounted: true,
        view: { state: { doc } },
      },
      docToString,
      stringToDoc: vi.fn(),
      view: 'Wysiwyg',
    } as unknown as EditorDelegate
    useEditorStore.getState().setEditorDelegate(fileId, delegate)

    expect(useEditorStore.getState().getEditorContent(fileId)).toBe('live markdown')
    expect(docToString).toHaveBeenCalledWith(doc)
  })
})
