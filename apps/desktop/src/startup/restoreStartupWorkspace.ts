import { invoke } from '@tauri-apps/api/core'
import { createFile, getFileNameFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { restoreWorkspaceCache, type WorkspaceCache } from '@/services/workspace-cache'
import { refreshWorkspaceDirectory } from '@/services/workspace-refresh'
import { markStartupStage } from './performance'

/** Restore tabs directly by path; enumerating the directory is independent. */
export async function restoreStartupWorkspace(
  path: string,
  cache: Promise<WorkspaceCache | undefined>,
  signal: AbortSignal,
) {
  const [workspaceCache] = await Promise.all([
    cache,
    invoke<boolean>('activate_workspace_root', { rootPath: path }),
  ])
  if (signal.aborted) return
  const root = createFile({
    path,
    name: getFileNameFromPath(path.replace(/[\\/]+$/, '')) || path,
    kind: 'dir',
    children: [],
    content: undefined,
    ext: undefined,
  })
  restoreWorkspaceCache(workspaceCache, [root])
  markStartupStage('layout-restored')
  void refreshWorkspaceDirectory({ signal }).catch((error) => {
    // Explorer owns the retry surface. Open documents remain usable.
    logger.error('Failed to load startup workspace directory', error)
  })
}
