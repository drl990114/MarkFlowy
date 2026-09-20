import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { debounce } from 'lodash'
import { create } from 'zustand'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { getFileObject } from '@/helper/files'
import { getPathIdentityKey, rebaseFilePath } from '@/helper/pathIdentity'
import { logger } from '@/helper/logger'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface HistoryDocument {
  id: string
  workspace: string
  path?: string | null
  name: string
  generation: number
}
export interface HistoryEntry {
  id: string
  documentId: string
  name: string
  path?: string
  kind: string
  message: string
  createdAt: number
  updatedAt: number
  active: boolean
  beforeHash?: string
  afterHash: string
}
export interface PersistedDraft {
  document: HistoryDocument
  writer: string
  sequence: number
  content: string
  diskRevision?: string
  paused: boolean
}
export interface HistoryStats {
  count: number
  reclaimableBytes: number
  enabled: boolean
  usedBytes?: number
  budgetBytes?: number
  budgetLimited?: boolean
}
export interface HistorySession {
  sessionId: string
  documentId: string
  state: 'active' | 'committed' | 'interrupted' | 'invalidated'
  versionId?: string
  result?: { code: string; versionId?: string; sha256: string; message: string }
}

export const historyCall = <T>(operation: string, payload: object = {}): Promise<T> =>
  invoke<T>('local_history', { operation, payload })

export const historyWorkspace = () => {
  const root = useEditorStore.getState().getRootPath()
  return root ? getPathIdentityKey(root) : ''
}
export const historyWorkspaceForPath = (path?: string) => {
  const root = useEditorStore.getState().getRootPath()
  return root && (!path || rebaseFilePath(path, root, root) !== undefined)
    ? getPathIdentityKey(root)
    : ''
}

interface ProtectionState {
  status: Record<string, 'pending' | 'protected' | 'failed'>
  paused: Record<string, boolean>
  revision: number
}
export const useHistoryProtection = create<ProtectionState>(() => ({
  status: {},
  paused: {},
  revision: 0,
}))
const bindings = new Map<
  string,
  {
    document: Promise<HistoryDocument>
    writer: string
    sequence: number
    editing: boolean
    checkpoint: number
    path?: string
    recoveredAtEdit?: number
  }
>()
const tasks = new Map<string, ReturnType<typeof debounce>>()
const tails = new Map<string, Promise<void>>()
const captures = new Map<string, { pending: boolean; promise: Promise<void> }>()
const edits = new Map<string, number>()
let sequence = Date.now() * 1000
let started = false
export const draftProtectionStarted = () => started

function status(id: string, value: ProtectionState['status'][string]) {
  useHistoryProtection.setState((s) => ({ status: { ...s.status, [id]: value } }))
}

export function historyChanged() {
  useHistoryProtection.setState((s) => ({ revision: s.revision + 1 }))
}

export function historyDocument(fileId: string): Promise<HistoryDocument> {
  const file = getFileObject(fileId)
  if (!file) return Promise.reject(new Error('Document is no longer open.'))
  const existing = bindings.get(fileId)
  if (existing && existing.path === file.path) return existing.document
  let document = historyCall<HistoryDocument>('register', {
    identity: file.path ? getPathIdentityKey(file.path) : `untitled:${fileId}`,
    workspace: historyWorkspaceForPath(file.path),
    path: file.path,
    name: file.name,
  })
  if (existing && existing.path !== file.path) {
    document = document.then(async (next) => {
      const old = await existing.document
      if (old.id !== next.id) {
        const seq = ++sequence
        const content = useEditorStore.getState().getEditorContent(fileId)
        if (useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges) {
          await historyCall('draft', {
            document: next,
            writer: existing.writer,
            sequence: seq,
            content,
            diskRevision: fileSaveCoordinator.getDiskRevision(fileId),
            paused: isHistoryAutosavePaused(fileId),
          })
        }
        await historyCall('finishDraft', {
          documentId: old.id,
          writer: existing.writer,
          sequence: seq,
        })
        await historyCall('presence', { documentId: old.id, owner: existing.writer, dirty: false })
      }
      return next
    })
  }
  const binding = {
    document,
    writer: `${getCurrentWindow().label}:${fileId}`,
    sequence: ++sequence,
    editing: false,
    checkpoint: 0,
    path: file.path,
  }
  bindings.set(fileId, binding)
  void document.catch(() => {
    if (bindings.get(fileId) === binding) bindings.delete(fileId)
  })
  return document
}

function queue(fileId: string, run: () => Promise<void>): Promise<void> {
  const task = (tails.get(fileId) ?? Promise.resolve()).catch(() => undefined).then(run)
  tails.set(fileId, task)
  void task
    .finally(() => {
      if (tails.get(fileId) === task) tails.delete(fileId)
    })
    .catch(() => undefined)
  return task
}

