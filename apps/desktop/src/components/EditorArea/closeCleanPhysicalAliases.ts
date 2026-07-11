import type { IFile } from '@/helper/filesys'

interface CloseCleanPhysicalAliasesParams {
  aliasIds: string[]
  closeTab: (fileId: string) => void
  content: string
  getFile: (fileId: string) => IFile | undefined
  updateFile: (file: IFile) => void
}

/**
 * A hardlink/symlink editor cannot stay independently clean after its shared
 * inode changes. Refresh its cache once and close only the tab; the directory
 * entry remains available and reopening performs a fresh disk read.
 */
export function closeCleanPhysicalAliases({
  aliasIds,
  closeTab,
  content,
  getFile,
  updateFile,
}: CloseCleanPhysicalAliasesParams): void {
  aliasIds.forEach((aliasId) => {
    const aliasFile = getFile(aliasId)
    if (aliasFile) {
      updateFile({
        ...aliasFile,
        content,
      })
    }
    closeTab(aliasId)
  })
}
