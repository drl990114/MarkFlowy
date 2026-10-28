import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import useFileCacheStore, { getFileObject, setFileObject, setFileObjectByPath } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { releaseClosedFileContent } from './local-history'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
enableMapSet()
const id = 'lifetime-file'
const file = { id, name: 'note.md', path: '/workspace/note.md', kind: 'file' as const, content: 'unsaved' }

beforeEach(() => {
  useFileCacheStore.setState({ entries: {}, contentEntries: {}, pathEntries: {}, metadataRevision: 0 })
  setFileObject(id, file)
  setFileObjectByPath(file.path, file)
  fileSaveCoordinator.loadSnapshot(id, { status: 'success', content: 'disk', revision: 'disk:1' })
  fileSaveCoordinator.recordContent(id, file.content)
  useEditorStore.setState({ opened: [] })
  useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })
})
afterEach(async () => {
  await fileSaveCoordinator.releaseWhenIdle(id, () => true, () => {})
  useEditorStateStore.getState().delIdStateMap(id)
})

describe('file cache and real save coordinator lifetime', () => {
  it.each([false, true])('releases a replaced preview only after its last group closes (shared=%s)', async (shared) => {
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    setFileObject('next-preview', {
      id: 'next-preview', name: 'next.md', path: '/workspace/next.md', kind: 'file', content: 'next',
    })
    const left = { type: 'leaf' as const, id: 'left', opened: [id], activeId: id, previewId: id }
    useEditorStore.getState().setEditorLayout(shared ? {
      type: 'branch', id: 'root', direction: 'horizontal', sizes: [50, 50], children: [
        left, { type: 'leaf', id: 'right', opened: [id], activeId: id },
      ],
    } : left, 'left')
    expect(useEditorStore.getState().openFileInGroup('left', 'next-preview', { mode: 'preview' })).toBe(true)
    expect(await releaseClosedFileContent(id)).toBe(!shared)
    expect(getFileObject(id).content).toBe(shared ? 'unsaved' : undefined)
    if (shared) {
      useEditorStore.getState().closeFileInGroup('right', id)
      expect(await releaseClosedFileContent(id)).toBe(true)
      expect(getFileObject(id).content).toBeUndefined()
    }
  })

  it.each(['saved', 'failed', 'reopened'] as const)('handles a closed document while its save is %s', async (outcome) => {
    let finish!: (saved: boolean) => void
    const pending = new Promise<boolean>((resolve) => { finish = resolve })
    const write = fileSaveCoordinator.saveLatest(id, async () => pending, () => {
      useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    })
    const released = releaseClosedFileContent(id)
    await Promise.resolve()
    expect(getFileObject(id).content).toBe('unsaved')
    if (outcome === 'reopened') useEditorStore.setState({ opened: [id] })
    finish(outcome !== 'failed')
    await write
    expect(await released).toBe(outcome === 'saved')
    if (outcome === 'saved') {
      expect(getFileObject(id).content).toBeUndefined()
      expect(useFileCacheStore.getState().contentEntries[id]).toBeUndefined()
      expect(fileSaveCoordinator.getDiskRevision(id)).toBeUndefined()
      expect(useEditorStateStore.getState().idStateMap.has(id)).toBe(false)
    } else {
      expect(getFileObject(id).content).toBe('unsaved')
      expect(fileSaveCoordinator.getDiskRevision(id)).toBe('disk:1')
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(outcome === 'failed')
    }
  })
})
