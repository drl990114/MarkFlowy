import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFileObject, setFileObject } from '@/helper/files'
import type { EditorDelegate } from 'rme'
import useEditorStore, { type EditorLayoutNode } from './useEditorStore'

vi.mock('@/helper/filesys', () => ({
  createFile: vi.fn(),
  getFolderPathFromPath: (path: string) => path.replace(/[\\/][^\\/]+$/, ''),
  isMdFile: (name?: string) => !!name?.endsWith('.md'),
  releaseSecurityScope: vi.fn(),
}))

vi.mock('@/services/editor-file', () => ({
  isEmptyEditor: () => false,
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
