import type { LazyStore } from '@tauri-apps/plugin-store'
import { isTauri } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { flushSync } from 'react-dom'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { getFileObject } from '@/helper/files'
import { logger } from '@/helper/logger'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import { pendingDraftSnapshot, waitForAllDraftRecovery } from './draftRecoveryState'
import { flushDraftProtection, protectedDraftDescriptor } from './local-history'
import { isPristineDocument } from './pristine-document'
import {
  draftManifestSchema, recoverySessionSchema, RELOAD_DOCUMENT_PREFIX,
  RELOAD_SESSION_KEY, SESSION_KEY_PREFIX,
  type DraftDocument, type DraftManifest, type DraftSession, type RecoveryDocument,
} from './draftSessionFormat'

export { draftSessionSchema, RELOAD_SESSION_KEY, SESSION_KEY_PREFIX } from './draftSessionFormat'
export type { DraftDocument, DraftSession } from './draftSessionFormat'
export type DraftSessionStore = Pick<LazyStore, 'entries' | 'set' | 'delete' | 'save'>

function captureDraftSession(): DraftSession {
  const editor = useEditorStore.getState()
  const documents = editor.opened.flatMap((id): DraftDocument[] => {
    const file = getFileObject(id)
    if (file?.kind === 'new_tab') return []
    if (!file) throw new Error('Could not read an open document.')
    // Flush deferred input before checking dirtiness, including source mode and RME.
    const content = editor.getEditorContent(id)
    if (isPristineDocument(id) && !file.path) return []
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
        format: fileSaveCoordinator.getPersistedFormat(id),
      },
    ]
  })
  return { version: 1, rootPath: editor.getRootPath(), documents, activeId: editor.activeId }
}

/** Never synchronously read a pending native body during beforeunload/pagehide. */
function captureReloadDocuments(): RecoveryDocument[] {
  const editor = useEditorStore.getState()
  return editor.opened.flatMap((id): RecoveryDocument[] => {
    const pending = pendingDraftSnapshot(id)
    if (pending) return [{ ...pending, id }]
    const file = getFileObject(id)
    if (file?.kind === 'new_tab') return []
    if (!file) throw new Error('Could not read an open document.')
    const content = editor.getEditorContent(id)
    if (isPristineDocument(id) && !file.path) return []
    if (file.path && !useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges) return []
    return [{
      id, name: file.name, path: file.path, ext: file.ext,
      diskRevision: fileSaveCoordinator.getDiskRevision(id),
      format: fileSaveCoordinator.getPersistedFormat(id), source: { kind: 'inline', content },
    }]
  })
}

export function removeReloadSnapshot(raw: string) {
  if (window.sessionStorage.getItem(RELOAD_SESSION_KEY) !== raw) return
  window.sessionStorage.removeItem(RELOAD_SESSION_KEY)
  pruneReloadBodies(raw, new Set())
}

function pruneReloadBodies(raw: string | null, retained: Set<string>) {
  if (!raw) return
  try {
    const parsed = recoverySessionSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.version !== 2) return
    for (const doc of parsed.data.documents)
      if (doc.source.kind === 'reload' && !retained.has(doc.source.key))
        window.sessionStorage.removeItem(doc.source.key)
  } catch (error) {
    // Garbage collection cannot invalidate the newly committed head.
    logger.error('Failed to remove obsolete reload bodies', error)
  }
}

function saveReloadSnapshot() {
  const editor = useEditorStore.getState()
  const previous = window.sessionStorage.getItem(RELOAD_SESSION_KEY)
  const created: string[] = []
  try {
    const documents = captureReloadDocuments().map((doc): DraftManifest['documents'][number] => {
      if (doc.source.kind !== 'inline') {
        if (doc.source.kind === 'reload' && window.sessionStorage.getItem(doc.source.key) === null)
          throw new Error('A pending reload body is unavailable.')
        return { ...doc, source: doc.source }
      }
      const key = `${RELOAD_DOCUMENT_PREFIX}${nanoid()}`
      window.sessionStorage.setItem(key, JSON.stringify(doc.source.content))
      created.push(key)
      return { ...doc, source: { kind: 'reload', key } }
    })
    // Immutable bodies first, then the small head. Quota/errors retain the old complete snapshot.
    const manifest: DraftManifest = { version: 2, rootPath: editor.getRootPath(), activeId: editor.activeId, documents }
    if (documents.length) window.sessionStorage.setItem(RELOAD_SESSION_KEY, JSON.stringify(draftManifestSchema.parse(manifest)))
    else window.sessionStorage.removeItem(RELOAD_SESSION_KEY)
    pruneReloadBodies(previous, new Set(documents.flatMap((doc) => doc.source.kind === 'reload' ? [doc.source.key] : [])))
  } catch (error) {
    for (const key of created) {
      try { window.sessionStorage.removeItem(key) } catch { /* Preserve the original failure. */ }
    }
    throw error
  }
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
      saveReloadSnapshot()
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

/** A durable head for a window session; native bodies stay in the draft database. */
export async function captureProtectedDraftSession(): Promise<DraftSession | DraftManifest> {
  await waitForAllDraftRecovery()
  const captured = captureDraftSession()
  await flushDraftProtection()
  if (!isTauri()) return captured
  return {
    ...captured, version: 2,
    documents: await Promise.all(captured.documents.map(async ({ content: _content, ...doc }) => ({
      ...doc, source: { kind: 'native' as const, draft: await protectedDraftDescriptor(doc.id) },
    }))),
  }
}

/** Save once on normal exit. Original files and their dirty state remain untouched. */
export async function closeWithDraftRecovery(
  cacheStore: DraftSessionStore | undefined,
  windowLabel: string,
  close: () => Promise<void>,
) {
  await waitForAllDraftRecovery()
  return savePathCoordinator.runExclusive(
    FILE_MUTATION_QUEUE_KEY,
    'window-close',
    async (lease) => {
      const captured = captureDraftSession()
      if (!cacheStore && captured.documents.length) throw new Error('Workspace cache is not ready.')
      // Publish before the read-only barrier discards deferred editor projections.
      flushSync(() => {
        lease.activate('window-close')
        lease.enableOtherEditorBarrier()
      })
      await flushDraftProtection()
      // Browser previews retain the self-contained legacy format. Native exits only
      // reference acknowledged SQLite drafts; no second copy of every body in the store.
      const session: DraftSession | DraftManifest = isTauri() ? {
        ...captured, version: 2,
        documents: await Promise.all(captured.documents.map(async ({ content: _content, ...doc }) => ({
          ...doc, source: { kind: 'native' as const, draft: await protectedDraftDescriptor(doc.id) },
        }))),
      } : captured
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
