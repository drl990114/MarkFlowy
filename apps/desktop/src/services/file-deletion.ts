import { invoke } from '@tauri-apps/api/core'

export interface FolderDeletionSummary {
  files: number
  folders: number
  complete: boolean
  isSymlink: boolean
}

export const summarizeFolderForDeletion = (folderPath: string) =>
  invoke<FolderDeletionSummary>('summarize_folder_for_deletion', { folderPath })
