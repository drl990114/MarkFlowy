import { useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readDirectory } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'

const useOpen = () => {
  const { setFolderData } = useEditorStore()
  const { addRecentWorkspaces } = useOpenedCacheStore()

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        const res = await readDirectory(dir)
        addRecentWorkspaces({ path: dir })
        setFolderData(res)
      } catch (error) {
        console.error('error', error)
      }
    },
    [addRecentWorkspaces, setFolderData],
  )

  const openFolderDialog = useCallback(async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openFolder(dir)
  }, [openFolder])

  const openFile = useCallback(async () => {
    const file = await open({ multiple: false, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (typeof file !== 'string') return
    const fileContent = await getFileContent({ filePath: file })
    if (!fileContent) return
    const fileName = file.split('/').pop() || 'new-file.md'
    await addExistingMarkdownFileEdit({
      fileName,
      content: fileContent,
      path: file,
    })
  }
  , [addRecentWorkspaces, setFolderData])

  return {
    openFolderDialog,
    openFolder,
    openFile,
  }
}

export default useOpen
