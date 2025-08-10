import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { t } from 'i18next'

export enum WorkspaceSyncMode {
  None = 'none',
  PURE_LOCAL = 'pure_local',
  GIT_LOCAL = 'git_local',
}

export const getWorkspace = async () => {
  const workspace = useEditorStore.getState().folderData
  if (!workspace || workspace.length === 0) return new WorkSpace({ syncMode: WorkspaceSyncMode.None })

  const rootPath = workspace[0].path
  const isGitRepo = await invoke<string>('is_git_repository', { path: rootPath })
  return new WorkSpace({
    syncMode: isGitRepo ? WorkspaceSyncMode.GIT_LOCAL : WorkspaceSyncMode.PURE_LOCAL,
    rootPath: rootPath,
  })
}

interface WorkSpaceOptions {
  syncMode: WorkspaceSyncMode
  rootPath?: string | null
}

export class WorkSpace {
  syncMode = WorkspaceSyncMode.None
  syncModeDescription = ''
  syncModeName = ''
  rootPath: string | null = null

  constructor(options: WorkSpaceOptions) {
    this.syncMode = options.syncMode
    this.rootPath = options.rootPath ?? null

    if (this.syncMode === WorkspaceSyncMode.GIT_LOCAL) {
      this.syncModeDescription = t('workspace.sync_mode.git_local.description')
      this.syncModeName = t('workspace.sync_mode.git_local.name')
    } else if (this.syncMode === WorkspaceSyncMode.PURE_LOCAL) {
      this.syncModeDescription = t('workspace.sync_mode.pure_local.description')
      this.syncModeName = t('workspace.sync_mode.pure_local.name')
    }
  }
}
