import { logger } from '@/helper/logger'
import useEditorStore from '@/stores/useEditorStore'
import { invoke } from '@tauri-apps/api/core'
import { removePristineDocuments } from './editor-file'
import { openStandaloneFile, type FileOpenTarget } from './open-file'
import { createNewWindow, currentWindow } from './windows'

export async function openExternalPaths(
  paths: string[],
  target: FileOpenTarget,
  openWorkspace: (path: string) => Promise<unknown>,
): Promise<void> {
  logger.debug('openExternalPaths', paths)
  let openedInCurrentWindow = false
  let openedInAnotherWindow = false
  const directories = await Promise.all(paths.map((path) => invoke<boolean>('is_dir', { path })))
  const firstFileIndex = directories.findIndex((isDirectory) => !isDirectory)

  const openPath = async (path: string, index: number) => {
    if (directories[index]) {
      const rootPath = useEditorStore.getState().getRootPath()
      if (path === rootPath || (!rootPath && paths.length === 1)) {
        removePristineDocuments()
        await openWorkspace(path)
        openedInCurrentWindow = true
      } else {
        await createNewWindow({ path })
        openedInAnotherWindow = true
      }
      return
    }

    // A new window owns its first bootstrap file. Additional files follow the
    // preference, and each child window receives exactly one bootstrap path.
    const fileTarget = target === 'current' && index === firstFileIndex ? 'current' : 'preference'
    const openedTarget = await openStandaloneFile(path, fileTarget)
    openedInCurrentWindow ||= openedTarget === 'current'
    openedInAnotherWindow ||= openedTarget === 'new'
  }

  if (paths.length === 1) await openPath(paths[0], 0)
  else await Promise.all(paths.map(openPath))

  // Creating/focusing another window must not pull focus back to the source.
  if (openedInCurrentWindow && !openedInAnotherWindow) await currentWindow.setFocus()
}
