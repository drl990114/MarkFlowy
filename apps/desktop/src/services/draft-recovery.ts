import type { LazyStore } from '@tauri-apps/plugin-store'
import { nanoid } from 'nanoid'
import { flushSync } from 'react-dom'
import { z } from 'zod'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { getFileObject } from '@/helper/files'
import { logger } from '@/helper/logger'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import { waitForAllDraftRecovery } from './draftRecoveryState'
import { flushDraftProtection } from './local-history'

const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  path: z.string().optional(),
  ext: z.string().optional(),
  diskRevision: z.string().optional(),
})
export const draftSessionSchema = z.object({
  version: z.literal(1),
  rootPath: z.string().optional(),
  documents: z.array(documentSchema),
  activeId: z.string().optional(),
})
export type DraftDocument = z.infer<typeof documentSchema>
export type DraftSession = z.infer<typeof draftSessionSchema>
export type DraftSessionStore = Pick<LazyStore, 'entries' | 'set' | 'delete' | 'save'>
export const SESSION_KEY_PREFIX = 'draft-session:'
export const RELOAD_SESSION_KEY = 'mf-draft-reload-v1'

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
