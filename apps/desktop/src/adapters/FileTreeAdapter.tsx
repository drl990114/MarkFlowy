import { useCallback, useMemo, type FC, type ReactNode } from 'react'
import { FileTreeContext, FileTreeContextValue, fileTreeHandler } from '@markflowy/interface'
import { useEditorStore } from '@/stores'
import { readDirectory } from '@/helper/filesys'

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

  const refreshFolder = useCallback(async () => {
    const rootPath = getRootPath()
    if (!rootPath) {
      throw new Error('No workspace found')
    }
    fileTreeHandler.clearLoadedDirsCache?.()
    const res = await readDirectory(rootPath)
    setFolderDataPure(res)
  }, [getRootPath, setFolderDataPure])

  const value: FileTreeContextValue = useMemo(
    () => ({
      activeId,
      folderData,
      setFolderData,
      setFolderDataPure,
      deleteNode,
      trashNode,
      getRootPath,
      refreshFolder,
    }),
    [
      activeId,
      deleteNode,
      folderData,
      getRootPath,
      refreshFolder,
      setFolderData,
      setFolderDataPure,
      trashNode,
    ],
  )

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>
}
