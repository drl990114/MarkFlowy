import { fileTreeHandler } from '@markflowy/interface'
import { readDirectory } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'

export async function refreshWorkspaceDirectory() {
  const root = useEditorStore.getState().folderData?.[0]
  if (!root?.path) throw new Error('No workspace found')

  fileTreeHandler.clearLoadedDirsCache?.()
  const folderData = await readDirectory(root.path)
  // Switching away and back can reuse the path and ID, but creates a new root.
  if (useEditorStore.getState().folderData?.[0] !== root) return
  useEditorStore.getState().setFolderDataPure(folderData)
}
