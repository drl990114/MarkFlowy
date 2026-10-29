import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'zens'
import { setFileObject, deleteFileObject } from '@/helper/files'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { beginDraftRecoveryDiscovery } from '@/services/draftRecoveryState'
import useAppSettingStore from './useAppSettingStore'
import useEditorStateStore from './useEditorStateStore'
import useEditorViewTypeStore from './useEditorViewTypeStore'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorStore, { type EditorLayoutNode } from './useEditorStore'

vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/helper/filesys', () => ({ releaseSecurityScope: vi.fn() }))
vi.mock('@/services/editor-file', () => ({ isEmptyEditor: (id: string) => id === 'empty' }))
enableMapSet()

const cleanups: (() => void)[] = []
const store = () => useEditorStore.getState()
const group = (id = 'left') => store().getGroup(id)!
const open = (id: string, mode: 'preview' | 'permanent' = 'preview', groupId = 'left') =>
  store().openFileInGroup(groupId, id, { mode })
const setLayout = (layout: EditorLayoutNode) => store().setEditorLayout(layout, 'left')
const dirty = (id: string, value = true) =>
  useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: value })

function reader(flush: () => boolean, canRead = () => true) {
  let pending = true
  cleanups.push(editorSnapshotRegistry.register('a', 'preview-test', {
    canRead,
    flush: () => {
      const result = flush()
      if (result) pending = false
      return result
    },
    hasPending: () => pending,
    isVisible: () => true,
    onSyncDemandChanged: () => {},
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppSettingStore.setState({ settingData: {} })
  useEditorStateStore.setState({ idStateMap: new Map() })
  for (const id of ['a', 'b', 'c', 'd']) {
    setFileObject(id, { id, kind: 'file', name: `${id}.md`, path: `/workspace/${id}.md`, content: id })
  }
  setLayout({ type: 'leaf', id: 'left', opened: [] })
})

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  for (const id of ['a', 'b', 'c', 'd', 'draft']) deleteFileObject(id)
})

describe('preview tab opening', () => {
  it('replaces only the preview slot and preserves ordinary tabs and their order', () => {
    open('a', 'permanent')
    open('b')
    open('c', 'permanent')
    open('d')
    expect(group()).toMatchObject({ opened: ['a', 'd', 'c'], activeId: 'd', previewId: 'd' })
    expect(store().opened).toEqual(['a', 'd', 'c'])
  })

  it('browses many files in one slot without replacing a single-file pane', () => {
    setLayout({ type: 'branch', id: 'root', direction: 'horizontal', sizes: [40, 60], children: [
      { type: 'leaf', id: 'left', opened: ['a'], activeId: 'a', previewId: 'a' },
      { type: 'leaf', id: 'right', opened: ['d'], activeId: 'd' },
    ] })
    open('b')
    open('c')
    expect(group()).toMatchObject({ opened: ['c'], previewId: 'c' })
    expect(store().editorLayout).toMatchObject({ type: 'branch', sizes: [40, 60] })
    expect(group('right').opened).toEqual(['d'])
  })

  it('activates existing tabs without downgrading ordinary tabs or replacing another preview', () => {
    open('a', 'permanent')
    open('b')
    open('a')
    expect(group()).toMatchObject({ opened: ['a', 'b'], activeId: 'a', previewId: 'b' })
    store().openFileInGroup('left', 'b')
    expect(group().previewId).toBe('b')
    open('b')
    expect(group().opened).toEqual(['a', 'b'])
    open('b', 'permanent')
    expect(group().previewId).toBeUndefined()
    open('c')
    expect(group().opened).toEqual(['a', 'b', 'c'])
  })

  it('keeps an explicitly retained tab in place, without activating it', () => {
    open('a')
    open('b', 'permanent')
    store().keepFileOpen('left', 'a')
    expect(group()).toMatchObject({ opened: ['a', 'b'], activeId: 'b' })
    expect(group().previewId).toBeUndefined()
    open('c')
    expect(group().opened).toEqual(['a', 'b', 'c'])
  })

  it('opens unnamed drafts and dirty documents permanently', () => {
    setFileObject('draft', { id: 'draft', kind: 'file', name: 'Untitled', content: '' })
    open('draft')
    dirty('a')
    open('a')
    expect(group().previewId).toBeUndefined()
    open('b')
    expect(group().opened).toEqual(['draft', 'a', 'b'])
  })

  it('uses the existing empty placeholder slot', () => {
    setLayout({ type: 'leaf', id: 'left', opened: ['empty'], activeId: 'empty' })
    open('a')
    expect(group()).toMatchObject({ opened: ['a'], previewId: 'a' })
  })
})

