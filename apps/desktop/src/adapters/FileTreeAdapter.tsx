import type { FC, ReactNode } from 'react'
import { FileTreeContext, FileTreeContextValue, fileTreeHandler } from '@markflowy/interface'
import { useEditorStore } from '@/stores'
import { readDirectory } from '@/helper/filesys'

interface FileTreeAdapterProps {
  children: ReactNode
}

export const FileTreeProvider: FC<FileTreeAdapterProps> = ({ children }) => {
  const editorStore = useEditorStore()

  const value: FileTreeContextValue = {
    activeId: editorStore.activeId,
    folderData: editorStore.folderData,
    setFolderData: editorStore.setFolderData,
    setFolderDataPure: editorStore.setFolderDataPure,
    deleteNode: editorStore.deleteNode,
    trashNode: editorStore.trashNode,
    getRootPath: editorStore.getRootPath,
    refreshFolder: async () => {
      const rootPath = editorStore.getRootPath()
      if (!rootPath) {
        throw new Error('No workspace found')
      }
      fileTreeHandler.clearLoadedDirsCache?.()
      const res = await readDirectory(rootPath)
      editorStore.setFolderDataPure(res)
    },
  }

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>
}
