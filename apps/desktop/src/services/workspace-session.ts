import { flushSync } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import { getFileObject } from '@/helper/files'
import { readDirectory } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { t } from '@/i18n'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import { getUnsavedFileIds, guardUnsavedFilesAsync } from './checkUnsavedFiles'
import { restoreRecentFileHistory } from './recent-files'
import { restoreWorkspaceCache, type WorkspaceCachePersistence } from './workspace-cache'
import { currentWindow } from './windows'

function captureUnsavedDocuments() {
  const editor = useEditorStore.getState()
  const documents = new Map(
    editor.opened.flatMap((id) => {
      const file = getFileObject(id)
      if (!file || file.kind !== 'file') return []
      return [[id, { content: editor.getEditorContent(id), path: file.path }] as const]
    }),
  )
  const dirtyIds = new Set(getUnsavedFileIds(editor.opened))
  return new Map([...documents].filter(([id]) => dirtyIds.has(id)))
}

export async function switchWorkspaceSession(path: string, persistence: WorkspaceCachePersistence) {
  for (;;) {
    const currentRootPath = useEditorStore.getState().getRootPath()
    if (currentRootPath === path) return true

    const unsavedDocuments = captureUnsavedDocuments()
    let didSwitch = false
    const continueSwitch = (
      discardedDocuments = new Map<string, { content: string; path?: string }>(),
    ) =>
      savePathCoordinator.runExclusive<void>(
        FILE_MUTATION_QUEUE_KEY,
        `workspace-switch:${path}`,
        async (lease) => {
          // Saving and earlier filesystem mutations can take time. A dialog only
          // authorizes discarding the document versions it actually described.
          const canContinue = () => {
            if (useEditorStore.getState().getRootPath() !== currentRootPath) return false
            return [...captureUnsavedDocuments()].every(([id, document]) => {
              const discarded = discardedDocuments.get(id)
              return discarded?.content === document.content && discarded.path === document.path
            })
          }
          if (!canContinue()) return

          // Make the old workspace read-only before the first asynchronous switch step. The
          // shared mutation queue also prevents stale Explorer commits from crossing roots.
          flushSync(() => {
            lease.activate(path)
            lease.enableOtherEditorBarrier()
          })

          await persistence.flush()
          const restoreRootScope = async () => {
            if (!currentRootPath) return
            await invoke<boolean>('activate_workspace_root', { rootPath: currentRootPath }).catch(
              (error) => logger.error('Failed to restore previous workspace root', error),
            )
          }
          let rollbackEditor: (() => void) | undefined

          try {
            await invoke<boolean>('save_security_bookmark', { path })
            await invoke<boolean>('activate_workspace_root', { rootPath: path })
            const [workspaceCache, folderData] = await Promise.all([
              persistence.getWorkspaceCache(path),
              readDirectory(path),
            ])
            await persistence.flush()
            // Native open events and commands can introduce another draft while
            // directory I/O is pending, even though existing editors are read-only.
            if (!canContinue()) {
              await restoreRootScope()
              return
            }

            const previousEditorState = useEditorStore.getState()
            const previousDirtyStates = useEditorStateStore.getState().idStateMap
            const previousRecentFiles = useRecentFilesStore.getState().entries
            rollbackEditor = () =>
              restoreRecentFileHistory(() => {
                for (const id of discardedDocuments.keys()) {
                  const dirtyState = previousDirtyStates.get(id)
                  if (dirtyState) useEditorStateStore.getState().setIdStateMap(id, dirtyState)
                }
                useEditorStore.getState().setFolderData(previousEditorState.folderData)
                useEditorStore
                  .getState()
                  .setEditorLayout(
                    previousEditorState.editorLayout,
                    previousEditorState.activeGroupId,
                  )
              }, previousRecentFiles)
            flushSync(() => {
              restoreWorkspaceCache(workspaceCache, folderData)
              // A file may also be open in the destination workspace. Its new
              // editor must read disk instead of reusing a discarded dirty draft.
              for (const id of discardedDocuments.keys()) {
                useEditorStateStore.getState().delIdStateMap(id)
              }
            })
            didSwitch = true

            await useOpenedCacheStore
              .getState()
              .addRecentWorkspaces({ path })
              .catch((error) => logger.error('Failed to update recent workspaces', path, error))
            await invoke('update_window_path', {
              windowLabel: currentWindow.label,
              newPath: path,
            }).catch((error) => logger.error('Failed to update window workspace path', path, error))
          } catch (error) {
            await restoreRootScope()
            rollbackEditor?.()
            throw error
          }
        },
      )

    const allowed = await guardUnsavedFilesAsync({
      fileIds: [...useEditorStore.getState().opened],
      labels: {
        save: t('action.save_and_continue'),
        unsaved: t('action.continue_without_save'),
      },
      onContinue: () => continueSwitch(),
      onUnsavedAndContinue: () => continueSwitch(unsavedDocuments),
    })

    if (!allowed) return false
    if (didSwitch) return true
    // Release the mutation queue before prompting/saving again: Save As uses it too.
  }
}