describe('preview content protection', () => {
  it('waits for draft discovery before replacing a restored preview, while allowing explicit opens', () => {
    open('a')
    const finish = beginDraftRecoveryDiscovery()
    cleanups.push(finish)
    expect(open('b')).toBe(false)
    expect(group()).toMatchObject({ opened: ['a'], previewId: 'a' })
    expect(open('c', 'permanent')).toBe(true)
    expect(group()).toMatchObject({ opened: ['a', 'c'], previewId: 'a' })
    finish()
    expect(open('b')).toBe(true)
    expect(group()).toMatchObject({ opened: ['b', 'c'], previewId: 'b' })
  })

  it('promotes all instances synchronously and never demotes after save or undo', () => {
    setLayout({ type: 'branch', id: 'root', direction: 'horizontal', sizes: [50, 50], children: [
      { type: 'leaf', id: 'left', opened: ['a'], activeId: 'a', previewId: 'a' },
      { type: 'leaf', id: 'right', opened: ['a'], activeId: 'a', previewId: 'a' },
    ] })
    dirty('a')
    expect(group().previewId).toBeUndefined()
    expect(group('right').previewId).toBeUndefined()
    dirty('a', false)
    open('b')
    expect(group().opened).toEqual(['a', 'b'])
    expect(group('right').opened).toEqual(['a'])
  })

  it('reads a pending snapshot and rebases a synchronous dirty promotion before opening', () => {
    open('a')
    const flush = vi.fn(() => { dirty('a'); return true })
    reader(flush)
    expect(open('b')).toBe(true)
    expect(flush).toHaveBeenCalledOnce()
    expect(group()).toMatchObject({ opened: ['a', 'b'], previewId: 'b' })
  })

  it.each(['composition', 'read failure'])('preserves the entire layout on %s', (failure) => {
    open('a')
    reader(() => failure !== 'read failure', () => failure !== 'composition')
    const before = store()
    expect(open('b')).toBe(false)
    expect(store()).toBe(before)
    expect(toast.error).toHaveBeenCalledOnce()
  })

  it('does not replace a newer open made during snapshot publication', () => {
    open('a')
    reader(() => { open('c', 'permanent'); return true })
    expect(open('b')).toBe(false)
    expect(group()).toMatchObject({ opened: ['a', 'c'], activeId: 'c', previewId: 'a' })
  })

  it('does not apply a pending open to another workspace', () => {
    open('a')
    reader(() => { store().setFolderData(null); return true })
    expect(open('b')).toBe(false)
    expect(store().opened).toEqual([])
  })

  it('does not overwrite legacy navigation that mutates the previous leaf during a flush', () => {
    open('a')
    open('c', 'permanent')
    store().setActiveId('a')
    reader(() => { store().setActiveId('c'); return true })
    expect(open('b')).toBe(false)
    expect(group()).toMatchObject({ opened: ['a', 'c'], activeId: 'c', previewId: 'a' })
  })
})

