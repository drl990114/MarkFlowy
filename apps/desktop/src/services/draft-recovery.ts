import type { LazyStore } from '@tauri-apps/plugin-store'
import { nanoid } from 'nanoid'
import { flushSync } from 'react-dom'
import { z } from 'zod'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import { markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  bindRecoveredDraft,
  draftProtectionStarted,
  flushDraftProtection,
  historyCall,
  historyWorkspace,
  isUntouchedRecoveredDraft,
  startDraftProtection,
  type PersistedDraft,
} from './local-history'

const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  path: z.string().optional(),
  ext: z.string().optional(),
  diskRevision: z.string().optional(),
})
const sessionSchema = z.object({
  version: z.literal(1),
  rootPath: z.string().optional(),
  documents: z.array(documentSchema),
  activeId: z.string().optional(),
})
export type DraftDocument = z.infer<typeof documentSchema>
export type DraftSession = z.infer<typeof sessionSchema>
export type DraftSessionStore = Pick<LazyStore, 'entries' | 'set' | 'delete' | 'save'>
const SESSION_KEY_PREFIX = 'draft-session:'
const RELOAD_SESSION_KEY = 'mf-draft-reload-v1'

function captureDraftSession(): DraftSession {
  const editor = useEditorStore.getState()
  const documents = editor.opened.flatMap((id): DraftDocument[] => {
    const file = getFileObject(id)
    if (file?.kind === 'new_tab') return []
    if (!file) throw new Error('Could not read an open document.')
    // Flush deferred input before checking dirtiness, including source mode and RME.
    const content = editor.getEditorContent(id)
    if (file.path && !useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges)
      return []
    return [
      {
        id,
        name: file.name,
        path: file.path,
        ext: file.ext,
        content,
        diskRevision: fileSaveCoordinator.getDiskRevision(id),
      },
    ]
  })
  return { version: 1, rootPath: editor.getRootPath(), documents, activeId: editor.activeId }
}

/** WebView reload does not request window close, and unload cannot await native store I/O. */
export function listenForDraftReload({
  canSave,
  onError,
}: {
  canSave: () => boolean
  onError: (error: unknown) => void
}) {
  const save = (event: Event) => {
    // A second reload during startup must retain the snapshot still being restored.
    if (!canSave()) return
    try {
      const session = captureDraftSession()
      if (session.documents.length) {
        window.sessionStorage.setItem(RELOAD_SESSION_KEY, JSON.stringify(session))
      } else {
        window.sessionStorage.removeItem(RELOAD_SESSION_KEY)
      }
    } catch (error) {
      if (event.type === 'beforeunload') event.preventDefault()
      onError(error)
    }
  }
  window.addEventListener('beforeunload', save)
  window.addEventListener('pagehide', save)
  return () => {
    window.removeEventListener('beforeunload', save)
    window.removeEventListener('pagehide', save)
  }
}

export async function restoreDraftDocuments(
  documents: DraftDocument[],
  activeId?: string,
  signal?: AbortSignal,
  preferExitSnapshot = false,
) {
  const restoredIds = new Map<string, string>()
  const previousActiveId = useEditorStore.getState().activeId
  const diskSnapshots = await Promise.all(
    documents.map(async (doc) =>
      doc.path ? readStableFileSnapshot(doc.path).catch(() => undefined) : undefined,
    ),
  )
  if (signal?.aborted) return
  documents.forEach((doc, index) => {
    const disk = diskSnapshots[index]
    let path = disk?.status === 'success' ? doc.path : undefined
    const existing = path ? getFileObjectByPath(path) : undefined
    // Keep both versions if the user has already edited this file during startup.
    if (
      existing &&
      useEditorStateStore.getState().idStateMap.get(existing.id)?.hasUnsavedChanges &&
      useEditorStore.getState().getEditorContent(existing.id) !== doc.content &&
      !(preferExitSnapshot && isUntouchedRecoveredDraft(existing.id))
    )
      path = undefined
    const file =
      path && existing
        ? updateFile({ id: existing.id, content: doc.content })
        : createFile({ name: doc.name, content: doc.content, path, ext: doc.ext ?? 'md' })
    const dirty = !path || disk?.status !== 'success' || disk.content !== doc.content
    fileSaveCoordinator.recordContent(file.id, doc.content)
    if (path && disk?.status === 'success') {
      if (doc.diskRevision || !dirty)
        fileSaveCoordinator.setDiskRevision(file.id, dirty ? doc.diskRevision! : disk.revision)
      if (dirty && disk.revision !== doc.diskRevision)
        markExternalFileConflict(file.id, disk.revision)
    }
    // Set this before opening: the editor must initialize from the draft, not reload the disk.
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: dirty })
    if (!useEditorStore.getState().opened.includes(file.id))
      useEditorStore.getState().addOpenedFile(file.id)
    restoredIds.set(doc.id, file.id)
  })
  const active =
    (activeId && restoredIds.get(activeId)) || previousActiveId || restoredIds.values().next().value
  if (active && active !== useEditorStore.getState().activeId)
    useEditorStore.getState().setActiveId(active)
  return restoredIds
}

