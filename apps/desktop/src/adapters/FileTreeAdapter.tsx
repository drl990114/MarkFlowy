import { useMemo, type FC, type ReactNode } from 'react'
import { FileTreeContext, type FileTreeContextValue } from '@markflowy/interface'
import { useEditorStore } from '@/stores'
import { refreshWorkspaceDirectory } from '@/services/workspace-refresh'

interface FileTreeAdapterProps {
  children: ReactNode
}

export const FileTreeProvider: FC<FileTreeAdapterProps> = ({ children }) => {
  const activeId = useEditorStore((state) => state.activeId)
  const folderData = useEditorStore((state) => state.folderData)
  const setFolderData = useEditorStore((state) => state.setFolderData)
  const setFolderDataPure = useEditorStore((state) => state.setFolderDataPure)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const trashNode = useEditorStore((state) => state.trashNode)
  const getRootPath = useEditorStore((state) => state.getRootPath)

  const value: FileTreeContextValue = useMemo(
    () => ({
      activeId,
      folderData,
      setFolderData,
      setFolderDataPure,
      deleteNode,
      trashNode,
      getRootPath,
      refreshFolder: refreshWorkspaceDirectory,
    }),
    [
      activeId,
      deleteNode,
      folderData,
      getRootPath,
      setFolderData,
      setFolderDataPure,
      trashNode,
    ],
  )

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>
}