describe('preview lifecycle', () => {
  it('promotes current previews immediately when settings change, including synchronized changes', () => {
    open('a')
    useAppSettingStore.getState().setSettingData({ editor_enable_preview_tabs: false })
    expect(group().previewId).toBeUndefined()
    open('b')
    expect(group()).toMatchObject({ opened: ['a', 'b'] })
    expect(group().previewId).toBeUndefined()
    useAppSettingStore.getState().setSettingData({ editor_enable_preview_tabs: true })
    open('c')
    expect(group()).toMatchObject({ opened: ['a', 'b', 'c'], previewId: 'c' })
  })

  it('normalizes invalid, disabled and dirty restored previews', () => {
    const layout = { type: 'leaf' as const, id: 'left', opened: ['a'], activeId: 'a', previewId: 'missing' }
    setLayout(layout)
    expect(group().previewId).toBeUndefined()
    dirty('a')
    setLayout({ ...layout, previewId: 'a' })
    expect(group().previewId).toBeUndefined()
    dirty('a', false)
    useAppSettingStore.getState().setSettingData({ editor_enable_preview_tabs: false })
    setLayout({ ...layout, previewId: 'a' })
    expect(group().previewId).toBeUndefined()
  })

  it('retains the moved tab without displacing the destination preview', () => {
    setLayout({ type: 'branch', id: 'root', direction: 'horizontal', sizes: [50, 50], children: [
      { type: 'leaf', id: 'left', opened: ['a', 'c'], activeId: 'a', previewId: 'a' },
      { type: 'leaf', id: 'right', opened: ['b'], activeId: 'b', previewId: 'b' },
    ] })
    store().moveFileToGroup('left', 'right', 'a')
    expect(group().previewId).toBeUndefined()
    expect(group('right')).toMatchObject({ opened: ['b', 'a'], previewId: 'b' })
    open('d', 'preview', 'right')
    expect(group('right').opened).toEqual(['d', 'a'])
  })

  it('retains a reordered preview and both instances when splitting a preview', () => {
    open('a', 'permanent')
    open('b')
    store().moveFileToGroup('left', 'left', 'b', 0)
    expect(group().previewId).toBeUndefined()
    open('c')
    const nextGroup = store().splitGroup('left', 'horizontal')!
    expect(group().previewId).toBeUndefined()
    expect(group(nextGroup)).toMatchObject({ opened: ['c'], activeId: 'c' })
    expect(group(nextGroup).previewId).toBeUndefined()
  })

  it('clears the preview reference when its last tab closes', () => {
    open('a')
    store().closeFileInGroup('left', 'a')
    expect(group().opened).toEqual([])
    expect(group().previewId).toBeUndefined()
  })
})

describe('pane view mode lifecycle', () => {
  it('retains modes through layout remounts and clears a hidden tab or closed group without an editor instance', () => {
    open('a', 'permanent')
    open('b', 'permanent')
    const modes = useEditorViewTypeStore.getState()
    modes.setEditorViewType('a', EditorViewType.WYSIWYG, 'left')
    modes.setEditorViewType('b', EditorViewType.PREVIEW, 'left')
    const right = store().splitGroup('left', 'horizontal')!
    modes.setEditorViewType('b', EditorViewType.SOURCECODE, right)
    expect(modes.getEditorViewType('a', 'left')).toBe(EditorViewType.WYSIWYG)
    expect(modes.getEditorViewType('b', 'left')).toBe(EditorViewType.PREVIEW)
    store().closeFileInGroup('left', 'a')
    expect(useEditorViewTypeStore.getState().editorGroupViewTypeMap.get('left')?.has('a')).toBe(false)
    store().closeGroup(right)
    expect(useEditorViewTypeStore.getState().editorGroupViewTypeMap.has(right)).toBe(false)
    expect(modes.getEditorViewType('b', 'left')).toBe(EditorViewType.PREVIEW)
    setLayout({ type: 'leaf', id: 'restored', opened: ['c'], activeId: 'c' })
    expect(useEditorViewTypeStore.getState().editorGroupViewTypeMap.size).toBe(0)
  })
})