async function capture(fileId: string) {
  const seq = ++sequence
  const edit = edits.get(fileId)
  const file = getFileObject(fileId)
  if (!file || file.kind === 'new_tab') return
  const content = useEditorStore.getState().getEditorContent(fileId)
  const dirty =
    !file.path || useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges
  const document = await historyDocument(fileId)
  const binding = bindings.get(fileId)!
  binding.sequence = seq
  const paused = Boolean(useHistoryProtection.getState().paused[fileId])
  if (!dirty) {
    await historyCall('finishDraft', {
      documentId: document.id,
      writer: binding.writer,
      sequence: seq,
    })
    await historyCall('presence', { documentId: document.id, owner: binding.writer, dirty: false })
    return
  }
  const result = await historyCall<{ persisted: boolean }>('draft', {
    document,
    writer: binding.writer,
    sequence: seq,
    content,
    diskRevision: fileSaveCoordinator.getDiskRevision(fileId),
    paused,
  })
  if (!result.persisted)
    throw new Error('A newer draft already exists; this snapshot was not acknowledged.')
  if (binding.sequence === seq && edits.get(fileId) === edit) status(fileId, 'protected')
  if (Date.now() - binding.checkpoint > 60_000 && binding.editing) {
    binding.checkpoint = Date.now()
    await historyCall('checkpoint', { document, content, kind: 'checkpoint' }).catch((error) =>
      logger.error('History checkpoint failed', error),
    )
  }
}

function captureLatest(fileId: string): Promise<void> {
  const existing = captures.get(fileId)
  if (existing) {
    existing.pending = true
    return existing.promise
  }
  const state = { pending: true, promise: Promise.resolve() }
  state.promise = queue(fileId, async () => {
    while (state.pending) {
      state.pending = false
      await capture(fileId)
    }
  }).finally(() => {
    if (captures.get(fileId) === state) captures.delete(fileId)
  })
  captures.set(fileId, state)
  return state.promise
}

/** Called by the host editor's actual input path, never by external synchronization. */
export function protectLocalEdit(fileId: string) {
  if (!started) return
  edits.set(fileId, (edits.get(fileId) ?? 0) + 1)
  status(fileId, 'pending')
  void historyDocument(fileId)
    .then((document) => {
      const binding = bindings.get(fileId)!
      if (!binding.editing) {
        binding.editing = true
        return queue(fileId, async () => {
          await historyCall('presence', {
            documentId: document.id,
            owner: binding.writer,
            dirty: true,
          })
          await historyCall('boundary', { document })
        })
      }
    })
    .catch((error) => {
      status(fileId, 'failed')
      logger.error('History boundary failed', error)
    })
  let task = tasks.get(fileId)
  if (!task) {
    task = debounce(
      () => {
        void captureLatest(fileId).catch((error) => {
          status(fileId, 'failed')
          logger.error('Draft protection failed', error)
        })
      },
      1000,
      { maxWait: 5000 },
    )
    tasks.set(fileId, task)
  }
  task()
}

export async function flushDraftProtection(fileId?: string) {
  if (!started) return
  const ids = fileId ? [fileId] : useEditorStore.getState().opened
  for (let start = 0; start < ids.length; start += 4) {
    await Promise.all(
      ids.slice(start, start + 4).map((id) => {
        tasks.get(id)?.cancel()
        return captureLatest(id)
      }),
    )
  }
}

export async function protectExternalContent(fileId: string, before: string, after: string) {
  if (!started || before === after) return
  const document = await historyDocument(fileId)
  await historyCall('external', { document, before, after })
  const binding = bindings.get(fileId)
  if (binding) binding.editing = false
  historyChanged()
}

export function isHistoryAutosavePaused(fileId: string) {
  return !!useHistoryProtection.getState().paused[fileId]
}

export async function endHistoryBatch(fileId: string) {
  if (!started) return
  const document = await historyDocument(fileId)
  await historyCall('boundary', { document })
  const binding = bindings.get(fileId)
  if (binding) binding.editing = false
}
export function pauseHistoryAutosave(fileId: string, paused: boolean) {
  useHistoryProtection.setState((s) => ({ paused: { ...s.paused, [fileId]: paused } }))
}

export function historyFileSaved(fileId: string) {
  if (!started) return
  pauseHistoryAutosave(fileId, false)
  const binding = bindings.get(fileId)
  if (binding) binding.editing = false
  if (binding)
    void binding.document
      .then((doc) =>
        historyCall('presence', { documentId: doc.id, owner: binding.writer, dirty: false }),
      )
      .catch((error) => logger.error('Failed to update draft ownership', error))
  void flushDraftProtection(fileId).catch((error) =>
    logger.error('Failed to retire saved draft', error),
  )
  historyChanged()
}

