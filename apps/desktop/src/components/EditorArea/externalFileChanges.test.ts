import { DEFAULT_TEXT_METADATA } from './textFileFormat'
import bus from '@/helper/eventBus'
import useFileCacheStore, { deleteFileObject, getFileObject, setFileObject } from '@/helper/files'
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
import { editorSnapshotRegistry } from './editorSnapshotRegistry'

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
    if (command === 'get_file_snapshot') {
      return { status: 'success', content, revision }
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
    await fileSaveCoordinator.releaseWhenIdle(
      fileId,
      () => true,
      () => undefined,
    )
    setFileObject(fileId, createFile('local'))
    fileSaveCoordinator.recordContent(fileId, 'local')
    fileSaveCoordinator.setDiskRevision(fileId, 'disk:old')
  })

  afterEach(() => {
    resetExternalFileChanges()
    vi.useRealTimers()
  })

  it('ignores unrelated cached paths and coalesces duplicate events for an open document', async () => {
    const previous = useFileCacheStore.getState()
    const readClosedPath = vi.fn(() => '/workspace/closed.md')
    const closed = { ...createFile('closed'), id: 'closed' }
    Object.defineProperty(closed, 'path', { get: readClosedPath })
    useFileCacheStore.setState({ entries: { ...previous.entries, closed } })
    mockStableDisk('local', 'disk:old')
    try {
      await handleExternalWatchEvent({
        attrs: {},
        paths: ['/workspace/closed.md', '/workspace/unrelated.md', filePath, filePath],
        type: 'any',
      })
      expect(readClosedPath).not.toHaveBeenCalled()
      expect(invoke).toHaveBeenCalledExactlyOnceWith('get_file_snapshot', { filePath })
    } finally {
      useFileCacheStore.setState(previous)
    }
  })

  it('keeps a format-only local edit dirty when external text is identical', async () => {
    fileSaveCoordinator.loadSnapshot(fileId, {
      content: 'local',
      revision: 'disk:old',
      status: 'success',
      text: DEFAULT_TEXT_METADATA,
    })
    fileSaveCoordinator.recordFormat(fileId, { encoding: 'utf-16le', bom: 'utf16le' })
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    invoke.mockResolvedValue({
      content: 'local',
      revision: 'disk:new',
      status: 'success',
      text: DEFAULT_TEXT_METADATA,
    })
    await emitChange()
    expect(useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges).toBe(true)
    expect(fileSaveCoordinator.getTextMetadata(fileId).format.encoding).toBe('utf-16le')
    expect(isExternalFileSaveBlocked(fileId)).toBe(true)
  })

  it('adopts an external BOM-only change when the document is clean', async () => {
    fileSaveCoordinator.loadSnapshot(fileId, {
      content: 'local',
      revision: 'disk:old',
      status: 'success',
      text: DEFAULT_TEXT_METADATA,
    })
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: false })
    invoke.mockResolvedValue({
      content: 'local',
      revision: 'disk:new',
      status: 'success',
      text: { ...DEFAULT_TEXT_METADATA, format: { encoding: 'utf-8', bom: 'utf8' } },
    })
    await emitChange()
    expect(fileSaveCoordinator.getTextMetadata(fileId).format.bom).toBe('utf8')
    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:new')
    expect(isExternalFileSaveBlocked(fileId)).toBe(false)
  })

  it('coalesces a thousand notifications while a read is in flight', async () => {
    let finishRead!: (value: unknown) => void
    let reads = 0
    invoke.mockImplementation(async (command: string) => {
      if (command !== 'get_file_snapshot') throw new Error(command)
      reads++
      if (reads === 1)
        return new Promise((resolve) => {
          finishRead = resolve
        })
      return { status: 'success', content: 'final', revision: 'disk:final' }
    })
    const first = emitChange()
    await vi.advanceTimersByTimeAsync(0)
    const pending = Array.from({ length: 1000 }, () => emitChange())
    finishRead({ status: 'success', content: 'intermediate', revision: 'disk:middle' })
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.all([first, ...pending])
    expect(reads).toBe(2)
    expect(getFileObject(fileId).content).toBe('final')
  })

  it('auto-loads a stable external update for a clean editor and clears its notice after 3s', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: false })
    mockStableDisk('external', 'disk:new')
    const contentSync = vi.fn<(payload: ExternalFileContentSyncPayload) => void>()
    bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, contentSync)

    await emitChange()

    expect(getFileObject(fileId).content).toBe('external')
    expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:new')
    expect(invoke).toHaveBeenCalledExactlyOnceWith('get_file_snapshot', { filePath })
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

  it('protects local content when the live reader cannot publish during composition', async () => {
    useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
    mockStableDisk('external', 'disk:new')
    const unregister = editorSnapshotRegistry.register(fileId, 'composing', {
      canRead: () => false,
      flush: vi.fn(() => false),
      hasPending: () => true,
      isVisible: () => true,
      onSyncDemandChanged: () => {},
    })
    try {
      await emitChange()
      expect(getFileObject(fileId).content).toBe('local')
      expect(useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges).toBe(true)
      expect(useExternalFileChangeStore.getState().notices[fileId]).toMatchObject({
        kind: 'conflict',
        diskRevision: 'disk:new',
      })
    } finally {
      unregister()
    }
  })

  it.each([FileResultCode.NotFound, FileResultCode.PermissionDenied])(
    'preserves local state when an external %s snapshot is unavailable',
    async (code) => {
      useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
      invoke.mockResolvedValue({
        status: 'unavailable',
        result: { code, content: '' },
      })

      const inspection = emitChange()
      await vi.advanceTimersByTimeAsync(3000)
      await inspection

      expect(getFileObject(fileId).content).toBe('local')
      expect(fileSaveCoordinator.getDiskRevision(fileId)).toBe('disk:old')
      expect(useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges).toBe(true)
      expect(useExternalFileChangeStore.getState().notices[fileId]).toBeUndefined()
    },
  )

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
      if (command === 'get_file_snapshot') {
        return { status: 'success', content: 'external', revision: 'disk:newest' }
      }
      if (command === 'conditional_write_file') {
        expect(args).toMatchObject({
          content: 'local',
          expectedRevision: 'disk:newest',
          historyKind: 'overwrite',
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
      if (command === 'get_file_snapshot') {
        return { status: 'success', content: 'external', revision: 'disk:newest' }
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
