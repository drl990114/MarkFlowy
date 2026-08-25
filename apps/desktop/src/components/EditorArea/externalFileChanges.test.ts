import bus from '@/helper/eventBus'
import { deleteFileObject, getFileObject, setFileObject } from '@/helper/files'
import { FileResultCode, type IFile } from '@/helper/filesys'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useExternalFileChangeStore, {
  isExternalFileSaveBlocked,
} from '@/stores/useExternalFileChangeStore'
import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXTERNAL_FILE_CONTENT_SYNC_EVENT,
  EXTERNAL_FILE_NOTICE_DURATION_MS,
  handleExternalWatchEvent,
  markExternalFileConflict,
  resetExternalFileChanges,
  resolveExternalFileChange,
  type ExternalFileContentSyncPayload,
} from './externalFileChanges'
import { fileSaveCoordinator } from './fileSaveCoordinator'

enableMapSet()

const invoke = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('zens', () => ({
  toast: {
    error: vi.fn(),
  },
}))

const fileId = 'file'
const filePath = '/workspace/note.md'

const createFile = (content: string): IFile => ({
  content,
  ext: 'md',
  id: fileId,
  kind: 'file',
  name: 'note.md',
  path: filePath,
})

function mockStableDisk(content: string, revision: string) {
  invoke.mockImplementation(async (command: string) => {
    if (command === 'get_file_write_revision') return revision
    if (command === 'get_file_content') {
      return { code: FileResultCode.Success, content }
    }
    throw new Error(`Unexpected command: ${command}`)
  })
}

async function emitChange() {
  await handleExternalWatchEvent({
    attrs: {},
    paths: [filePath],
    type: 'any',
  })
}

describe('external file changes', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    invoke.mockReset()
    resetExternalFileChanges()
    deleteFileObject(fileId)
    useEditorStore.setState({ opened: [fileId] })
    useEditorStateStore.getState().delIdStateMap(fileId)
    await fileSaveCoordinator.releaseWhenIdle(fileId, () => true, () => undefined)
    setFileObject(fileId, createFile('local'))
    fileSaveCoordinator.recordContent(fileId, 'local')
    fileSaveCoordinator.setDiskRevision(fileId, 'disk:old')
  })

  afterEach(() => {
    resetExternalFileChanges()
    vi.useRealTimers()
  })

  it('auto-loads a stable external update for a clean editor and clears its notice after 3s', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: false })
    mockStableDisk('external', 'disk:new')
    const contentSync = vi.fn<(payload: ExternalFileContentSyncPayload) => void>()
    bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, contentSync)

    await emitChange()

    expect(getFileObject(fileId).content).toBe('external')
    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:new')
    expect(contentSync).toHaveBeenCalledWith({ content: 'external', fileId })
    expect(useExternalFileChangeStore.getState().notices[fileId]).toMatchObject({
      kind: 'updated',
      status: 'reloaded',
    })

    vi.advanceTimersByTime(EXTERNAL_FILE_NOTICE_DURATION_MS)
    expect(useExternalFileChangeStore.getState().notices[fileId]).toBeUndefined()
    bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, contentSync)
  })

  it('keeps local content and exposes a persistent conflict for a dirty editor', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    mockStableDisk('external', 'disk:new')

    await emitChange()

    expect(getFileObject(fileId).content).toBe('local')
    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:old')
    expect(useExternalFileChangeStore.getState().notices[fileId]).toEqual({
      diskRevision: 'disk:new',
      kind: 'conflict',
    })
    expect(isExternalFileSaveBlocked(fileId)).toBe(true)

    mockStableDisk('newer external', 'disk:newer')
    await emitChange()
    expect(getFileObject(fileId).content).toBe('local')
    expect(useExternalFileChangeStore.getState().notices[fileId]).toEqual({
      diskRevision: 'disk:newer',
      kind: 'conflict',
    })

    vi.advanceTimersByTime(EXTERNAL_FILE_NOTICE_DURATION_MS * 2)
    expect(useExternalFileChangeStore.getState().notices[fileId]?.kind).toBe('conflict')
  })

  it('loads the newest disk snapshot when the user chooses Update', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    markExternalFileConflict(fileId, 'disk:noticed')
    mockStableDisk('newest external', 'disk:newest')

    await resolveExternalFileChange(fileId, 'reload')

    expect(getFileObject(fileId).content).toBe('newest external')
    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:newest')
    expect(useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges).toBe(false)
    expect(isExternalFileSaveBlocked(fileId)).toBe(false)
  })

  it('conditionally overwrites the newest disk revision with current local content', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    markExternalFileConflict(fileId, 'disk:noticed')
    invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'get_file_write_revision') return 'disk:newest'
      if (command === 'get_file_content') {
        return { code: FileResultCode.Success, content: 'external' }
      }
      if (command === 'conditional_write_file') {
        expect(args).toMatchObject({
          content: 'local',
          expectedRevision: 'disk:newest',
          filePath,
        })
        return { revision: 'disk:written', status: 'success' }
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    await resolveExternalFileChange(fileId, 'overwrite')

    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:written')
    expect(useExternalFileChangeStore.getState().notices[fileId]).toMatchObject({
      kind: 'updated',
      status: 'overwritten',
    })
  })

  it('does not overwrite when the disk changes again during conflict resolution', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    markExternalFileConflict(fileId, 'disk:noticed')
    invoke.mockImplementation(async (command: string) => {
      if (command === 'get_file_write_revision') return 'disk:newest'
      if (command === 'get_file_content') {
        return { code: FileResultCode.Success, content: 'external' }
      }
      if (command === 'conditional_write_file') {
        return { revision: 'disk:changed-again', status: 'conflict' }
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    await resolveExternalFileChange(fileId, 'overwrite')

    expect(getFileObject(fileId).content).toBe('local')
    expect(useExternalFileChangeStore.getState().notices[fileId]).toEqual({
      diskRevision: 'disk:changed-again',
      kind: 'conflict',
    })
  })
})
