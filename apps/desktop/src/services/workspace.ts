import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { Command } from '@tauri-apps/plugin-shell'
import { t } from 'i18next'

export enum WorkspaceSyncMode {
  None = 'none',
  PURE_LOCAL = 'pure_local',
  GIT_REMOTE = 'git_remote',
  GIT_LOCAL = 'git_local',
}

export const checkIsGitRepoBySyncMode = (syncMode?: WorkspaceSyncMode) => {
  return syncMode === WorkspaceSyncMode.GIT_LOCAL || syncMode === WorkspaceSyncMode.GIT_REMOTE
}

export const getWorkspace = async () => {
  const workspace = useEditorStore.getState().folderData
  if (!workspace || workspace.length === 0)
    return new WorkSpace({ syncMode: WorkspaceSyncMode.None })

  const rootPath = workspace[0].path
  try {
    const isGitRepo = await invoke<string>('is_git_repository', { path: rootPath })

    if (isGitRepo) {
      const res = await Command.create('run-git-remote', ['remote', '-v'], {
        cwd: rootPath,
      }).execute()

      const isRemote = !res.stderr && res.stdout.trim().length > 0

      return new WorkSpace({
        syncMode: isRemote ? WorkspaceSyncMode.GIT_REMOTE : WorkspaceSyncMode.GIT_LOCAL,
        rootPath: rootPath,
      })
    } else {
      return new WorkSpace({ syncMode: WorkspaceSyncMode.PURE_LOCAL, rootPath: rootPath })
    }
  } catch (error) {
    return new WorkSpace({ syncMode: WorkspaceSyncMode.PURE_LOCAL, rootPath: rootPath })
  }
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
    } else if (this.syncMode === WorkspaceSyncMode.GIT_REMOTE) {
      this.syncModeDescription = t('workspace.sync_mode.git_remote.description')
      this.syncModeName = t('workspace.sync_mode.git_remote.name')
    } else if (this.syncMode === WorkspaceSyncMode.PURE_LOCAL) {
      this.syncModeDescription = t('workspace.sync_mode.pure_local.description')
      this.syncModeName = t('workspace.sync_mode.pure_local.name')
    }
  }
}