export async function bindRecoveredDraft(fileId: string, draft: PersistedDraft) {
  const file = getFileObject(fileId)
  // Missing files and divergent drafts become independent documents, not aliases.
  if (draft.document.path && !file?.path) {
    const document = await historyCall<HistoryDocument>('register', {
      identity: `untitled:${fileId}`,
      workspace: historyWorkspace(),
      name: file.name,
    })
    const migrated = {
      ...draft,
      document,
      writer: `${getCurrentWindow().label}:${fileId}`,
      sequence: ++sequence,
    }
    await historyCall('draft', migrated)
    await historyCall('finishDraft', {
      documentId: draft.document.id,
      writer: draft.writer,
      sequence: ++sequence,
    })
    await historyCall('presence', {
      documentId: draft.document.id,
      owner: draft.writer,
      dirty: false,
    })
    draft = migrated
  }
  const previous = bindings.get(fileId)
  if (previous && previous.writer !== draft.writer) {
    const seq = ++sequence
    void queue(fileId, async () => {
      const doc = await previous.document
      await historyCall('finishDraft', {
        documentId: doc.id,
        writer: previous.writer,
        sequence: seq,
      })
      await historyCall('presence', { documentId: doc.id, owner: previous.writer, dirty: false })
    }).catch((error) => logger.error('Failed to retire migrated draft', error))
  }
  bindings.set(fileId, {
    document: Promise.resolve(draft.document),
    writer: draft.writer,
    sequence: draft.sequence,
    editing: false,
    checkpoint: Date.now(),
    path: getFileObject(fileId)?.path,
    recoveredAtEdit: edits.get(fileId) ?? 0,
  })
  sequence = Math.max(sequence, draft.sequence)
  pauseHistoryAutosave(fileId, draft.paused)
  status(fileId, 'protected')
}

export function isUntouchedRecoveredDraft(fileId: string) {
  const binding = bindings.get(fileId)
  return (
    binding?.recoveredAtEdit !== undefined && binding.recoveredAtEdit === (edits.get(fileId) ?? 0)
  )
}

export function historyDraftIdentity(fileId: string) {
  const binding = bindings.get(fileId)
  if (!binding) throw new Error('History document is not registered.')
  return { writer: binding.writer, sequence: ++sequence }
}

export async function startDraftProtection() {
  if (started || !isTauri()) return
  started = true
  await listen<{ operation?: string }>('local-history-changed', (event) => {
    // Refresh handles only for subsequent actions; in-flight actions retain their stale generation.
    for (const binding of bindings.values()) {
      if (event.payload?.operation === 'clear' || event.payload?.operation === 'enabled') {
        binding.editing = false
        binding.checkpoint = Date.now()
      }
      binding.document = binding.document.then((doc) =>
        historyCall<HistoryDocument>('document', { id: doc.id }),
      )
    }
    historyChanged()
  }).catch((error) => {
    started = false
    throw error
  })
  window.addEventListener('blur', () => {
    void flushDraftProtection().catch((error) => logger.error('Draft flush failed', error))
  })
  useEditorStore.subscribe((state, previous) => {
    if (
      state.activeId !== previous.activeId &&
      previous.activeId &&
      state.opened.includes(previous.activeId)
    ) {
      void flushDraftProtection(previous.activeId).catch((error) =>
        logger.error('Draft flush failed', error),
      )
    }
    for (const id of state.opened) {
      if (
        !previous.opened.includes(id) &&
        getFileObject(id)?.kind !== 'new_tab' &&
        !getFileObject(id)?.path
      )
        protectLocalEdit(id)
    }
    for (const id of previous.opened) {
      if (state.opened.includes(id)) continue
      tasks.get(id)?.cancel()
      tasks.delete(id)
      const binding = bindings.get(id)
      if (!binding) continue
      const seq = ++sequence
      const pending = captures.get(id)
      if (pending) pending.pending = false
      void queue(id, async () => {
        const document = await binding.document
        await historyCall('finishDraft', {
          documentId: document.id,
          writer: binding.writer,
          sequence: seq,
        })
        await historyCall('presence', {
          documentId: document.id,
          owner: binding.writer,
          dirty: false,
        })
        if (!useEditorStore.getState().opened.includes(id) && bindings.get(id) === binding) {
          bindings.delete(id)
          edits.delete(id)
        }
      }).catch((error) => logger.error('Failed to close draft', error))
    }
  })
  for (const id of useEditorStore.getState().opened) {
    const file = getFileObject(id)
    if (
      file?.kind !== 'new_tab' &&
      (!file?.path || useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges)
    )
      protectLocalEdit(id)
    else if (
      file?.path &&
      fileSaveCoordinator.getDiskRevision(id) &&
      typeof file.content === 'string'
    )
      void observeHistoryFile(id, file.content).catch((error) =>
        logger.error('History baseline failed', error),
      )
  }
}

export async function observeHistoryFile(fileId: string, content: string) {
  if (!started) return
  const document = await historyDocument(fileId)
  await historyCall('observe', { document, content })
}

export async function protectDiscard(fileIds: string[]) {
  if (!started) return
  for (const fileId of fileIds) {
    const content = useEditorStore.getState().getEditorContent(fileId)
    const document = await historyDocument(fileId)
    await historyCall('checkpoint', { document, content, kind: 'discard' })
  }
}
