import { fileTreeHandler } from '@markflowy/interface'
import { readDirectory, type IFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import { create } from 'zustand'
import { markStartupStage } from '@/startup/performance'

export const useWorkspaceDirectoryState = create<{
  root?: IFile
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: unknown
}>(() => ({ status: 'idle' }))

let nextRequest = 0

export async function refreshWorkspaceDirectory(options: { signal?: AbortSignal } = {}) {
  const root = useEditorStore.getState().folderData?.[0]
  if (!root?.path) throw new Error('No workspace found')
  if (options.signal?.aborted) return
  const request = ++nextRequest
  // Root object identity also catches switching away and back to the same path.
  const isCurrent = () =>
    request === nextRequest &&
    !options.signal?.aborted &&
    useEditorStore.getState().folderData?.[0] === root

  useWorkspaceDirectoryState.setState({ root, status: 'loading', error: undefined })
  markStartupStage('directory-start')
  fileTreeHandler.clearLoadedDirsCache?.()
  try {
    const folderData = await readDirectory(root.path, { isCurrent })
    if (!isCurrent()) return
    useEditorStore.getState().setFolderDataPure(folderData)
    useWorkspaceDirectoryState.setState({ root: folderData[0], status: 'ready' })
    markStartupStage('directory-ready')
  } catch (error) {
    if (!isCurrent()) return
    useWorkspaceDirectoryState.setState({ root, status: 'error', error })
    markStartupStage('directory-error')
    throw error
  }
}