export async function restoreBackgroundDrafts(signal?: AbortSignal) {
  if (!isTauri()) return 0
  try {
    const drafts = await historyCall<PersistedDraft[]>('recoveryDrafts', {
      workspace: historyWorkspace(),
      ownerPrefix: `${getCurrentWindow().label}:`,
    })
    if (historyWorkspace())
      drafts.push(
        ...(await historyCall<PersistedDraft[]>('recoveryDrafts', {
          workspace: '',
          ownerPrefix: `${getCurrentWindow().label}:`,
        })),
      )
    let count = 0
    for (const draft of drafts) {
      if (signal?.aborted) break
      const ids = await restoreDraftDocuments(
        [
          {
            id: draft.document.id,
            name: draft.document.name,
            path: draft.document.path ?? undefined,
            ext: draft.document.name.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? 'md',
            content: draft.content,
            diskRevision: draft.diskRevision,
          },
        ],
        undefined,
        signal,
      )
      const fileId = ids?.get(draft.document.id)
      if (fileId) {
        await bindRecoveredDraft(fileId, draft)
        count++
      }
    }
    return count
  } finally {
    await startDraftProtection()
  }
}

/** Only call during startup, not a workspace switch after a cancelled reload. */
export async function restoreDraftReloadSession(signal?: AbortSignal) {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_SESSION_KEY)
    if (raw) {
      const session = sessionSchema.parse(JSON.parse(raw))
      await restoreDraftDocuments(session.documents, session.activeId, signal, true)
      if (signal?.aborted) return 0
      await flushDraftProtection()
      if (!('__TAURI_INTERNALS__' in window) || draftProtectionStarted())
        window.sessionStorage.removeItem(RELOAD_SESSION_KEY)
      return session.documents.length
    }
  } catch (error) {
    // A denied sessionStorage must not block normal-exit recovery from the native store.
    logger.error('Failed to restore the reload draft snapshot', error)
  }
  return 0
}

/** Consume the previous normal-exit snapshot after its workspace has loaded. */
export async function restoreDraftSession(cacheStore: DraftSessionStore, signal?: AbortSignal) {
  const rootPath = useEditorStore.getState().getRootPath()
  let count = 0
  let consumed = false
  for (const [key, value] of await cacheStore.entries<unknown>()) {
    if (!key.startsWith(SESSION_KEY_PREFIX)) continue
    const parsed = sessionSchema.safeParse(value)
    if (!parsed.success) {
      logger.error('Unrecognized draft session retained', key)
      continue
    }
    const session = parsed.data
    if (session.rootPath && session.rootPath !== rootPath) continue
    await restoreDraftDocuments(session.documents, session.activeId, signal, true)
    if (signal?.aborted) return count
    await flushDraftProtection()
    if (!('__TAURI_INTERNALS__' in window) || draftProtectionStarted()) {
      await cacheStore.delete(key)
      consumed = true
    }
    count += session.documents.length
  }
  if (consumed) await cacheStore.save()
  return count
}

/** Save once on normal exit. Original files and their dirty state remain untouched. */
export function closeWithDraftRecovery(
  cacheStore: DraftSessionStore | undefined,
  windowLabel: string,
  close: () => Promise<void>,
) {
  return savePathCoordinator.runExclusive(
    FILE_MUTATION_QUEUE_KEY,
    'window-close',
    async (lease) => {
      const session = captureDraftSession()
      await flushDraftProtection()
      if (!cacheStore && session.documents.length) throw new Error('Workspace cache is not ready.')
      // Publish before the read-only barrier discards deferred editor projections.
      flushSync(() => {
        lease.activate('window-close')
        lease.enableOtherEditorBarrier()
      })
      // A fresh key also preserves an older session if startup could not read it.
      const key = `${SESSION_KEY_PREFIX}${windowLabel}:${nanoid()}`
      try {
        if (cacheStore) {
          await cacheStore.set(key, session)
          await cacheStore.save()
        }
        await close()
        return true
      } catch (error) {
        // The live window still owns these drafts after a failed/cancelled close.
        // Do not resurrect a stale copy if the user then saves or discards them.
        if (cacheStore) {
          await cacheStore
            .delete(key)
            .then(() => cacheStore.save())
            .catch((cleanupError) => {
              logger.error('Failed to remove cancelled exit snapshot', cleanupError)
            })
        }
        throw error
      }
    },
  )
}
